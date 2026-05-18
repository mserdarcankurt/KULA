/**
 * FILE: trustGraph.ts
 * ROLE IN KULA: The "Privacy Enforcer" — calculates trust distance and enforces
 * symmetric visibility between users.
 * 
 * CIRCUIT CONNECTION:
 *   This file sits at the intersection of THREE systems:
 *   1. SECURITY (firestore.rules handles server-side blocking)
 *   2. DATA (useItems.ts calls checkSymmetricVisibility to filter feed items)
 *   3. IDENTITY (UserProfile.visibilityPreference controls who can see whom)
 * 
 * WHY "SYMMETRIC"?
 *   In KULA, privacy is a two-way street. If Alice sets her visibility to "DEGREE_2",
 *   she can only see people within 2 degrees AND only people within 2 degrees can see her.
 *   This prevents the "I can stalk you but you can't see me" problem.
 * 
 * RELATIONSHIP TO OTHER FILES:
 *   - Called by: useItems.ts → to filter which items appear in the Explore feed.
 *   - Called by: PublicProfile.tsx → to check if the user can view someone's full profile.
 *   - Uses: firebase.ts → db for querying users and vouches.
 *   - Data shape: types.ts → UserProfile.visibilityPreference.
 * 
 * PERFORMANCE NOTE: This file uses a NODE CACHE to avoid re-fetching user profiles
 * during a single session. In a large network, the BFS in getDegreesOfSeparation
 * could be slow — the cache prevents N+1 query problems.
 */
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * TrustNode: A lightweight representation of a user in the trust graph.
 * We only need uid, name, and hostId — not the full UserProfile.
 */
interface TrustNode {
  uid: string;
  name: string;
  hostId?: string;
}

// In-memory cache of nodes fetched during this session.
// This prevents re-fetching the same user profile multiple times
// during a single BFS traversal.
const nodeCache: Record<string, TrustNode> = {};

/**
 * fetchNode():
 * Retrieves a single user's trust-relevant data from Firestore.
 * Results are cached in memory for the session.
 * 
 * CALLED BY: getDegreesOfSeparation() and fetchNeighbors() below.
 */
async function fetchNode(uid: string): Promise<TrustNode | null> {
  // Return from cache if we already fetched this user
  if (nodeCache[uid]) return nodeCache[uid];

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  const node = {
    uid,
    name: data.displayName || 'Neighbor',
    hostId: data.hostId
  };
  nodeCache[uid] = node;
  return node;
}

/**
 * fetchNeighbors():
 * Finds ALL users connected to a given user through:
 *   1. Their HOST (parent who invited them) — one edge UP in the tree
 *   2. Their GUESTS (people they invited) — edges DOWN in the tree
 *   3. Their VOUCHES (peer endorsements) — horizontal edges
 * 
 * This is the "expansion step" in the BFS algorithm below.
 * 
 * CRITICAL DIFFERENCE from network.ts:
 *   network.ts only considers invite edges (host/guest).
 *   This function ALSO considers vouch edges, making it more complete
 *   but also more expensive (4 Firestore queries per node).
 */
async function fetchNeighbors(uid: string): Promise<string[]> {
  const neighbors = new Set<string>();
  
  try {
    // 1. Parent: Who invited this user?
    const node = await fetchNode(uid);
    if (node?.hostId) {
      neighbors.add(node.hostId);
    }

    // 2. Children: Who did this user invite?
    const childrenQuery = query(collection(db, 'users'), where('hostId', '==', uid));
    const childrenSnap = await getDocs(childrenQuery);
    childrenSnap.forEach(d => neighbors.add(d.id));

    // 3. Vouches sent: Who did this user vouch for? (only accepted vouches count)
    const sentQuery = query(collection(db, 'vouches'), where('fromUserId', '==', uid), where('status', '==', 'ACCEPTED'));
    const sentSnap = await getDocs(sentQuery);
    sentSnap.forEach(d => neighbors.add(d.data().toUserId));

    // 4. Vouches received: Who vouched for this user?
    const receivedQuery = query(collection(db, 'vouches'), where('toUserId', '==', uid), where('status', '==', 'ACCEPTED'));
    const receivedSnap = await getDocs(receivedQuery);
    receivedSnap.forEach(d => neighbors.add(d.data().fromUserId));

  } catch (error) {
    console.error("Error fetching neighbors for", uid, error);
  }

  return Array.from(neighbors);
}

/**
 * getDegreesOfSeparation():
 * The core pathfinding function. Finds the shortest trust path between two users.
 * 
 * ALGORITHM: Breadth-First Search (BFS) with path tracking.
 *   Unlike network.ts's version, this one:
 *   1. Fetches neighbors ON DEMAND from Firestore (not from a pre-built graph)
 *   2. Returns the FULL CHAIN of names (e.g., "Alice → Bob → Carol")
 *   3. Includes the "via" shortcut (the first intermediary)
 * 
 * CALLED BY:
 *   - checkSymmetricVisibility() below (to determine if two users can see each other)
 *   - ConnectionBadge.tsx (to show "Connected via Bob" on profile cards)
 *   - ChatRoom.tsx (to show common connections in 1:1 chats)
 * 
 * PERFORMANCE: Each BFS expansion makes 4 Firestore queries (see fetchNeighbors).
 *   With maxDepth=4, worst case is 4^4 × 4 = 1024 queries. The nodeCache mitigates this
 *   significantly in practice.
 * 
 * RETURNS:
 *   { degrees: number, chain: TrustNode[], via?: string }
 *   - degrees: How many hops (null if not connected)
 *   - chain: The full path of users from A to B
 *   - via: The name of the first intermediary (for "Connected via Bob" display)
 */
export async function getDegreesOfSeparation(userAId: string, userBId: string, maxDepth: number = 4) {
  // Same person = 0 degrees
  if (userAId === userBId) return { degrees: 0, chain: [] };

  // BFS queue stores: [currentUid, pathFromA]
  const queue: [string, string[]][] = [[userAId, [userAId]]];
  const visited = new Set<string>([userAId]);

  while (queue.length > 0) {
    const [currentUid, path] = queue.shift()!;
    const currentDepth = path.length - 1;

    // Don't search deeper than maxDepth (default 4)
    if (currentDepth >= maxDepth) continue;

    // Expand: find all users connected to the current user
    const neighbors = await fetchNeighbors(currentUid);

    for (const neighborId of neighbors) {
      if (neighborId === userBId) {
        // PATH FOUND! Build the result with human-readable names.
        const fullPathIds = [...path, neighborId];
        const fullChain: TrustNode[] = [];
        
        // Resolve UIDs to names for display
        for (const id of fullPathIds) {
          const n = await fetchNode(id);
          if (n) fullChain.push(n);
        }

        return { 
          degrees: currentDepth + 1, 
          chain: fullChain,
          // The "via" field — the first person in the chain after the start user.
          // Used for display: "Connected via Bob" in ConnectionBadge.tsx
          via: fullChain.length > 2 ? fullChain[1].name : undefined
        };
      }

      // Mark as visited to prevent cycles (A→B→A→B...)
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push([neighborId, [...path, neighborId]]);
      }
    }
  }

  // No path found — these users are in separate trust islands
  return { degrees: null, chain: [] };
}

/**
 * checkSymmetricVisibility():
 * THE PRIVACY GATE. Determines whether two users should be able to see each other.
 * 
 * CALLED BY: useItems.ts → to decide if an item's owner should be visible in the feed.
 * 
 * SYMMETRY RULE:
 *   Both users must "agree" on visibility. If Alice says "only degree 2" and Bob
 *   is 3 degrees away, Alice won't see Bob AND Bob won't see Alice.
 *   This is the "mutual consent" model of community visibility.
 * 
 * PREFERENCE MAPPING:
 *   - PUBLIC: Can see everyone (distance = ∞)
 *   - NETWORK: Can see anyone in the connected graph (distance = 999, effectively ∞ within the graph)
 *   - DEGREE_4 through DEGREE_1: Can only see users within that many hops
 * 
 * FLOW:
 *   1. If both users are PUBLIC → fast return true (no BFS needed)
 *   2. Otherwise, calculate the actual degree of separation via BFS
 *   3. Check that the distance is ≤ BOTH users' maximum allowed distance
 * 
 * SECURITY NOTE: This is client-side filtering. The real security boundary is
 * firestore.rules. This function provides a BETTER user experience by hiding
 * items the user shouldn't see, rather than showing them and then failing
 * when they try to interact.
 */
export async function checkSymmetricVisibility(currentUid: string, currentPref: string, targetUid: string): Promise<boolean> {
  // You can always see yourself
  if (currentUid === targetUid) return true;

  // Fetch the target user's visibility preference
  const targetNode = await fetchNode(targetUid);
  if (!targetNode) return false;

  const targetSnap = await getDoc(doc(db, 'users', targetUid));
  const targetPref = targetSnap.exists() ? (targetSnap.data().visibilityPreference || 'PUBLIC') : 'PUBLIC';

  // FAST PATH: If both users are PUBLIC, skip the expensive BFS
  if (currentPref === 'PUBLIC' && targetPref === 'PUBLIC') return true;

  // SLOW PATH: Calculate actual trust distance
  const result = await getDegreesOfSeparation(currentUid, targetUid, 4);
  const degrees = result.degrees;

  // Convert preference strings to maximum allowed distances
  const mapPrefToMaxDegree = (pref: string) => {
    switch (pref) {
      case 'DEGREE_1': return 1;   // Direct connections only
      case 'DEGREE_2': return 2;   // Friends of friends
      case 'DEGREE_3': return 3;   // Three hops
      case 'DEGREE_4': return 4;   // Four hops (max in KULA)
      case 'NETWORK': return 999;  // Anyone in the connected graph
      case 'PUBLIC': return Infinity; // Everyone
      default: return Infinity;
    }
  };

  const myMax = mapPrefToMaxDegree(currentPref);
  const theirMax = mapPrefToMaxDegree(targetPref);

  // If there is no connection (separate islands), only PUBLIC users can see each other
  if (degrees === null) {
    return myMax === Infinity && theirMax === Infinity;
  }

  // SYMMETRIC CHECK: The distance must be ≤ BOTH users' maximum
  // This ensures neither user is "exposed" beyond their comfort level
  return degrees <= myMax && degrees <= theirMax;
}
