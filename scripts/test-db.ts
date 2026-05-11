
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(firebaseConfig);

async function test() {
  console.log("Testing (default) database...");
  try {
    const dbDefault = getFirestore(app);
    await setDoc(doc(dbDefault, 'users', 'test_default'), { test: true });
    console.log("✅ Success on (default)");
  } catch (e) {
    console.error("❌ Failed on (default):", e);
  }

  console.log("\nTesting custom database:", firebaseConfig.firestoreDatabaseId);
  try {
    const dbCustom = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    await setDoc(doc(dbCustom, 'users', 'test_custom'), { test: true });
    console.log("✅ Success on custom");
  } catch (e) {
    console.error("❌ Failed on custom:", e);
  }
}

test();
