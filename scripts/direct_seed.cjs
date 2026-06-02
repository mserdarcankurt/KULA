const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const config = require('../firebase-applet-config.json');

// Import seed data from compiled functions
const { profiles, circles, circleMemberships, inviteChain, mosaicData, gratitudeNotes, seedVouches } = require('../functions/lib/seedProfiles');
const { items1 } = require('../functions/lib/seedItems1');
const { items2 } = require('../functions/lib/seedItems2');

// Simple batch helper
class BatchManager {
  constructor(db) {
    this.db = db;
    this.batch = db.batch();
    this.count = 0;
  }
  async set(ref, data, options) {
    this.batch.set(ref, data, options);
    this.count++;
    if (this.count >= 400) {
      await this.commit();
    }
  }
  async delete(ref) {
    this.batch.delete(ref);
    this.count++;
    if (this.count >= 400) {
      await this.commit();
    }
  }
  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = this.db.batch();
      this.count = 0;
    }
  }
}

async function run() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }

  if (!getApps().length) {
    initializeApp({
      projectId: config.projectId,
    });
  }

  const db = getFirestore();
  const targetDbId = process.env.FIRESTORE_EMULATOR_HOST ? '(default)' : config.firestoreDatabaseId;
  db.settings({
    databaseId: targetDbId
  });

  const callerUid = process.argv[2] || 'yepHDW8RlIkFEvZwFDc0FigrInl8'; // Try default from local test log
  const loc = { lat: 52.5200, lng: 13.4050 };

  console.log(`Seeding database "${config.firestoreDatabaseId}" with caller UID: ${callerUid}...`);

  const bm = new BatchManager(db);

  // 1. WIPE CURRENT DATA
  const testUserIds = profiles.map(p => p.uid);
  const testCircleIds = circles.map(c => c.id);

  async function wipeDoc(ref, col) {
    if (col === 'circles') {
      const members = await ref.collection('members').get();
      for (const m of members.docs) await bm.delete(m.ref);
    }
    if (col === 'items') {
      const comments = await ref.collection('comments').get();
      for (const c of comments.docs) await bm.delete(c.ref);
    }
    await bm.delete(ref);
  }

  // A) Delete by isTest flag
  for (const col of ['users', 'items', 'circles', 'gratitude_notes', 'vouches']) {
    const snap = await db.collection(col).where('isTest', '==', true).get();
    for (const docSnap of snap.docs) {
      if (col === 'users' && docSnap.id === callerUid) continue;
      await wipeDoc(docSnap.ref, col);
    }
  }

  // B) Delete items owned by test users
  for (const uid of testUserIds) {
    const snap = await db.collection('items').where('ownerId', '==', uid).get();
    for (const docSnap of snap.docs) await wipeDoc(docSnap.ref, 'items');
  }

  // C) Delete known circles
  for (const cid of testCircleIds) {
    const ref = db.collection('circles').doc(cid);
    const snap = await ref.get();
    if (snap.exists) await wipeDoc(ref, 'circles');
  }

  await bm.commit();
  console.log("Wipe completed. Writing fresh seed data...");

  // 2. SEED USERS
  for (const p of profiles) {
    const hostId = inviteChain[p.uid] === "CALLER" ? callerUid : inviteChain[p.uid];
    await bm.set(db.collection('users').doc(p.uid), {
      ...p,
      isTest: true,
      isAdmin: false,
      hasCompletedOnboarding: true,
      location: { lat: loc.lat + (Math.random() - 0.5) * 0.02, lng: loc.lng + (Math.random() - 0.5) * 0.02 },
      joinedCircles: circleMemberships[p.uid] || [],
      trustMosaic: mosaicData[p.uid],
      hostId: hostId,
      hostStatus: 'APPROVED',
      visibilityPreference: 'PUBLIC',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 3. SEED VOUCHES
  for (let i = 0; i < seedVouches.length; i++) {
    const v = seedVouches[i];
    const vouchId = `seed_vouch_${i}`;
    await bm.set(db.collection('vouches').doc(vouchId), {
      id: vouchId,
      isTest: true,
      fromUserId: v.from,
      toUserId: v.to,
      status: 'ACCEPTED',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 4. SEED CIRCLES
  for (const c of circles) {
    await bm.set(db.collection('circles').doc(c.id), {
      ...c,
      isTest: true,
      creatorId: c.creator,
      memberCount: circleMemberships ? Object.values(circleMemberships).filter(m => m.includes(c.id)).length : 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 5. SEED CIRCLE MEMBERSHIPS (subcollection)
  for (const [uid, circleIds] of Object.entries(circleMemberships)) {
    for (const cid of circleIds) {
      await bm.set(db.collection('circles').doc(cid).collection('members').doc(uid), {
        joinedAt: FieldValue.serverTimestamp(),
        isTest: true
      });
    }
  }

  // 6. SEED ITEMS & COMMENTS
  const allItems = [...items1, ...items2];
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const itemId = `seed_item_${i}`;
    const itemRef = db.collection('items').doc(itemId);
    const owner = profiles.find(p => p.uid === item.owner);

    await bm.set(itemRef, {
      id: itemId,
      isTest: true,
      title: item.title,
      description: item.desc,
      type: item.type,
      category: item.cat,
      ownerId: item.owner,
      ownerName: owner?.displayName || 'Neighbor',
      ownerPhoto: owner?.photoURL || null,
      location: { lat: loc.lat + (Math.random() - 0.5) * 0.03, lng: loc.lng + (Math.random() - 0.5) * 0.03 },
      status: 'ACTIVE',
      images: item.img ? [item.img] : [],
      reachTypes: ['VICINITY'],
      circleId: item.circleId || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (item.comments) {
      for (let ci = 0; ci < item.comments.length; ci++) {
        const comment = item.comments[ci];
        const commentId = `comment_${i}_${ci}`;
        const commenter = profiles.find(p => p.uid === comment.uid);
        await bm.set(itemRef.collection('comments').doc(commentId), {
          id: commentId,
          isTest: true,
          userId: comment.uid,
          userName: commenter?.displayName || 'Neighbor',
          userPhoto: commenter?.photoURL || null,
          text: comment.text,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }
  }

  // 7. GRATITUDE NOTES
  for (let i = 0; i < gratitudeNotes.length; i++) {
    const note = gratitudeNotes[i];
    const from = profiles.find(p => p.uid === note.from);
    await bm.set(db.collection('gratitude_notes').doc(`gn_${i}`), {
      id: `gn_${i}`,
      isTest: true,
      fromUserId: note.from,
      fromUserName: from?.displayName || 'Neighbor',
      fromUserPhoto: from?.photoURL || null,
      toUserId: note.to,
      itemTitle: note.itemTitle,
      text: note.text,
      createdAt: FieldValue.serverTimestamp()
    });
  }

  // 8. ADMIN SELF-FIX FOR CALLER
  await bm.set(db.collection('users').doc(callerUid), {
    uid: callerUid,
    hasCompletedOnboarding: true,
    hostStatus: 'APPROVED',
    isAdmin: true,
  }, { merge: true });

  await bm.commit();
  console.log("Database seeded successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
