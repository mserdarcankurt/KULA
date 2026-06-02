/**
 * FILE: useItems.ts
 * ROLE IN KULA: The "Feed Engine" — fetches, filters, and sorts all community posts.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   This is the CENTRAL PIPELINE for all content the user sees.
 *   It chains together multiple systems:
 *     1. Firestore (raw data source)
 *     2. Reach/Circle filtering (who SHOULD see this?)
 *     3. Trust Network privacy (who is ALLOWED to see this?)
 *     4. GPS distance sorting (what's CLOSEST?)
 * 
 * CALLED BY:
 *   - Explore.tsx → shows the main "nearby" feed
 *   - Discovery.tsx → shows the search/filtered feed
 *   - Feed.tsx → shows circle-specific content
 * 
 * INPUTS:
 *   - userLocation: from useGeolocation.ts (GPS coordinates)
 *   - viewerProfile: from useAuth.tsx (the logged-in user's profile)
 *   - circleId: optional — if set, only shows items for that circle
 * 
 * THE FILTERING PIPELINE (in order):
 *   1. FIRESTORE QUERY: Get all ACTIVE items (optionally filtered by circleId)
 *   2. REAL-TIME: onSnapshot keeps this live — new posts appear instantly
 *   3. REACH FILTER: Check if the item's reachTypes match the viewer's context
 *   4. BLOCK FILTER: Remove items from users the viewer has blocked
 *   5. TRUST NETWORK FILTER: Run checkSymmetricVisibility() from trustGraph.ts
 *   6. DISTANCE SORT: Calculate distance using getDistance() from useGeolocation.ts
 * 
 * SECURITY NOTE:
 *   Steps 3-5 are CLIENT-SIDE filtering. The actual database security is in
 *   firestore.rules. These client-side filters provide a better UX by hiding
 *   irrelevant content rather than showing it and failing on interaction.
 */
import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Item, UserProfile } from '../types';
import { getDistance } from './useGeolocation';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { checkItemVisibility, checkNeighborhoodVisibility, getNetworkDistances } from '../lib/trustGraph';

export function useItems(userLocation: { lat: number; lng: number } | null, viewerProfile: UserProfile | null, circleId?: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(50);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setLimitCount(prev => prev + 50);
    }
  }, [hasMore]);

  useEffect(() => {
    // ── STEP 1: Build the Firestore query ──────────────────
    // If we have a circleId, only fetch items for that circle.
    // Otherwise, fetch active items with pagination.
    let q;
    if (circleId) {
      q = query(
        collection(db, 'items'),
        where('status', '==', 'ACTIVE'),
        where('circleId', '==', circleId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(db, 'items'),
        where('status', '==', 'ACTIVE'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    // ── STEP 2: Subscribe to real-time updates ─────────────
    console.log('[useItems] Subscribing to Firestore query with limit', limitCount);
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('[useItems] onSnapshot received docs count:', snapshot.docs.length);
      
      setHasMore(snapshot.docs.length === limitCount);

      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      })) as Item[];

      // [ALPHA] Filter out shelved interaction types.
      const SHELVED_TYPES = ['IMECE', 'MISSION'];
      const activeItems = fetchedItems.filter(item => !SHELVED_TYPES.includes(item.type));

      // Items are already sorted by createdAt desc by Firestore

      console.log('[useItems] Step 3: Reach/circle filtering. Initial count:', activeItems.length);
      // ── STEP 3: Apply reach/circle filters ───────────────
      let visibleItems = activeItems;
      
      if (circleId) {
        visibleItems = activeItems.filter(item => {
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;
          return item.circleId === circleId || 
            (item.reachTypes?.includes('SPECIFIC_CIRCLES') && item.targetCircles?.includes(circleId)) ||
            item.reachTypes?.includes('ALL_CIRCLES');
        });
      } else {
        visibleItems = activeItems.filter(item => {
          if (viewerProfile && item.ownerId === viewerProfile.uid) return true;
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;

          const reachTypes = Array.isArray(item.reachTypes) ? item.reachTypes : [item.reachTypes || 'VICINITY'];
          const isVisibleByVicinity = reachTypes.includes('VICINITY');
          const isVisibleByAllCircles = reachTypes.includes('ALL_CIRCLES');
          const isVisibleBySpecificCircles = reachTypes.includes('SPECIFIC_CIRCLES') && item.targetCircles?.some(cid => viewerProfile?.joinedCircles?.includes(cid));
          const isVisibleByCircleId = item.circleId ? viewerProfile?.joinedCircles?.includes(item.circleId) : false;

          return isVisibleByVicinity || isVisibleByAllCircles || isVisibleBySpecificCircles || isVisibleByCircleId;
        });
      }

      console.log('[useItems] Step 4: Trust network privacy check. Input count:', visibleItems.length);
      // ── STEP 4: Trust Network Privacy Filter ─────────────
      // We leverage the cached getNetworkDistances which avoids N+1 queries.
      let distances: Record<string, number> = {};
      if (viewerProfile) {
        try {
          distances = await getNetworkDistances(viewerProfile.uid);
        } catch (e) {
          console.error("Failed to load network distances", e);
        }
      }
      const visResults = await Promise.all(visibleItems.map(async (item) => {
        if (!viewerProfile || item.ownerId === viewerProfile.uid) {
          return { itemId: item.id, visible: true, degrees: 0 };
        }
        const pref = viewerProfile.privacySettings?.profileVisibility || viewerProfile.visibilityPreference || 'PUBLIC';
        try {
          const vis = await checkItemVisibility(viewerProfile.uid, pref, item);
          const degrees = distances[item.ownerId] !== undefined ? distances[item.ownerId] : null;
          return { itemId: item.id, visible: vis, degrees };
        } catch (e) {
          console.error('Visibility check failed for item', item.id, e);
          return { itemId: item.id, visible: false, degrees: null };
        }
      }));
      
      const visMap = new Map(visResults.map(r => [r.itemId, { visible: r.visible, degrees: r.degrees }]));
 
      const privacyFilteredItems = visibleItems
        .filter(item => visMap.get(item.id)?.visible === true)
        .map(item => ({
          ...item,
          degrees: visMap.get(item.id)?.degrees ?? undefined
        }));

      console.log('[useItems] Step 5: Distance calculation. Input count:', privacyFilteredItems.length);
       const processedItems = await Promise.all(privacyFilteredItems.map(async item => {
         if (!viewerProfile) return item;
         try {
           const isLocVisible = await checkNeighborhoodVisibility(viewerProfile.uid, item.ownerId);
           if (!isLocVisible) {
             return { ...item, location: undefined, distance: undefined };
           }
           return {
             ...item,
             distance: (userLocation && item.location) 
               ? getDistance(userLocation.lat, userLocation.lng, item.location.lat, item.location.lng)
               : undefined
           };
         } catch (e) {
           console.error('Neighborhood visibility check failed for item', item.id, e);
           return { ...item, location: undefined, distance: undefined };
         }
       }));
 
       console.log('[useItems] Feed processing complete. Final count:', processedItems.length);
       setItems(processedItems);
       setLoading(false);
    }, (error) => {
      console.error("useItems snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    return unsubscribe;
  }, [userLocation, viewerProfile, circleId, limitCount]);

  return { items, loading, loadMore, hasMore };
}
