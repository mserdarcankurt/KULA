const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const config = require('./firebase-applet-config.json');

try {
  let app;
  if (!getApps().length) {
    app = initializeApp({
      projectId: config.projectId,
    });
  } else {
    app = getApps()[0];
  }
  
  const db = getFirestore();
  db.settings({
    databaseId: config.firestoreDatabaseId
  });
  
  console.log("Connecting to " + config.firestoreDatabaseId + "...");
  
  async function run() {
    const usersSnapshot = await db.collection('users').get();
    console.log(`Total users in DB: ${usersSnapshot.size}`);
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`User ID: ${doc.id}`);
      console.log(`  Name: ${data.displayName}`);
      console.log(`  neighborhoodCenter:`, data.neighborhoodCenter);
      console.log(`  location:`, data.location);
      console.log(`  exactHomeLocation:`, data.exactHomeLocation);
      console.log(`  hostId: ${data.hostId}`);
    });
    
    const vouchesSnapshot = await db.collection('vouches').get();
    console.log(`Total vouches in DB: ${vouchesSnapshot.size}`);
    vouchesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Vouch ID: ${doc.id}`);
      console.log(`  fromUserId: ${data.fromUserId}`);
      console.log(`  toUserId: ${data.toUserId}`);
      console.log(`  status: ${data.status}`);
    });
    
    process.exit(0);
  }
  
  run().catch(err => {
    console.error("Run error:", err);
    process.exit(1);
  });
} catch(e) {
  console.error("Setup error:", e.message);
  process.exit(1);
}
