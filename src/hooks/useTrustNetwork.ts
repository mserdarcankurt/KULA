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
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
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
      const getNetworkGraphFn = httpsCallable<{ maxDepth: number }, any>(functions, 'getNetworkGraph');
      const result = await getNetworkGraphFn({ maxDepth: maxDegree });
      
      const payload = result.data;
      
      setData({
        nodes: payload.nodes || [],
        links: payload.links || [],
        lineageIds: new Set(payload.lineageIds || []),
      });
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
