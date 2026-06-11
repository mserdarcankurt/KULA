/**
 * FILE: batchFetch.ts
 * ROLE IN KULA: Batched Firestore document fetching — the antidote to N+1.
 *
 * WHY THIS EXISTS:
 *   Several real-time listeners (Profile vouch inbox, ChatRoom sender names,
 *   Circles member list) used to call getDoc() once per related user — N+1
 *   sequential round trips on every snapshot. Firestore supports fetching up
 *   to 30 documents per query via where(documentId(), 'in', [...]), so this
 *   helper chunks the IDs and runs the chunks in parallel: 31 users costs
 *   2 queries instead of 31.
 *
 * USED BY: Profile.tsx, ChatRoom.tsx, Circles.tsx
 */
import { collection, query, where, getDocs, documentId, DocumentData } from 'firebase/firestore';
import { db } from './firebase';

const IN_QUERY_LIMIT = 30; // Firestore's max values per 'in' clause

/**
 * Fetch many user documents by UID in parallel chunks.
 * Returns a Map of uid → document data (missing/deleted users are absent).
 */
export async function fetchUserDocsByIds(ids: string[]): Promise<Map<string, DocumentData>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const result = new Map<string, DocumentData>();
  if (unique.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_QUERY_LIMIT) {
    chunks.push(unique.slice(i, i + IN_QUERY_LIMIT));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await getDocs(
        query(collection(db, 'users'), where(documentId(), 'in', chunk))
      );
      snap.docs.forEach((d) => result.set(d.id, d.data()));
    })
  );

  return result;
}
