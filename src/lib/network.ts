import { UserProfile } from '../types';

export function buildNetworkGraph(users: UserProfile[]) {
  // Graph where keys are UIDs and values are arrays of connected UIDs
  const graph: Record<string, string[]> = {};

  // Initialize graph nodes
  users.forEach(user => {
    graph[user.uid] = [];
  });

  // Populate edges
  users.forEach(user => {
    if (user.hostId && user.hostStatus === 'APPROVED' && graph[user.hostId]) {
      // It's an undirected connection
      graph[user.uid].push(user.hostId);
      graph[user.hostId].push(user.uid);
    }
  });

  // Remove duplicates just in case
  for (const uid in graph) {
    graph[uid] = Array.from(new Set(graph[uid]));
  }

  return graph;
}

export function findDegreesOfSeparation(graph: Record<string, string[]>, startUid: string, targetUid: string): number | null {
  if (startUid === targetUid) return 0;
  if (!graph[startUid] || !graph[targetUid]) return null;

  const queue: { uid: string, depth: number }[] = [];
  const visited = new Set<string>();

  queue.push({ uid: startUid, depth: 0 });
  visited.add(startUid);

  while (queue.length > 0) {
    const { uid, depth } = queue.shift()!;

    if (uid === targetUid) {
      return depth;
    }

    // Limit to reasonable degrees of separation (e.g. 6 degrees to avoid long searches)
    if (depth >= 6) continue;

    for (const neighbor of graph[uid]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ uid: neighbor, depth: depth + 1 });
      }
    }
  }

  return null; // Not connected
}
