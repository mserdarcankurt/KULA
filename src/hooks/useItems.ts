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
import { checkSymmetricVisibility } from '../lib/trustGraph';

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
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Convert Firestore documents to our Item type
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      })) as Item[];

      // Sort by newest first (client-side because Firestore composite indexes
      // would be needed for multi-field ordering with filtering)
      fetchedItems.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      // ── STEP 3: Apply reach/circle filters ───────────────
      let visibleItems = fetchedItems;
      
      if (circleId) {
        // CIRCLE VIEW: Show items that belong to this circle, OR were broadcast
        // to all circles, OR specifically targeted this circle.
        visibleItems = fetchedItems.filter(item => {
          // Block filter: never show items from blocked users
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;
          
          return item.circleId === circleId || 
            (item.reachTypes?.includes('SPECIFIC_CIRCLES') && item.targetCircles?.includes(circleId)) ||
            item.reachTypes?.includes('ALL_CIRCLES');
        });
      } else {
        // GLOBAL VIEW (Explore): Show items based on their reach settings.
        visibleItems = fetchedItems.filter(item => {
          // Owner always sees their own items (even if reach settings are narrow)
          if (viewerProfile && item.ownerId === viewerProfile.uid) return true;

          // Block filter
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;

          // Normalize reachTypes to an array (handles legacy single-value data)
          const reachTypes = Array.isArray(item.reachTypes) ? item.reachTypes : [item.reachTypes || 'VICINITY'];
          
          const isVisibleByVicinity = reachTypes.includes('VICINITY');
          const isVisibleByAllCircles = reachTypes.includes('ALL_CIRCLES');
          const isVisibleBySpecificCircles = reachTypes.includes('SPECIFIC_CIRCLES') && item.targetCircles?.some(cid => viewerProfile?.joinedCircles?.includes(cid));

          // Show if ANY of the reach conditions match
          return isVisibleByVicinity || isVisibleByAllCircles || isVisibleBySpecificCircles;
        });
      }

      // ── STEP 4: Trust Network Privacy Filter ─────────────
      // This is the EXPENSIVE step. For each unique item owner,
      // we calculate the trust distance and check if the viewer
      // is allowed to see them based on BOTH users' visibility preferences.
      // 
      // CONNECTION TO trustGraph.ts:
      //   checkSymmetricVisibility() runs a BFS through the trust network.
      //   If Alice's visibilityPreference is "DEGREE_2" and Bob is 3 degrees away,
      //   Bob won't see Alice's items — AND Alice won't see Bob's items.
      const uniqueOwners = Array.from(new Set(visibleItems.map(i => i.ownerId)));
      const visResults = await Promise.all(uniqueOwners.map(async ownerId => {
        // Skip visibility check for own items
        if (!viewerProfile || ownerId === viewerProfile.uid) return { ownerId, visible: true };
        const pref = viewerProfile.visibilityPreference || 'PUBLIC';
        try {
          const vis = await checkSymmetricVisibility(viewerProfile.uid, pref, ownerId);
          return { ownerId, visible: vis };
        } catch (e) {
          console.error('Visibility check failed for', ownerId, e);
          // SECURE DEFAULT: If the check fails, hide the item (fail-closed, not fail-open)
          return { ownerId, visible: false };
        }
      }));
      
      // Build a quick lookup: ownerId → can the viewer see them?
      const visMap = new Map(visResults.map(r => [r.ownerId, r.visible]));

      // Apply the privacy filter
      const privacyFilteredItems = visibleItems.filter(item => visMap.get(item.ownerId) === true);

      // ── STEP 5: Distance sorting ─────────────────────────
      // If we have the user's GPS coordinates, calculate the physical distance
      // to each item and sort by nearest-first.
      // This uses getDistance() from useGeolocation.ts (Haversine formula).
      if (userLocation) {
        const itemsWithDistance = privacyFilteredItems.map(item => ({
          ...item,
          distance: item.location 
            ? getDistance(userLocation.lat, userLocation.lng, item.location.lat, item.location.lng)
            : Infinity // Items without location go to the bottom
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
        
        setItems(itemsWithDistance);
      } else {
        // No GPS available — just show items in chronological order (already sorted above)
        setItems(privacyFilteredItems);
      }
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
