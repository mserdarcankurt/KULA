import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { profiles, circles, circleMemberships, inviteChain, mosaicData, gratitudeNotes, seedVouches } from "./seedProfiles";
import { items1 } from "./seedItems1";
import { items2 } from "./seedItems2";

admin.initializeApp();

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const isDevMode = isEmulator || process.env.NODE_ENV === 'development';
const databaseId = isDevMode ? '(default)' : 'kulasharingapp';
const db = getFirestore(databaseId);

class BatchManager {
  private batch = db.batch();
  private count = 0;

  async set(ref: admin.firestore.DocumentReference, data: any, options?: admin.firestore.SetOptions) {
    if (options) {
      this.batch.set(ref, data, options);
    } else {
      this.batch.set(ref, data);
    }
    this.count++;
    if (this.count >= 400) await this.commit();
  }

  async delete(ref: admin.firestore.DocumentReference) {
    this.batch.delete(ref);
    this.count++;
    if (this.count >= 400) await this.commit();
  }

  async commit() {
    if (this.count > 0) {
      await this.batch.commit();
      this.batch = db.batch();
      this.count = 0;
    }
  }
}

export const seed = onRequest({ timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    let callerUid: string;
    if (isDevMode) {
      callerUid = req.body?.callerUid || req.body?.userId || 'dev_user';
    } else {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const decodedToken = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
      callerUid = decodedToken.uid;

      // SECURITY: Only admins can invoke the seed endpoint in production
      const callerProfile = await db.collection('users').doc(callerUid).get();
      if (!callerProfile.exists || !callerProfile.data()?.isAdmin) {
        res.status(403).json({ error: "Forbidden: admin access required" });
        return;
      }
    }

    const bm = new BatchManager();
    const { baseLocation } = req.body;
    const loc = baseLocation || { lat: 52.5200, lng: 13.4050 };

    // 1. SURGICAL WIPE — by isTest/isSeed flags, known IDs, and ownership
    const testUserIds = profiles.map(p => p.uid);
    const testCircleIds = circles.map(c => c.id);

    // Helper to delete a doc and its subcollections
    async function wipeDoc(ref: admin.firestore.DocumentReference, col: string) {
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

    // A) Delete by isTest flag (current-gen test data)
    for (const col of ['users', 'items', 'circles', 'gratitude_notes', 'vouches']) {
      const snap = await db.collection(col).where('isTest', '==', true).get();
      for (const docSnap of snap.docs) {
        if (col === 'users' && docSnap.id === callerUid) continue;
        await wipeDoc(docSnap.ref, col);
      }
    }

    // B) Delete by isSeed flag (older-gen test data)
    const seedSnap = await db.collection('items').where('isSeed', '==', true).get();
    for (const docSnap of seedSnap.docs) await wipeDoc(docSnap.ref, 'items');

    // C) Delete by known test IDs (legacy data without any flag)
    for (const uid of testUserIds) {
      const ref = db.collection('users').doc(uid);
      const snap = await ref.get();
      if (snap.exists) await wipeDoc(ref, 'users');
    }
    for (const cid of testCircleIds) {
      const ref = db.collection('circles').doc(cid);
      const snap = await ref.get();
      if (snap.exists) await wipeDoc(ref, 'circles');
    }

    // D) Delete items owned by test users (catches everything regardless of flags)
    for (const uid of testUserIds) {
      const snap = await db.collection('items').where('ownerId', '==', uid).get();
      for (const docSnap of snap.docs) await wipeDoc(docSnap.ref, 'items');
    }

    // E) Wipe swipes referencing test users
    const swipeSnap = await db.collection('swipes').get();
    for (const docSnap of swipeSnap.docs) {
      const data = docSnap.data();
      if (testUserIds.includes(data.ownerId) || data.itemId?.startsWith('seed_item_')) {
        await bm.delete(docSnap.ref);
      }
    }

    // F) Clean caller's stale circle memberships (keep real, remove test)
    const callerDoc = await db.collection('users').doc(callerUid).get();
    if (callerDoc.exists) {
      const currentCircles: string[] = callerDoc.data()?.joinedCircles || [];
      const realCircles = currentCircles.filter(id => !testCircleIds.includes(id));
      await db.collection('users').doc(callerUid).update({ joinedCircles: realCircles }).catch(() => {});
    }
    // Also remove caller from test circle member subcollections
    for (const cid of testCircleIds) {
      await bm.delete(db.collection('circles').doc(cid).collection('members').doc(callerUid));
    }

    await bm.commit();

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
        visibilityPreference: 'PUBLIC', // Set to PUBLIC by default for test users
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // 2b. SEED VOUCHES
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

    // 3. SEED CIRCLES
    for (const c of circles) {
      await bm.set(db.collection('circles').doc(c.id), {
        ...c,
        isTest: true,
        creatorId: c.creator,
        memberCount: circleMemberships ? Object.values(circleMemberships).filter(m => m.includes(c.id)).length : 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // 3b. SEED CIRCLE MEMBERSHIPS (subcollection)
    for (const [uid, circleIds] of Object.entries(circleMemberships)) {
      for (const cid of circleIds) {
        await bm.set(db.collection('circles').doc(cid).collection('members').doc(uid), {
          joinedAt: FieldValue.serverTimestamp(),
          isTest: true
        });
      }
    }
    // Caller is NOT auto-joined to test circles for a fresh experience

    // 4. SEED ITEMS & COMMENTS
    const allItems = [...items1, ...items2];
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i] as any;
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

    // 5. GRATITUDE NOTES
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

    // 6. ADMIN SELF-FIX (preserve real circles, don't auto-join test ones)
    await bm.set(db.collection('users').doc(callerUid), {
      uid: callerUid,
      hasCompletedOnboarding: true,
      hostStatus: 'APPROVED',
      isAdmin: true,
    }, { merge: true });

    await bm.commit();
    res.status(200).json({ success: true, message: "KULA Neighborhood Restored!" });

  } catch (error: any) {
    console.error("Seed Error:", error);
    res.status(500).json({ error: error.message });
  }
});
