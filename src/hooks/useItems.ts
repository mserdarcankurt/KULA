import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Item, UserProfile } from '../types';
import { getDistance } from './useGeolocation';
import { handleFirestoreError, OperationType } from '../lib/firebase';

export function useItems(userLocation: { lat: number; lng: number } | null, viewerProfile: UserProfile | null, circleId?: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        where('status', '==', 'ACTIVE'),
        where('circleId', '==', null)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      })) as Item[];

      // Sort client side
      fetchedItems.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      // Circle-specific filtering
      let visibleItems = fetchedItems;
      
      if (circleId) {
        visibleItems = fetchedItems.filter(item => {
          // Block filter
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;
          
          return item.circleId === circleId || 
            (item.reachTypes?.includes('SPECIFIC_CIRCLES') && item.targetCircles?.includes(circleId)) ||
            item.reachTypes?.includes('ALL_CIRCLES');
        });
      } else {
        // Global Visibility Filtering
        visibleItems = fetchedItems.filter(item => {
          // Owner always sees own items
          if (viewerProfile && item.ownerId === viewerProfile.uid) return true;

          // Block filter
          if (viewerProfile?.blockedUsers?.includes(item.ownerId)) return false;

          const reachTypes = Array.isArray(item.reachTypes) ? item.reachTypes : [item.reachTypes || 'VICINITY'];
          
          const isVisibleByVicinity = reachTypes.includes('VICINITY');
          const isVisibleByAllCircles = reachTypes.includes('ALL_CIRCLES') && (viewerProfile?.joinedCircles?.length || 0) > 0;
          const isVisibleBySpecificCircles = reachTypes.includes('SPECIFIC_CIRCLES') && item.targetCircles?.some(cid => viewerProfile?.joinedCircles?.includes(cid));

          return isVisibleByVicinity || isVisibleByAllCircles || isVisibleBySpecificCircles;
        });
      }

      if (userLocation) {
        const itemsWithDistance = visibleItems.map(item => ({
          ...item,
          distance: item.location 
            ? getDistance(userLocation.lat, userLocation.lng, item.location.lat, item.location.lng)
            : Infinity
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
        
        setItems(itemsWithDistance);
      } else {
        setItems(visibleItems);
      }
      setLoading(false);
    }, (error) => {
      console.error("useItems snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    return unsubscribe;
  }, [userLocation, viewerProfile, circleId]);

  return { items, loading };
}
