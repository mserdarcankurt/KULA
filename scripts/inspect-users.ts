
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function inspect() {
  console.log("Analyzing users in Firestore...");
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total users found: ${usersSnap.size}`);
  
  let withLoc = 0;
  let withoutLoc = 0;
  usersSnap.forEach(doc => {
    const d = doc.data();
    const loc = d.neighborhoodCenter || d.location;
    if (loc) {
      withLoc++;
    } else {
      withoutLoc++;
      console.log(`User without location: UID=${doc.id}, Name=${d.displayName}, email=${d.email || 'N/A'}`);
    }
  });
  console.log(`Users with location: ${withLoc}`);
  console.log(`Users without location: ${withoutLoc}`);
  
  process.exit(0);
}

inspect().catch(e => {
  console.error(e);
  process.exit(1);
});
