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
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Item, UserProfile } from '../types';
import { getDistance } from './useGeolocation';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { checkItemVisibility, checkNeighborhoodVisibility, getDegreesOfSeparation } from '../lib/trustGraph';

export function useItems(userLocation: { lat: number; lng: number } | null, viewerProfile: UserProfile | null, circleId?: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── STEP 1: Build the Firestore query ──────────────────
    // If we have a circleId, only fetch items for that circle.
    // Otherwise, fetch ALL active items (we'll filter client-side).
    let q;
    if (circleId) {
      q = query(
        collection(db, 'items'),
        where('status', '==', 'ACTIVE'),
        where('circleId', '==', circleId)
      );
    } else {
      q = query(
        collection(db, 'items'),
        where('status', '==', 'ACTIVE')
      );
    }

    // ── STEP 2: Subscribe to real-time updates ─────────────
    // onSnapshot is a LIVE LISTENER. Unlike getDocs (one-time fetch),
    // this fires every time ANY item changes in the database.
    // This means: when someone posts a new item, YOUR feed updates instantly.
    console.log('[useItems] Subscribing to Firestore query...');
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('[useItems] onSnapshot received docs count:', snapshot.docs.length);
      // Convert Firestore documents to our Item type
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      })) as Item[];

      // [ALPHA] Filter out shelved interaction types.
      // IMECE and MISSION are distinct concepts from JOIN and CIRCLE_INVITE,
      // but they are shelved for the closed alpha. Hide them from all feeds.
      const SHELVED_TYPES = ['IMECE', 'MISSION'];
      const activeItems = fetchedItems.filter(item => !SHELVED_TYPES.includes(item.type));

      // Sort by newest first (client-side because Firestore composite indexes
      // would be needed for multi-field ordering with filtering)
      activeItems.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      console.log('[useItems] Step 3: Reach/circle filtering. Initial count:', activeItems.length);
      // ── STEP 3: Apply reach/circle filters ───────────────
      let visibleItems = activeItems;
      
      if (circleId) {
        // CIRCLE VIEW: Show items that belong to this circle, OR were broadcast
        // to all circles, OR specifically targeted this circle.
        visibleItems = activeItems.filter(item => {
          // Block filter: never show items from blocked users
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;
          
          return item.circleId === circleId || 
            (item.reachTypes?.includes('SPECIFIC_CIRCLES') && item.targetCircles?.includes(circleId)) ||
            item.reachTypes?.includes('ALL_CIRCLES');
        });
      } else {
        // GLOBAL VIEW (Explore): Show items based on their reach settings.
        visibleItems = activeItems.filter(item => {
          // Owner always sees their own items (even if reach settings are narrow)
          if (viewerProfile && item.ownerId === viewerProfile.uid) return true;

          // Block filter
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;

          // Normalize reachTypes to an array (handles legacy single-value data)
          const reachTypes = Array.isArray(item.reachTypes) ? item.reachTypes : [item.reachTypes || 'VICINITY'];
          
          const isVisibleByVicinity = reachTypes.includes('VICINITY');
          const isVisibleByAllCircles = reachTypes.includes('ALL_CIRCLES');
          const isVisibleBySpecificCircles = reachTypes.includes('SPECIFIC_CIRCLES') && item.targetCircles?.some(cid => viewerProfile?.joinedCircles?.includes(cid));
          const isVisibleByCircleId = item.circleId ? viewerProfile?.joinedCircles?.includes(item.circleId) : false;

          // Show if ANY of the reach conditions match
          return isVisibleByVicinity || isVisibleByAllCircles || isVisibleBySpecificCircles || isVisibleByCircleId;
        });
      }

      console.log('[useItems] Step 4: Trust network privacy check. Input count:', visibleItems.length);
      // ── STEP 4: Trust Network Privacy Filter ─────────────
      // For each item, check if it is visible to the viewer based on:
      // 1. Symmetric profile visibility preferences of the owner and viewer
      // 2. The item's own custom visibilityReach propagation setting
      const visResults = [];
      for (const item of visibleItems) {
        if (!viewerProfile || item.ownerId === viewerProfile.uid) {
          visResults.push({ itemId: item.id, visible: true, degrees: 0 });
          continue;
        }
        const pref = viewerProfile.privacySettings?.profileVisibility || viewerProfile.visibilityPreference || 'PUBLIC';
        try {
          console.log('[useItems] checking item visibility for', item.id, 'owner', item.ownerId);
          const vis = await checkItemVisibility(viewerProfile.uid, pref, item);
          const sep = await getDegreesOfSeparation(viewerProfile.uid, item.ownerId);
          console.log('[useItems] checked visibility for', item.id, 'result:', vis, 'degrees:', sep.degrees);
          visResults.push({ itemId: item.id, visible: vis, degrees: sep.degrees });
        } catch (e) {
          console.error('Visibility check failed for item', item.id, e);
          // SECURE DEFAULT: If the check fails, hide the item (fail-closed)
          visResults.push({ itemId: item.id, visible: false, degrees: null });
        }
      }
      
      // Build a quick lookup: itemId → can the viewer see it + degree
      const visMap = new Map(visResults.map(r => [r.itemId, { visible: r.visible, degrees: r.degrees }]));
 
      // Apply the privacy filter and populate degrees
      const privacyFilteredItems = visibleItems
        .filter(item => visMap.get(item.id)?.visible === true)
        .map(item => ({
          ...item,
          degrees: visMap.get(item.id)?.degrees ?? undefined
        }));

      console.log('[useItems] Step 5: Distance calculation. Input count:', privacyFilteredItems.length);
       // ── STEP 5: Distance calculation & Location Redaction ────
       // Redact item location if owner restricts neighborhoodVisibility and the viewer
       // does not meet the trust requirement. If visibility is allowed and userLocation is
       // provided, calculate the physical distance.
       const processedItems = await Promise.all(privacyFilteredItems.map(async item => {
         if (!viewerProfile) return item;
         try {
           const isLocVisible = await checkNeighborhoodVisibility(viewerProfile.uid, item.ownerId);
           if (!isLocVisible) {
             return {
               ...item,
               location: undefined,
               distance: undefined
             };
           }
           
           return {
             ...item,
             distance: (userLocation && item.location) 
               ? getDistance(userLocation.lat, userLocation.lng, item.location.lat, item.location.lng)
               : undefined
           };
         } catch (e) {
           console.error('Neighborhood visibility check failed for item', item.id, e);
           return {
             ...item,
             location: undefined,
             distance: undefined
           };
         }
       }));
 
       console.log('[useItems] Feed processing complete. Final count:', processedItems.length);
       setItems(processedItems);
       setLoading(false);
    }, (error) => {
      // If the Firestore query itself fails (e.g., missing index, permissions error),
      // route it through the centralized error handler in firebase.ts.
      console.error("useItems snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    // Cleanup: unsubscribe from the live listener when the component unmounts
    // or when the dependencies change (new location, new profile, different circle).
    return unsubscribe;
  }, [userLocation, viewerProfile, circleId]);

  return { items, loading };
}
