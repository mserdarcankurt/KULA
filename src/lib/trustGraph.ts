import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

interface TrustNode {
  uid: string;
  name: string;
  hostId?: string;
}

const nodeCache: Record<string, TrustNode> = {};

async function fetchNode(uid: string): Promise<TrustNode | null> {
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

async function getChain(uid: string): Promise<TrustNode[]> {
  const chain: TrustNode[] = [];
  let currentUid = uid;

  while (currentUid) {
    const node = await fetchNode(currentUid);
    if (!node) break;
    chain.push(node);
    if (!node.hostId || node.hostId === currentUid) break; // Root or cycle protection
    currentUid = node.hostId;
  }

  return chain;
}

export async function getDegreesOfSeparation(userAId: string, userBId: string) {
  if (userAId === userBId) return { degrees: 0, chain: [] };

  const chainA = await getChain(userAId);
  const chainB = await getChain(userBId);

  if (chainA.length === 0 || chainB.length === 0) {
    return { degrees: null, chain: [] };
  }

  // Find lowest common ancestor
  for (let i = 0; i < chainA.length; i++) {
    const nodeA = chainA[i];
    const indexInB = chainB.findIndex(nodeB => nodeB.uid === nodeA.uid);

    if (indexInB !== -1) {
      // Common ancestor found!
      // Degree is the sum of steps to this ancestor
      // i is steps from userA to ancestor
      // indexInB is steps from userB to ancestor
      const degrees = i + indexInB;
      
      // Construct visual chain (A -> ... -> Ancestor -> ... -> B)
      // Actually often better to show the path from A's perspective: A -> Host -> ...
      const pathFromA = chainA.slice(0, i + 1);
      const pathToB = chainB.slice(0, indexInB).reverse();
      
      return { 
        degrees, 
        chain: [...pathFromA, ...pathToB],
        ancestor: nodeA.name
      };
    }
  }

  return { degrees: null, chain: [] };
}
