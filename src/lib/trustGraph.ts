import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

interface TrustNode {
  uid: string;
  name: string;
  hostId?: string;
  hideAsConnector?: boolean;
  visibilityPreference?: string;
  neighborhoodVisibility?: string;
}

let cachedDistances: Record<string, number> | null = null;
let networkDistancesPromise: Promise<Record<string, number>> | null = null;
let currentNetworkUid: string | null = null;
const clientNodeCache = new Map<string, Promise<TrustNode | null>>();

export function clearTrustGraphCache() {
  cachedDistances = null;
  networkDistancesPromise = null;
  currentNetworkUid = null;
  clientNodeCache.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('kula_node_cache_') || key.startsWith('kula_network_distances_'))) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {
    console.error("Failed to clear localStorage keys", e);
  }
}

async function _fetchNode(uid: string): Promise<TrustNode | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid,
    name: data.displayName || 'Neighbor',
    hostId: data.hostId,
    hideAsConnector: !!data.privacySettings?.hideAsConnector,
    visibilityPreference: data.privacySettings?.profileVisibility || data.visibilityPreference || 'PUBLIC',
    neighborhoodVisibility: data.privacySettings?.neighborhoodVisibility || 'PUBLIC'
  };
}

interface CachedNode {
  node: TrustNode | null;
  timestamp: number;
}

async function fetchNode(uid: string): Promise<TrustNode | null> {
  if (clientNodeCache.has(uid)) {
    return clientNodeCache.get(uid)!;
  }

  const cacheKey = `kula_node_cache_${uid}`;
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  let cached: CachedNode | null = null;
  try {
    const localData = localStorage.getItem(cacheKey);
    if (localData) {
      cached = JSON.parse(localData);
    }
  } catch (e) {
    console.error("Failed to parse cached node from localStorage", e);
  }

  if (cached) {
    const age = now - cached.timestamp;
    
    if (age < ONE_HOUR) {
      const resolvedPromise = Promise.resolve(cached.node);
      clientNodeCache.set(uid, resolvedPromise);
      return cached.node;
    }

    if (age < TWENTY_FOUR_HOURS) {
      const resolvedPromise = Promise.resolve(cached.node);
      clientNodeCache.set(uid, resolvedPromise);

      // Background revalidation
      _fetchNode(uid).then(freshNode => {
        const freshCache: CachedNode = {
          node: freshNode,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(freshCache));
        clientNodeCache.set(uid, Promise.resolve(freshNode));
      }).catch(err => {
        console.error("Failed to background refresh node profile for uid:", uid, err);
      });

      return cached.node;
    }
  }

  const promise = _fetchNode(uid).then(node => {
    const cacheObj: CachedNode = {
      node,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
    } catch (e) {
      console.error("Failed to write to localStorage for node profile:", uid, e);
    }
    return node;
  });

  clientNodeCache.set(uid, promise);

  try {
    const result = await promise;
    return result;
  } catch (error) {
    clientNodeCache.delete(uid); // Retry next time if error
    throw error;
  }
}

export function getNetworkDistances(uid: string): Promise<Record<string, number>> {
  if (currentNetworkUid !== uid) {
    currentNetworkUid = uid;
    cachedDistances = null;
    networkDistancesPromise = null;
  }

  // If we already have the distances in memory, return immediately
  if (cachedDistances) {
    return Promise.resolve(cachedDistances);
  }

  const cacheKey = `kula_network_distances_${uid}`;
  
  // Try loading from localStorage if we don't have it in memory yet
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      cachedDistances = JSON.parse(cachedData);
    } catch (e) {
      console.error("Failed to parse cached network distances from localStorage", e);
    }
  }

  // If we have a cached copy (loaded from localStorage), return it instantly
  // but kick off a background fetch to update the cache.
  if (cachedDistances) {
    if (!networkDistancesPromise) {
      const getDistancesFn = httpsCallable<void, { distances: Record<string, number> }>(functions, 'getNetworkDistances');
      networkDistancesPromise = getDistancesFn()
        .then(result => {
          cachedDistances = result.data.distances;
          localStorage.setItem(cacheKey, JSON.stringify(cachedDistances));
          return cachedDistances;
        })
        .catch(error => {
          console.error("Error fetching network distances in background:", error);
          networkDistancesPromise = null; // Clear so it can retry next time
          return cachedDistances || { [uid]: 0 };
        });
    }
    return Promise.resolve(cachedDistances);
  }

  // If there's no cache at all, we must await the Cloud Function call
  if (!networkDistancesPromise) {
    const getDistancesFn = httpsCallable<void, { distances: Record<string, number> }>(functions, 'getNetworkDistances');
    networkDistancesPromise = getDistancesFn()
      .then(result => {
        cachedDistances = result.data.distances;
        localStorage.setItem(cacheKey, JSON.stringify(cachedDistances));
        return cachedDistances;
      })
      .catch(error => {
        console.error("Error fetching network distances:", error);
        networkDistancesPromise = null; // Reset so it can retry next time
        return { [uid]: 0 }; // Fallback: user can only see themselves
      });
  }

  return networkDistancesPromise;
}

export async function getDegreesOfSeparation(userAId: string, userBId: string, maxDepth: number = 4): Promise<{ degrees: number | null; chain: TrustNode[]; via?: string }> {
  // If we only need the distance (feed filtering), we can check the distances map.
  // But wait, some components (ConnectionBadge) need the full chain.
  // We'll call the Cloud Function for the full path.
  const getTrustPathFn = httpsCallable<{ targetUid: string; maxDepth: number }, { degrees: number | null; chain: TrustNode[]; via?: string }>(functions, 'getTrustPath');
  
  try {
    const result = await getTrustPathFn({ targetUid: userBId, maxDepth });
    return result.data;
  } catch (error) {
    console.error("Error fetching trust path:", error);
    return { degrees: null, chain: [] };
  }
}

export async function checkSymmetricVisibility(currentUid: string, currentPref: string, targetUid: string): Promise<boolean> {
  if (currentUid === targetUid) return true;

  const targetNode = await fetchNode(targetUid);
  if (!targetNode) return false;

  const targetPref = targetNode.visibilityPreference || 'PUBLIC';

  if (currentPref === 'PUBLIC' && targetPref === 'PUBLIC') return true;

  const distances = await getNetworkDistances(currentUid);
  const degrees = distances[targetUid] !== undefined ? distances[targetUid] : null;

  const mapPrefToMaxDegree = (pref: string) => {
    switch (pref) {
      case 'PRIVATE': return 0;
      case 'DEGREE_1': return 1;
      case 'DEGREE_2': return 2;
      case 'DEGREE_3': return 3;
      case 'DEGREE_4': return 4;
      case 'NETWORK': return 999;
      case 'PUBLIC': return Infinity;
      default: return Infinity;
    }
  };

  const myMax = mapPrefToMaxDegree(currentPref);
  const theirMax = mapPrefToMaxDegree(targetPref);

  if (degrees === null) {
    return myMax === Infinity && theirMax === Infinity;
  }

  return degrees <= myMax && degrees <= theirMax;
}

export async function checkItemVisibility(viewerUid: string, viewerPref: string, item: any): Promise<boolean> {
  if (viewerUid === item.ownerId) return true;

  const passesProfileVis = await checkSymmetricVisibility(viewerUid, viewerPref, item.ownerId);
  if (!passesProfileVis) return false;

  const reach = item.visibilityReach || 'PUBLIC';
  if (reach === 'PUBLIC') return true;
  if (reach === 'PRIVATE') return false;

  const distances = await getNetworkDistances(viewerUid);
  const degrees = distances[item.ownerId] !== undefined ? distances[item.ownerId] : null;
  if (degrees === null) return false;

  const mapReachToMaxDegree = (r: string) => {
    switch (r) {
      case 'DEGREE_1': return 1;
      case 'DEGREE_2': return 2;
      case 'DEGREE_3': return 3;
      case 'DEGREE_4': return 4;
      default: return Infinity;
    }
  };

  return degrees <= mapReachToMaxDegree(reach);
}

export async function checkNeighborhoodVisibility(viewerUid: string, targetUid: string): Promise<boolean> {
  if (viewerUid === targetUid) return true;

  const targetNode = await fetchNode(targetUid);
  if (!targetNode) return false;
  
  const pref = targetNode.neighborhoodVisibility || 'PUBLIC';
  if (pref === 'PUBLIC') return true;
  if (pref === 'PRIVATE') return false;

  const distances = await getNetworkDistances(viewerUid);
  const degrees = distances[targetUid] !== undefined ? distances[targetUid] : null;
  if (degrees === null) return false;

  const mapPrefToMaxDegree = (p: string) => {
    switch (p) {
      case 'DEGREE_1': return 1;
      case 'DEGREE_2': return 2;
      case 'DEGREE_3': return 3;
      case 'DEGREE_4': return 4;
      default: return Infinity;
    }
  };

  return degrees <= mapPrefToMaxDegree(pref);
}
