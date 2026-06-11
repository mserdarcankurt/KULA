import { onCall } from "firebase-functions/v2/https";
import { getDb } from "./utils";

interface TrustNode {
  uid: string;
  name: string;
  hostId?: string;
  hideAsConnector?: boolean;
  visibilityPreference?: string;
  neighborhoodVisibility?: string;
}

let globalAdjacencyCache: {
  userMap: Map<string, any>;
  adjacency: Map<string, Set<string>>;
} | null = null;
let lastAdjacencyUpdate = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function buildGlobalAdjacency(db: FirebaseFirestore.Firestore) {
  if (globalAdjacencyCache && Date.now() - lastAdjacencyUpdate < CACHE_TTL_MS) {
    return globalAdjacencyCache;
  }

  const [usersSnap, vouchesSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('vouches').where('status', '==', 'ACCEPTED').get()
  ]);

  const userMap = new Map<string, any>();
  usersSnap.forEach(doc => {
    userMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  userMap.forEach((profile, uid) => {
    if (profile.hostId && userMap.has(profile.hostId)) {
      addEdge(uid, profile.hostId);
    }
  });

  vouchesSnap.forEach(doc => {
    const v = doc.data();
    if (userMap.has(v.fromUserId) && userMap.has(v.toUserId)) {
      addEdge(v.fromUserId, v.toUserId);
    }
  });

  const result = { userMap, adjacency };
  globalAdjacencyCache = result;
  lastAdjacencyUpdate = Date.now();
  return result;
}

export const getNetworkDistances = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    return { distances: {} };
  }

  const db = getDb();
  const maxDepth = 4;
  
  const { adjacency } = await buildGlobalAdjacency(db);

  const distances: Record<string, number> = {};
  distances[callerUid] = 0;

  const queue: { uid: string; depth: number }[] = [{ uid: callerUid, depth: 0 }];
  const visited = new Set<string>([callerUid]);

  while (queue.length > 0) {
    const { uid, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const neighbors = adjacency.get(uid);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        distances[neighborId] = depth + 1;
        queue.push({ uid: neighborId, depth: depth + 1 });
      }
    }
  }

  return { distances };
});

export const getTrustPath = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    return { degrees: null, chain: [], via: undefined };
  }

  const { targetUid, maxDepth: requestedDepth = 4 } = request.data as { targetUid: string; maxDepth?: number };
  if (!targetUid || typeof targetUid !== 'string' || targetUid.length > 128) {
    throw new Error("invalid-argument: missing targetUid");
  }
  // Server-side clamp: clients must not be able to traverse the whole graph.
  const maxDepth = Math.min(Math.max(Number(requestedDepth) || 4, 1), 4);

  const db = getDb();

  if (callerUid === targetUid) {
    return { degrees: 0, chain: [], via: undefined };
  }
  
  const { userMap, adjacency } = await buildGlobalAdjacency(db);

  const queue: { uid: string; path: string[] }[] = [{ uid: callerUid, path: [callerUid] }];
  const visited = new Set<string>([callerUid]);

  while (queue.length > 0) {
    const { uid, path } = queue.shift()!;
    const currentDepth = path.length - 1;

    if (currentDepth >= maxDepth) continue;

    const neighbors = adjacency.get(uid);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      if (neighborId === targetUid) {
        const fullPathIds = [...path, neighborId];
        const fullChain: TrustNode[] = [];

        for (let i = 0; i < fullPathIds.length; i++) {
          const id = fullPathIds[i];
          const nData = userMap.get(id);
          if (nData) {
            const isIntermediate = i > 0 && i < fullPathIds.length - 1;
            const hideAsConnector = !!nData.privacySettings?.hideAsConnector;
            const name = nData.displayName || 'Neighbor';
            
            fullChain.push({
              uid: id,
              name: (isIntermediate && hideAsConnector) ? 'Hidden' : name,
              hostId: nData.hostId,
              hideAsConnector: hideAsConnector,
              visibilityPreference: nData.privacySettings?.profileVisibility || nData.visibilityPreference || 'PUBLIC',
              neighborhoodVisibility: nData.privacySettings?.neighborhoodVisibility || 'PUBLIC'
            });
          }
        }

        return {
          degrees: currentDepth + 1,
          chain: fullChain,
          via: fullChain.length > 2 ? fullChain[1].name : undefined
        };
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ uid: neighborId, path: [...path, neighborId] });
      }
    }
  }

  return { degrees: null, chain: [], via: undefined };
});

export const getNetworkGraph = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    return { nodes: [], links: [], lineageIds: [] };
  }

  const { maxDepth: requestedDepth = 4 } = request.data as { maxDepth?: number } || {};
  // Server-side clamp: clients must not be able to traverse the whole graph.
  const maxDepth = Math.min(Math.max(Number(requestedDepth) || 4, 1), 4);
  const db = getDb();

  // 1. Fetch all users and accepted vouches
  // Note: For a very large scale app, this would need to be replaced with a localized crawl.
  // For KULA's neighborhood scale, a server-side bulk fetch is extremely fast compared to a client doing it.
  const { userMap, adjacency } = await buildGlobalAdjacency(db);

  // 3. BFS to maxDepth
  const visited = new Map<string, number>();
  const queue: [string, number][] = [[callerUid, 0]];
  visited.set(callerUid, 0);

  while (queue.length > 0) {
    const [currentUid, currentDegree] = queue.shift()!;
    if (currentDegree >= maxDepth) continue;

    const neighbors = adjacency.get(currentUid);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.set(neighborId, currentDegree + 1);
        queue.push([neighborId, currentDegree + 1]);
      }
    }
  }

  // Helper to normalize coordinates
  const safeCoords = (loc: any) => {
    if (!loc) return undefined;
    if (typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)) return { lat: loc.lat, lng: loc.lng };
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude) && !isNaN(loc.longitude)) return { lat: loc.latitude, lng: loc.longitude };
    const latVal = parseFloat(loc.lat ?? loc.latitude);
    const lngVal = parseFloat(loc.lng ?? loc.longitude);
    if (!isNaN(latVal) && !isNaN(lngVal)) return { lat: latVal, lng: lngVal };
    return undefined;
  };

  // 4. Format Nodes
  const nodes: any[] = [];
  for (const [uid, degree] of visited) {
    const profile = userMap.get(uid);
    if (!profile) continue;

    nodes.push({
      id: uid,
      name: profile.displayName || 'Neighbor',
      photo: profile.photoURL || null,
      degree,
      isOrganization: profile.isOrganization || false,
      visibilityPreference: profile.visibilityPreference || 'PUBLIC',
      neighborhoodCenter: safeCoords(profile.neighborhoodCenter) || safeCoords(profile.location),
    });
  }

  // 5. Build Links
  const visibleIds = new Set(visited.keys());
  const links: any[] = [];
  const linkSet = new Set<string>();

  userMap.forEach((profile, uid) => {
    if (visibleIds.has(uid)) {
      if (profile?.hostId && visibleIds.has(profile.hostId)) {
        const key = [uid, profile.hostId].sort().join('::');
        if (!linkSet.has(key)) {
          linkSet.add(key);
          links.push({ source: profile.hostId, target: uid, type: 'INVITE' });
        }
      }
    }
  });

  // Since we don't have vouchesSnap directly, we can iterate over adjacency
  // However, adjacency includes both invite and vouch edges. 
  // We can just add all visible edges as VOUCH if they aren't already INVITE.
  for (const uid of visibleIds) {
    const neighbors = adjacency.get(uid);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (visibleIds.has(neighbor)) {
          const key = [uid, neighbor].sort().join('::');
          if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({ source: uid, target: neighbor, type: 'VOUCH' });
          }
        }
      }
    }
  }

  // 6. Compute Lineage
  const lineageIds = new Set<string>();
  lineageIds.add(callerUid);

  let currentHost = userMap.get(callerUid)?.hostId;
  for (let i = 0; i < 2; i++) {
    if (currentHost && userMap.has(currentHost)) {
      lineageIds.add(currentHost);
      currentHost = userMap.get(currentHost)?.hostId;
    } else {
      break;
    }
  }

  const downQueue: [string, number][] = [[callerUid, 0]];
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

  for (const lid of lineageIds) {
    if (!visited.has(lid)) {
      const profile = userMap.get(lid);
      if (profile) {
        nodes.push({
          id: lid,
          name: profile.displayName || 'Neighbor',
          photo: profile.photoURL || null,
          degree: 0,
          isOrganization: profile.isOrganization || false,
          visibilityPreference: profile.visibilityPreference || 'PUBLIC',
          neighborhoodCenter: safeCoords(profile.neighborhoodCenter) || safeCoords(profile.location),
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

  return { nodes, links, lineageIds: Array.from(lineageIds) };
});
