/**
 * FILE: useNetworkGraph.ts
 * ROLE IN KULA: The "Live Graph Watcher" — maintains a real-time map of all user connections.
 * 
 * RELATIONSHIP TO OTHER FILES:
 *   - Uses: lib/network.ts → buildNetworkGraph() and findDegreesOfSeparation()
 *   - Uses: useAuth.tsx → to get the current user's UID
 *   - Used by: NetworkGraph.tsx → the visual D3.js force-directed graph
 *   - Used by: ConnectionBadge.tsx → shows "2° away" on profile cards
 * 
 * HOW IT DIFFERS FROM useTrustNetwork.ts:
 *   This hook subscribes to the `users` collection with onSnapshot (LIVE).
 *   Every time a new user joins or a hostStatus changes, the graph rebuilds.
 *   
 *   useTrustNetwork.ts is more powerful (includes vouches) but is a ONE-TIME fetch.
 *   This hook is LIVE but simpler (invites only).
 * 
 * FLOW:
 *   1. Subscribe to ALL users in Firestore (onSnapshot = real-time)
 *   2. When the data changes, call buildNetworkGraph() from lib/network.ts
 *   3. Store the resulting adjacency list in state
 *   4. Expose getDegreesOfSeparation() for components to query trust distance
 * 
 * SECURITY GATE in getDegreesOfSeparation():
 *   If the current user's hostStatus is not 'APPROVED' (and they're not admin),
 *   they can't query trust distances. This prevents unapproved users from
 *   mapping the network before they're fully welcomed.
 */
import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { buildNetworkGraph, findDegreesOfSeparation } from '../lib/network';
import { useAuth } from './useAuth';

export function useNetworkGraph() {
  const { user, profile } = useAuth();
  
  // The adjacency list: { uid: [connected_uid_1, connected_uid_2, ...] }
  const [graph, setGraph] = useState<Record<string, string[]>>({});
  // All user profiles — passed to NetworkGraph.tsx for rendering node details
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!user) return; // No user = no graph

    // LIVE SUBSCRIPTION to the entire `users` collection.
    // Every time a user joins, gets approved, or updates their profile,
    // this callback fires and the graph is rebuilt.
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach(doc => {
        usersData.push(doc.data() as UserProfile);
      });
      setAllUsers(usersData);
      // Rebuild the graph from scratch with the latest user data.
      // buildNetworkGraph() is in lib/network.ts — it creates an adjacency list
      // from hostId relationships (invite chains).
      setGraph(buildNetworkGraph(usersData));
    });

    // Cleanup: stop listening when the component unmounts
    return () => unsubscribe();
  }, [user]);

  /**
   * getDegreesOfSeparation():
   * A convenience wrapper that components call to find trust distance.
   * 
   * SECURITY: Only approved users (or admins) can query the graph.
   * This prevents WaitingRoom users from exploring the network.
   * 
   * DELEGATES TO: lib/network.ts → findDegreesOfSeparation() (BFS algorithm)
   */
  const getDegreesOfSeparation = (targetUid: string) => {
    if (!user || !profile) return null;
    // Gate: unapproved users can't map the network
    if (profile.hostStatus !== 'APPROVED' && !profile.isAdmin) return null;
    
    return findDegreesOfSeparation(graph, user.uid, targetUid);
  };

  return { getDegreesOfSeparation, graph, allUsers };
}
