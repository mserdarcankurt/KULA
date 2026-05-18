/**
 * FILE: network.ts
 * ROLE IN KULA: The "Legacy Graph Calculator" — a simpler version of useTrustNetwork.ts.
 * 
 * RELATIONSHIP TO OTHER FILES:
 *   - This file is used by useNetworkGraph.ts (the hook).
 *   - useNetworkGraph.ts is used by NetworkGraph.tsx (the visual D3 graph).
 *   - The NEWER useTrustNetwork.ts is used by LineageTree.tsx (the tree view).
 * 
 * WHY TWO GRAPH SYSTEMS?
 *   This file was the ORIGINAL graph implementation. It only considers INVITE edges
 *   (parent/child). The newer useTrustNetwork.ts also considers VOUCH edges (peer trust).
 *   Both coexist because they power different UI views:
 *     - NetworkGraph.tsx uses THIS file (simpler, faster for the full-network bubble view)
 *     - LineageTree.tsx uses useTrustNetwork.ts (richer, includes vouches for the tree view)
 * 
 * FUNCTIONS:
 *   1. buildNetworkGraph(): Takes all users, builds an adjacency list of connections.
 *   2. findDegreesOfSeparation(): BFS pathfinding between two users.
 *      Used by ConnectionBadge.tsx to show "2 degrees away" on profile cards.
 */
import { UserProfile } from '../types';

/**
 * buildNetworkGraph():
 * Takes the full list of users and creates a graph of connections.
 * 
 * INPUT: Array of UserProfile objects (fetched from Firestore `users` collection).
 * OUTPUT: An adjacency list — a dictionary where each key is a UID and the value
 *         is an array of UIDs that user is connected to.
 * 
 * LOGIC:
 *   - For each user, check if they have a `hostId` (the person who invited them).
 *   - If the host exists AND the user is APPROVED, draw a line between them.
 *   - The connection is UNDIRECTED — both users can "see" each other in the graph.
 * 
 * CALLED BY: useNetworkGraph.ts → which passes the result to NetworkGraph.tsx
 */
export function buildNetworkGraph(users: UserProfile[]) {
  // Graph where keys are UIDs and values are arrays of connected UIDs
  const graph: Record<string, string[]> = {};

  // Step 1: Initialize every user as a node with no connections
  users.forEach(user => {
    graph[user.uid] = [];
  });

  // Step 2: Draw edges between hosts and their guests
  // IMPORTANT: Only APPROVED guests get a connection line.
  // PENDING guests exist in the graph as isolated nodes (no edges).
  users.forEach(user => {
    if (user.hostId && user.hostStatus === 'APPROVED' && graph[user.hostId]) {
      // It's an undirected connection — both sides are linked
      graph[user.uid].push(user.hostId);
      graph[user.hostId].push(user.uid);
    }
  });

  // Step 3: Deduplicate (in case of duplicate entries from data inconsistencies)
  for (const uid in graph) {
    graph[uid] = Array.from(new Set(graph[uid]));
  }

  return graph;
}

/**
 * findDegreesOfSeparation():
 * The "Six Degrees" algorithm — finds how many hops it takes to get
 * from one user to another through the network.
 * 
 * INPUT: The graph (from buildNetworkGraph), a start UID, and a target UID.
 * OUTPUT: The number of hops (degrees), or null if the users are not connected.
 * 
 * ALGORITHM: Breadth-First Search (BFS)
 *   - Start at the start user (degree 0).
 *   - Visit all their direct connections (degree 1).
 *   - Then visit all connections-of-connections (degree 2).
 *   - Continue until we find the target or exhaust the graph.
 *   - Capped at 6 degrees to prevent infinite loops in large networks.
 * 
 * CALLED BY: useNetworkGraph.ts → getDegreesOfSeparation()
 * DISPLAYED BY: ConnectionBadge.tsx — shows "2° away" or "Direct Connection"
 *   on user profile cards in the Explore feed and PublicProfile.
 */
export function findDegreesOfSeparation(graph: Record<string, string[]>, startUid: string, targetUid: string): number | null {
  // Same user = 0 degrees
  if (startUid === targetUid) return 0;
  // If either user isn't in the graph, they're unreachable
  if (!graph[startUid] || !graph[targetUid]) return null;

  const queue: { uid: string, depth: number }[] = [];
  const visited = new Set<string>();

  queue.push({ uid: startUid, depth: 0 });
  visited.add(startUid);

  while (queue.length > 0) {
    const { uid, depth } = queue.shift()!;

    // If we found the target, return the distance
    if (uid === targetUid) {
      return depth;
    }

    // Safety cap: don't search beyond 6 degrees (prevents slow searches in large graphs)
    if (depth >= 6) continue;

    // Visit all neighbors
    for (const neighbor of graph[uid]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ uid: neighbor, depth: depth + 1 });
      }
    }
  }

  return null; // Not connected — the two users are in separate "islands"
}
