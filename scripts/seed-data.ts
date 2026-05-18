
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch, serverTimestamp, initializeFirestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

const userNames = [
  "Alice Chen", "Bob Miller", "Chloe Smith", "David Park", "Elena Rodriguez",
  "Frank Wilson", "Grace Lee", "Henry Taylor", "Isabella White", "Jack Thompson"
];

const sharedItems = ["Hammer", "Lawn Mower", "Drill", "Ladder", "Pressure Washer", "Stand Mixer", "Camping Tent"];
const needs = ["Sugar for baking", "Help moving a sofa", "recommendation for a plumber", "Plant watering"];
const bios = ["Art teacher who loves gardening.", "Software engineer with tools.", "Retiree who enjoys baking."];

async function seed() {
  const startIdx = parseInt(process.argv[2] || "0");
  const count = parseInt(process.argv[3] || "5");
  
  console.log(`🌱 Seeding users ${startIdx} to ${Math.min(startIdx + count - 1, userNames.length - 1)}`);
  console.log(`Project ID: ${firebaseConfig.projectId}`);

  const batch = writeBatch(db);
  const endIdx = Math.min(startIdx + count, userNames.length);

  console.log(`Preparing ${endIdx - startIdx} users...`);

  for (let i = startIdx; i < endIdx; i++) {
    const uid = `user_seed_${i}`;
    const userRef = doc(db, 'users', uid);
    batch.set(userRef, {
      uid,
      displayName: userNames[i],
      bio: bios[i % bios.length],
      rating: 4.8,
      reviewCount: 12,
      location: { lat: 40.7128, lng: -74.0060 },
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userNames[i]}`,
      isAdmin: false,
      isSeed: true,
      createdAt: serverTimestamp()
    });

    // Generate some comments
    const comments = i % 2 === 0 ? [{
      id: `comment_1_${uid}`,
      userId: `user_seed_${(i + 1) % 10}`,
      userName: userNames[(i + 1) % 10],
      userPhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userNames[(i + 1) % 10]}`,
      content: "This sounds great! I am interested.",
      createdAt: new Date()
    }] : [];

    const laterComments = i % 3 === 0 ? [{
      id: `comment_2_${uid}`,
      userId: `user_seed_${(i + 2) % 10}`,
      userName: userNames[(i + 2) % 10],
      userPhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userNames[(i + 2) % 10]}`,
      content: "Is this still available?",
      createdAt: new Date()
    }] : [];

    // 1 Share (Give)
    const shareRef = doc(collection(db, 'items'));
    batch.set(shareRef, {
      ownerId: uid,
      title: sharedItems[i % sharedItems.length],
      description: "Available for neighbors to borrow or use.",
      type: 'SHARE',
      status: 'ACTIVE',
      location: { lat: 40.7128, lng: -74.0060 },
      isFeatured: false,
      isSeed: true,
      images: [],
      createdAt: serverTimestamp(),
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * (i + 1)),
      comments: comments
    });

    // 1 Ask
    const askRef = doc(collection(db, 'items'));
    batch.set(askRef, {
      ownerId: uid,
      title: needs[i % needs.length],
      description: "Looking for some neighborly help with this.",
      type: 'ASK',
      status: 'ACTIVE',
      location: { lat: 40.7128, lng: -74.0060 },
      isFeatured: false,
      isSeed: true,
      images: [],
      createdAt: serverTimestamp(),
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * (i + 2)),
      comments: laterComments
    });
  }

  await batch.commit();
  console.log("✅ Batch complete");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
