import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

initializeApp({ projectId: "gen-lang-client-0207804941" });
const db = getFirestore();

async function check() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} users`);
  const items = await db.collection('items').get();
  console.log(`Found ${items.size} items`);
  if (items.size > 0) {
    console.log("Sample item:", items.docs[0].data());
  }
}
check();
