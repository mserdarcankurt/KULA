
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, query, limit } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Load config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Initialize Client SDK (uses API Key, no service account needed)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function deleteCollection(collectionName: string) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  
  if (snapshot.empty) {
    console.log(`Collection ${collectionName} is already empty.`);
    return;
  }

  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`✅ Deleted ${snapshot.size} documents from ${collectionName}.`);
}

async function nuclearReset() {
  console.log("\n☢️  NUCLEAR DATA RESET INITIATED ☢️");
  console.log("This will delete ALL documents in Firestore.");
  console.log("Note: Authentication accounts will remain in Firebase Auth, but");
  console.log("since their profiles are being deleted, they will be treated as");
  console.log("brand new users the next time they sign in.\n");
  
  console.log(`Project: ${firebaseConfig.projectId}`);
  console.log(`Database: ${firebaseConfig.firestoreDatabaseId || '(default)'}\n`);

  rl.question("Are you ABSOLUTELY sure? Type 'YES' to continue: ", async (answer) => {
    if (answer !== 'YES') {
      console.log("Aborted.");
      process.exit(0);
    }

    try {
      const collections = ['users', 'items', 'chats', 'swipes', 'reviews', 'notifications', 'circles'];
      
      for (const coll of collections) {
        process.stdout.write(`Clearing ${coll}... `);
        await deleteCollection(coll);
      }

      console.log("\n✨ DATA RESET COMPLETE.");
      console.log("The Firestore is now clean.");
      console.log("Next steps:");
      console.log("1. If you want to delete the actual logins, please do so in the Firebase Console.");
      console.log("2. Sign in to the app to create your new profile.");
      console.log("3. Use code 'KULA-FOUNDER' to regain admin rights.");
      
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Reset failed:", error);
      process.exit(1);
    }
  });
}

nuclearReset();
