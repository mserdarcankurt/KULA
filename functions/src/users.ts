import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { BatchManager, getDb } from "./utils";

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const isDevMode = isEmulator || process.env.NODE_ENV === 'development';
const databaseId = isDevMode ? '(default)' : 'kulasharingapp';

export const onUserUpdated = onDocumentUpdated(
  {
    document: "users/{userId}",
    database: databaseId,
    region: "us-central1"
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const userId = event.params.userId;
    const db = getDb();

    const nameChanged = before.displayName !== after.displayName;
    const photoChanged = before.photoURL !== after.photoURL;
    const orgChanged = before.isOrganization !== after.isOrganization;

    if (!nameChanged && !photoChanged && !orgChanged) {
      // Nothing relevant to denormalized data changed
      return;
    }

    const newName = after.displayName;
    const newPhoto = after.photoURL;
    const newIsOrg = after.isOrganization;

    const bm = new BatchManager();

    // 1. Update Items owned by this user
    const itemsQuery = await db.collection("items").where("ownerId", "==", userId).get();
    for (const doc of itemsQuery.docs) {
      const updates: any = {};
      if (nameChanged) updates.ownerName = newName;
      if (photoChanged) updates.ownerPhoto = newPhoto;
      if (orgChanged) updates.ownerIsOrganization = newIsOrg;
      await bm.update(doc.ref, updates);
    }

    // 2. Update Comments by this user (Collection Group query)
    const commentsQuery = await db.collectionGroup("comments").where("userId", "==", userId).get();
    for (const doc of commentsQuery.docs) {
      const updates: any = {};
      if (nameChanged) updates.userName = newName;
      if (photoChanged) updates.userPhoto = newPhoto;
      await bm.update(doc.ref, updates);
    }

    // 3. Update Gratitude Notes from this user
    const gratitudeNotesQuery = await db.collection("gratitude_notes").where("fromUserId", "==", userId).get();
    for (const doc of gratitudeNotesQuery.docs) {
      const updates: any = {};
      if (nameChanged) updates.fromUserName = newName;
      if (photoChanged) updates.fromUserPhoto = newPhoto;
      await bm.update(doc.ref, updates);
    }

    // 4. Update Messages sent by this user (Collection Group query)
    const messagesQuery = await db.collectionGroup("messages").where("senderId", "==", userId).get();
    for (const doc of messagesQuery.docs) {
      const updates: any = {};
      if (nameChanged) updates.senderName = newName;
      await bm.update(doc.ref, updates);
    }

    // Commit any remaining writes
    await bm.commit();
  }
);
