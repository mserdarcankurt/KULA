
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function clear() {
  console.log("🧹 Clearing old seed data...");
  
  // 1. Delete items owned by seeded users or marked as seed
  const itemsRef = collection(db, 'items');
  const itemsQuery = query(itemsRef, where('isSeed', '==', true));
  const itemsSnap = await getDocs(itemsQuery);
  const itemBatch = writeBatch(db);
  let itemCount = 0;
  
  itemsSnap.forEach((d) => {
    itemBatch.delete(d.ref);
    itemCount++;
  });
  
  if (itemCount > 0) {
    await itemBatch.commit();
    console.log(`Deleted ${itemCount} seed items.`);
  }

  // 2. Delete seeded user profiles
  const usersRef = collection(db, 'users');
  const usersQuery = query(usersRef, where('isSeed', '==', true));
  const usersSnap = await getDocs(usersQuery);
  const userBatch = writeBatch(db);
  let userCount = 0;
  
  usersSnap.forEach((d) => {
    userBatch.delete(d.ref);
    userCount++;
  });

  if (userCount > 0) {
    await userBatch.commit();
    console.log(`Deleted ${userCount} seed users.`);
  }

  console.log("✨ Done clearing.");
  process.exit(0);
}

clear().catch((e) => {
  console.error(e);
  process.exit(1);
});
