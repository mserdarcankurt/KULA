import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({ projectId: config.projectId });
const db = getFirestore(config.firestoreDatabaseId || "(default)");

async function wipeAndSeed() {
  const items = await db.collection('items').get();
  
  if (items.docs.length > 0) {
    const batch = db.batch();
    items.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log("Wiped " + items.docs.length + " items.");
  }
}
wipeAndSeed().catch(console.error);
