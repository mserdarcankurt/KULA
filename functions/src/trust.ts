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

/**
 * The graph STRUCTURE only needs two things: vouch edges (from/to pairs)
 * and host edges (each user's hostId). Both queries below are field-masked
 * with select(), so memory and bandwidth stay tiny even as the community
 * grows — the old version loaded EVERY FIELD of EVERY user doc into the
 * function instance. Full profiles are hydrated separately (fetchProfiles)
 * only for the handful of nodes that actually appear in a response.
 */
let globalAdjacencyCache: {
  adjacency: Map<string, Set<string>>;
  hostMap: Map<string, string | undefined>;
} | null = null;
let lastAdjacencyUpdate = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function buildGlobalAdjacency(db: FirebaseFirestore.Firestore) {
  if (globalAdjacencyCache && Date.now() - lastAdjacencyUpdate < CACHE_TTL_MS) {
    return globalAdjacencyCache;
  }

  const [usersSnap, vouchesSnap] = await Promise.all([
    db.collection('users').select('hostId').get(),
    db.collection('vouches').where('status', '==', 'ACCEPTED').select('fromUserId', 'toUserId').get()
  ]);

  // uid → hostId (undefined when none). Keys double as the existing-user set.
  const hostMap = new Map<string, string | undefined>();
  usersSnap.forEach(doc => {
    hostMap.set(doc.id, doc.get('hostId') || undefined);
  });

  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  hostMap.forEach((hostId, uid) => {
    if (hostId && hostMap.has(hostId)) {
      addEdge(uid, hostId);
    }
  });

  vouchesSnap.forEach(doc => {
    const v = doc.data();
    if (hostMap.has(v.fromUserId) && hostMap.has(v.toUserId)) {
      addEdge(v.fromUserId, v.toUserId);
    }
  });

  const result = { adjacency, hostMap };
  globalAdjacencyCache = result;
  lastAdjacencyUpdate = Date.now();
  return result;
}

/** Hydrate full profile docs for ONLY the uids that appear in a response. */
async function fetchProfiles(
  db: FirebaseFirestore.Firestore,
  uids: Iterable<string>
): Promise<Map<string, any>> {
  const unique = [...new Set(uids)];
  const profiles = new Map<string, any>();
  if (unique.length === 0) return profiles;

  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const refs = unique.slice(i, i + CHUNK).map(uid => db.collection('users').doc(uid));
    const snaps = await db.getAll(...refs);
    snaps.forEach(snap => {
      if (snap.exists) profiles.set(snap.id, snap.data());
    });
  }
  return profiles;
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
  
  const { adjacency } = await buildGlobalAdjacency(db);

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
        // Hydrate full profiles only for the few nodes on the found path.
        const pathProfiles = await fetchProfiles(db, fullPathIds);
        const fullChain: TrustNode[] = [];

        for (let i = 0; i < fullPathIds.length; i++) {
          const id = fullPathIds[i];
          const nData = pathProfiles.get(id);
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

  // 1. Build the graph structure (field-masked: vouch pairs + hostIds only)
  const { adjacency, hostMap } = await buildGlobalAdjacency(db);

  // 2. BFS to maxDepth
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

  // 3. Compute lineage IDs from hostMap BEFORE hydrating profiles, so one
  // batched fetch covers every node the response will contain.
  const lineageIds = new Set<string>();
  lineageIds.add(callerUid);

  let currentHost = hostMap.get(callerUid);
  for (let i = 0; i < 2; i++) {
    if (currentHost && hostMap.has(currentHost)) {
      lineageIds.add(currentHost);
      currentHost = hostMap.get(currentHost);
    } else {
      break;
    }
  }

  const hostToGuests = new Map<string, string[]>();
  hostMap.forEach((hostId, uid) => {
    if (hostId) {
      if (!hostToGuests.has(hostId)) hostToGuests.set(hostId, []);
      hostToGuests.get(hostId)!.push(uid);
    }
  });

  const downQueue: [string, number][] = [[callerUid, 0]];
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

  // 4. Hydrate full profiles ONLY for nodes in the response (visited ∪ lineage)
  const userMap = await fetchProfiles(db, [...visited.keys(), ...lineageIds]);

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

  // 5. Build Links (host edges come from hostMap — INVITE beats VOUCH)
  const visibleIds = new Set(visited.keys());
  const links: any[] = [];
  const linkSet = new Set<string>();

  hostMap.forEach((hostId, uid) => {
    if (visibleIds.has(uid)) {
      if (hostId && visibleIds.has(hostId)) {
        const key = [uid, hostId].sort().join('::');
        if (!linkSet.has(key)) {
          linkSet.add(key);
          links.push({ source: hostId, target: uid, type: 'INVITE' });
        }
      }
    }
  });

  // Adjacency includes both invite and vouch edges; any visible edge not
  // already added as INVITE is a VOUCH edge.
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

  // 6. Lineage nodes (IDs were computed before hydration in step 3)
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
