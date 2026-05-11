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
  setTimeout(() => {
    console.log("Timeout manually enforced...");
    process.exit(1);
  }, 10000);

  db.collection('test').limit(1).get().then(() => {
    console.log("Success connecting to default");
    process.exit(0);
  }).catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
  });
} catch(e) {
  console.error("Setup error:", e.message);
  process.exit(1);
}
