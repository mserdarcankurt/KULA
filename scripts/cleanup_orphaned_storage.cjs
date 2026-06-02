/**
 * FILE: scripts/cleanup_orphaned_storage.cjs
 * PURPOSE: Maintenance script to detect and delete orphaned image/video files in Firebase Storage.
 * 
 * ORPHANED FILE DEFINITION:
 * Any file under the "items/uploads/" path in Cloud Storage whose filename/URL is NOT referenced
 * in any Firestore document in the "items" collection.
 * 
 * SAFETY BUFFER:
 * We only delete files that are older than 2 hours. This prevents deleting files that are
 * currently being uploaded by users who are in the middle of writing their post.
 */
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const config = require('../firebase-applet-config.json');

if (process.argv.includes('--emulator')) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  console.log('[KULA CLEANUP] Emulator mode enabled via command line flag.');
}

try {
  let app;
  if (!getApps().length) {
    app = initializeApp({
      projectId: config.projectId,
      storageBucket: config.storageBucket
    });
  } else {
    app = getApps()[0];
  }

  const db = getFirestore();
  db.settings({
    databaseId: config.firestoreDatabaseId
  });

  const bucket = getStorage().bucket();

  async function run() {
    console.log(`[KULA CLEANUP] Starting cleanup at ${new Date().toISOString()}...`);
    console.log(`[KULA CLEANUP] Database ID: ${config.firestoreDatabaseId}`);
    console.log(`[KULA CLEANUP] Storage Bucket: ${config.storageBucket}`);

    // 1. Gather all referenced image and video URLs from Firestore items
    const itemsSnapshot = await db.collection('items').get();
    const referencedUrls = new Set();

    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (Array.isArray(data.images)) {
        data.images.forEach(url => referencedUrls.add(url));
      }
      if (Array.isArray(data.videos)) {
        data.videos.forEach(url => referencedUrls.add(url));
      }
    });

    console.log(`[KULA CLEANUP] Found ${referencedUrls.size} unique media references in Firestore.`);

    // 2. List all files under items/uploads/ in Cloud Storage
    const [files] = await bucket.getFiles({ prefix: 'items/uploads/' });
    console.log(`[KULA CLEANUP] Found ${files.length} total files in Storage under "items/uploads/".`);

    let deletedCount = 0;
    let skippedCount = 0;
    let referencedCount = 0;
    const safetyBufferMs = 2 * 60 * 60 * 1000; // 2 hours

    for (const file of files) {
      // Check if file is referenced in any Firestore document
      const fileNameEncoded = encodeURIComponent(file.name);
      let isReferenced = false;

      for (const url of referencedUrls) {
        if (url.includes(fileNameEncoded) || url.includes(file.name)) {
          isReferenced = true;
          break;
        }
      }

      if (isReferenced) {
        referencedCount++;
        continue;
      }

      // Check file age (safety buffer)
      const [metadata] = await file.getMetadata();
      const createdTime = new Date(metadata.timeCreated);
      const ageMs = Date.now() - createdTime.getTime();

      if (ageMs < safetyBufferMs) {
        console.log(`[KULA CLEANUP] Skipping young unreferenced file: ${file.name} (Age: ${(ageMs / (1000 * 60)).toFixed(1)} mins)`);
        skippedCount++;
        continue;
      }

      // Safe to delete
      console.log(`[KULA CLEANUP] Deleting orphaned file: ${file.name} (Created: ${createdTime.toISOString()}, Age: ${(ageMs / (1000 * 60 * 60)).toFixed(1)} hours)`);
      await file.delete();
      deletedCount++;
    }

    console.log(`[KULA CLEANUP] Run complete!`);
    console.log(`  Referenced files kept: ${referencedCount}`);
    console.log(`  Unreferenced files skipped (too young): ${skippedCount}`);
    console.log(`  Orphaned files deleted: ${deletedCount}`);
    process.exit(0);
  }

  run().catch(err => {
    console.error("[KULA CLEANUP] Run error:", err);
    process.exit(1);
  });
} catch (e) {
  console.error("[KULA CLEANUP] Setup error:", e.message);
  process.exit(1);
}
