import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from 'firebase-admin';
import { getDb } from "./utils";

/**
 * archiveExpiredItems:
 * Runs every day at 3:00 AM UTC.
 * Scans the `items` collection for items that are ACTIVE and:
 * - have an explicit `expiresAt` date that is now in the past
 * - OR have no `expiresAt` but were created over 30 days ago.
 * Updates their status to 'ARCHIVED'.
 */
export const archiveExpiredItems = onSchedule("0 3 * * *", async (event) => {
  const db = getDb();
  const now = admin.firestore.Timestamp.now();
  
  // 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

  try {
    const itemsRef = db.collection('items');
    
    // We cannot do a complex OR query easily in Firestore, so we fetch all ACTIVE items
    // and process them. If the database gets extremely large, this may need optimization
    // (e.g. keeping an indexed `computedExpirationDate` field), but for now, fetching ACTIVE items is fine.
    
    const activeItemsQuery = itemsRef.where('status', '==', 'ACTIVE');
    const snapshot = await activeItemsQuery.get();

    if (snapshot.empty) {
      console.log('No active items to process.');
      return;
    }

    const batch = db.batch();
    let archiveCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      let shouldArchive = false;

      if (data.expiresAt) {
        // Explicit expiration
        if (data.expiresAt.toMillis() < now.toMillis()) {
          shouldArchive = true;
        }
      } else if (data.createdAt) {
        // Fallback 30-day expiration
        if (data.createdAt.toMillis() < thirtyDaysAgoTimestamp.toMillis()) {
          shouldArchive = true;
        }
      }

      if (shouldArchive) {
        batch.update(doc.ref, { status: 'ARCHIVED' });
        archiveCount++;
      }
    });

    if (archiveCount > 0) {
      // Firebase limits batches to 500 operations.
      // If we expect >500 expirations per day, we would need to chunk this array.
      // For a daily cron job, assuming normal volume, a single batch is usually enough.
      // Let's be safe and chunk it just in case.
      const docsToArchive = snapshot.docs.filter((doc) => {
        const data = doc.data();
        if (data.expiresAt) return data.expiresAt.toMillis() < now.toMillis();
        if (data.createdAt) return data.createdAt.toMillis() < thirtyDaysAgoTimestamp.toMillis();
        return false;
      });

      console.log(`Found ${docsToArchive.length} items to archive.`);

      // Process in chunks of 500
      const CHUNK_SIZE = 500;
      for (let i = 0; i < docsToArchive.length; i += CHUNK_SIZE) {
        const chunk = docsToArchive.slice(i, i + CHUNK_SIZE);
        const chunkBatch = db.batch();
        chunk.forEach(doc => {
          chunkBatch.update(doc.ref, { status: 'ARCHIVED' });
        });
        await chunkBatch.commit();
        console.log(`Committed batch of ${chunk.length} items.`);
      }

      console.log(`Successfully archived ${docsToArchive.length} items.`);
    } else {
      console.log('No items needed archiving today.');
    }

  } catch (error) {
    console.error('Error archiving expired items:', error);
  }
});
