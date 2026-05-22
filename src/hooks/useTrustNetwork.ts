/**
 * FILE: useTrustNetwork.ts
 * PURPOSE: This is the "Engine" for the KULA Trust Graph.
 * It calculates how users are connected to each other through 
 * Invites (vertical trust) and Vouches (horizontal trust).
 * 
 * Think of it as a "Six Degrees of Separation" calculator 
 * for your neighborhood.
 */
import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from './useAuth';

// ─── Types ───────────────────────────────────────────────────

/**
 * GraphNode:
 * Represents a single person or organization in the network.
 */
export interface GraphNode {
  id: string;
  name: string;
  photo: string | null;
  degree: number;        // Distance from YOU (0 = self, 1 = direct friend, etc.)
  isOrganization: boolean;
  visibilityPreference: string;
  neighborhoodCenter?: { lat: number; lng: number };
}

/**
 * GraphLink:
 * Represents a connection (a line) between two nodes.
 */
export interface GraphLink {
  source: string; // The UID of the 'from' user
  target: string; // The UID of the 'to' user
  type: 'INVITE' | 'VOUCH'; // Invite = hierarchical (parent/child), Vouch = peer-to-peer
}

export interface TrustGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  lineageIds: Set<string>; // A list of IDs that belong to your direct "Family Tree"
}

// Helper to normalize coordinates (handles standard object and Firestore GeoPoint structures)
const safeCoords = (loc: any): { lat: number; lng: number } | undefined => {
  if (!loc) return undefined;
  
  // If it's standard { lat, lng }
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)) {
    return { lat: loc.lat, lng: loc.lng };
  }
  
  // If it's a Firestore GeoPoint or similar object with latitude/longitude
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude) && !isNaN(loc.longitude)) {
    return { lat: loc.latitude, lng: loc.longitude };
  }

  // Fallback try parsing strings
  const latVal = parseFloat(loc.lat ?? loc.latitude);
  const lngVal = parseFloat(loc.lng ?? loc.longitude);
  if (!isNaN(latVal) && !isNaN(lngVal)) {
    return { lat: latVal, lng: lngVal };
  }
  
  return undefined;
};

// ─── Hook ────────────────────────────────────────────────────

/**
 * useTrustNetwork:
 * This hook fetches all users and connections, then runs a mathematical 
 * algorithm (BFS) to map out your community.
 */
export function useTrustNetwork(maxDegree: number = 4) {
  const { user } = useAuth();
  
  // Storage for our graph data
  const [data, setData] = useState<TrustGraphData>({ nodes: [], links: [], lineageIds: new Set() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * buildGraph():
   * The core algorithm. It rebuilds the network map.
   */
  const buildGraph = useCallback(async () => {
    if (!user) return; // Can't build a network for a ghost!

    setLoading(true);
    setError(null);

    try {
      /**
       * STEP 1: FETCH DATA
       * We grab EVERY user and EVERY accepted vouch in the database.
       * (In a massive app, we'd filter this, but for a neighborhood, bulk fetch is faster).
       */
      const [usersSnap, vouchesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'vouches'), where('status', '==', 'ACCEPTED'))),
      ]);

      // Create a "Lookup Table" (Map) so we can find user info by ID instantly.
      const userMap = new Map<string, {
        displayName: string;
        photoURL: string | null;
        hostId?: string;
        isOrganization?: boolean;
        visibilityPreference?: string;
        neighborhoodCenter?: { lat: number; lng: number };
        location?: { lat: number; lng: number };
      }>();

      usersSnap.forEach(doc => {
        const d = doc.data();
        userMap.set(doc.id, {
          displayName: d.displayName || 'Neighbor',
          photoURL: d.photoURL || null,
          hostId: d.hostId,
          isOrganization: d.isOrganization || false,
          visibilityPreference: d.visibilityPreference || 'PUBLIC',
          neighborhoodCenter: safeCoords(d.neighborhoodCenter),
          location: safeCoords(d.location),
        });
      });

      /**
       * STEP 2: BUILD ADJACENCY LIST
       * This is a technical term for a "Map of Connections". 
       * If User A is connected to User B, we store that here.
       */
      const adjacency = new Map<string, Set<string>>();

      const addEdge = (a: string, b: string) => {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
      };

      // Add "Invite" connections (Who invited whom?)
      userMap.forEach((profile, uid) => {
        if (profile.hostId && userMap.has(profile.hostId)) {
          addEdge(uid, profile.hostId);
        }
      });

      // Add "Vouch" connections (Peer-to-peer trust)
      vouchesSnap.forEach(doc => {
        const v = doc.data();
        if (userMap.has(v.fromUserId) && userMap.has(v.toUserId)) {
          addEdge(v.fromUserId, v.toUserId);
        }
      });

      /**
       * STEP 3: BREADTH-FIRST SEARCH (BFS)
       * This is the "Six Degrees" algorithm.
       * We start at YOU (degree 0), find your friends (degree 1), 
       * then their friends (degree 2), up to maxDegree.
       */
      const visited = new Map<string, number>(); // Stores the distance for each user
      const bfsQueue: [string, number][] = [[user.uid, 0]];
      visited.set(user.uid, 0);

      while (bfsQueue.length > 0) {
        const [currentUid, currentDegree] = bfsQueue.shift()!;
        if (currentDegree >= maxDegree) continue;

        const neighbors = adjacency.get(currentUid);
        if (!neighbors) continue;

        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.set(neighborId, currentDegree + 1);
            bfsQueue.push([neighborId, currentDegree + 1]);
          }
        }
      }

      /**
       * STEP 4: FORMAT NODES
       * Convert our "Visited" list into the format the UI expects.
       */
      const nodes: GraphNode[] = [];
      for (const [uid, degree] of visited) {
        const profile = userMap.get(uid);
        if (!profile) continue;

        nodes.push({
          id: uid,
          name: profile.displayName,
          photo: profile.photoURL,
          degree,
          isOrganization: profile.isOrganization || false,
          visibilityPreference: profile.visibilityPreference || 'PUBLIC',
          neighborhoodCenter: profile.neighborhoodCenter || profile.location,
        });
      }

      /**
       * STEP 5: BUILD LINKS
       * Create the lines that connect the dots.
       */
      const visibleIds = new Set(visited.keys());
      const links: GraphLink[] = [];
      const linkSet = new Set<string>(); // Used to prevent duplicate lines

      // Invite links
      for (const uid of visibleIds) {
        const profile = userMap.get(uid);
        if (profile?.hostId && visibleIds.has(profile.hostId)) {
          const key = [uid, profile.hostId].sort().join('::');
          if (!linkSet.has(key)) {
            linkSet.add(key);
            // In the "Lineage" view, lines should point from Host to Guest.
            links.push({ source: profile.hostId, target: uid, type: 'INVITE' });
          }
        }
      }

      // Vouch links
      vouchesSnap.forEach(doc => {
        const v = doc.data();
        if (visibleIds.has(v.fromUserId) && visibleIds.has(v.toUserId)) {
          const key = [v.fromUserId, v.toUserId].sort().join('::');
          if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({ source: v.fromUserId, target: v.toUserId, type: 'VOUCH' });
          }
        }
      });

      /**
       * STEP 6: COMPUTE LINEAGE
       * KULA has a "Family Tree" view. We find your ancestors (+2 gens) 
       * and your descendants (-3 gens).
       */
      const lineageIds = new Set<string>();
      lineageIds.add(user.uid);

      // Go UP: Who invited you? Who invited them?
      let currentHost = userMap.get(user.uid)?.hostId;
      for (let i = 0; i < 2; i++) {
        if (currentHost && userMap.has(currentHost)) {
          lineageIds.add(currentHost);
          currentHost = userMap.get(currentHost)?.hostId;
        } else {
          break;
        }
      }

      // Go DOWN: Who did you invite? Who did they invite?
      const downQueue: [string, number][] = [[user.uid, 0]];
      const hostToGuests = new Map<string, string[]>();
      userMap.forEach((p, uid) => {
        if (p.hostId) {
          if (!hostToGuests.has(p.hostId)) hostToGuests.set(p.hostId, []);
          hostToGuests.get(p.hostId)!.push(uid);
        }
      });

      while (downQueue.length > 0) {
        const [curr, depth] = downQueue.shift()!;
        if (depth >= 3) continue;
        const guests = hostToGuests.get(curr);
        if (guests) {
          for (const g of guests) {
            lineageIds.add(g);
            downQueue.push([g, depth + 1]);
          }
        }
      }

      // Final cleanup: Ensure all lineage nodes are in the graph.
      for (const lid of lineageIds) {
        if (!visited.has(lid)) {
          const profile = userMap.get(lid);
          if (profile) {
            nodes.push({
              id: lid,
              name: profile.displayName,
              photo: profile.photoURL,
              degree: 0, 
              isOrganization: profile.isOrganization || false,
              visibilityPreference: profile.visibilityPreference || 'PUBLIC',
              neighborhoodCenter: profile.neighborhoodCenter || profile.location,
            });
            if (profile.hostId && lineageIds.has(profile.hostId)) {
               const key = [lid, profile.hostId].sort().join('::');
               if (!linkSet.has(key)) {
                 linkSet.add(key);
                 links.push({ source: profile.hostId, target: lid, type: 'INVITE' });
               }
            }
          }
        }
      }

      // We have our data!
      setData({ nodes, links, lineageIds });
    } catch (err) {
      console.error('Failed to build trust network:', err);
      setError('Could not load your trust network.');
    } finally {
      setLoading(false);
    }
  }, [user, maxDegree]);

  // Run the algorithm whenever the user or the depth limit changes.
  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  return { data, loading, error, refresh: buildGraph };
}
