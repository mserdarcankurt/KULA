import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Connect to local emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

initializeApp({
  projectId: "gen-lang-client-0207804941" // From the user's config
});

const db = getFirestore();
const auth = getAuth();

async function seed() {
  try {
    console.log("Seeding Emulator Database...");

    // Create a dummy user in Auth
    const userRecord = await auth.createUser({
      uid: 'testuser123',
      email: 'test@kula.local',
      password: 'password',
      displayName: 'Test Neighbor',
    });
    console.log("Created Auth user:", userRecord.uid);

    // Create the user profile in Firestore
    await db.collection('users').doc('testuser123').set({
      uid: 'testuser123',
      displayName: 'Test Neighbor',
      bio: 'I love helping out in the neighborhood.',
      rating: 5.0,
      reviewCount: 1,
      createdAt: new Date(),
      isAdmin: true,
      hasCompletedOnboarding: true,
      location: { lat: 52.5200, lng: 13.4050 }, // Berlin coordinates
      defaultReach: ['VICINITY'],
      joinedCircles: []
    });

    // Create a dummy Item
    await db.collection('items').doc('item123').set({
      id: 'item123',
      ownerId: 'testuser123',
      title: 'Power Drill (Bosch)',
      description: 'Happy to share my drill with anyone in the neighborhood. Comes with various bits.',
      type: 'SHARE',
      category: 'Tools',
      images: [],
      status: 'ACTIVE',
      location: { lat: 52.5210, lng: 13.4060 },
      reachTypes: ['VICINITY'],
      circleId: null,
      createdAt: new Date()
    });
    
    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (e) {
    console.error("Seeding error:", e);
    process.exit(1);
  }
}

seed();
