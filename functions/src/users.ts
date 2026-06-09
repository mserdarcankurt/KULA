import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { BatchManager, getDb } from "./utils";
import * as admin from "firebase-admin";

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

    // Check for deletion trigger first
    if (after.status === 'DELETED' && before.status !== 'DELETED') {
      console.log(`[DELETION TRIGGER] Running full account deletion for user: ${userId}`);
      try {
        // 1. Delete private user document
        await db.collection("users_private").doc(userId).delete().catch(e => console.error("Error deleting users_private:", e));

        // 2. Query and delete all items owned by user (including comments subcollection)
        const itemsSnap = await db.collection("items").where("ownerId", "==", userId).get();
        for (const itemDoc of itemsSnap.docs) {
          const commentsSnap = await itemDoc.ref.collection("comments").get();
          for (const commentDoc of commentsSnap.docs) {
            await commentDoc.ref.delete().catch(() => {});
          }
          await itemDoc.ref.delete().catch(e => console.error("Error deleting item:", itemDoc.id, e));
        }

        // 3. Query and delete all swipes by this user
        const swipesSnap = await db.collection("swipes").where("swiperId", "==", userId).get();
        for (const swipeDoc of swipesSnap.docs) {
          await swipeDoc.ref.delete().catch(() => {});
        }

        // 4. Query and delete all vouches involving this user
        const vouchesFromSnap = await db.collection("vouches").where("fromUserId", "==", userId).get();
        for (const vDoc of vouchesFromSnap.docs) {
          await vDoc.ref.delete().catch(() => {});
        }
        const vouchesToSnap = await db.collection("vouches").where("toUserId", "==", userId).get();
        for (const vDoc of vouchesToSnap.docs) {
          await vDoc.ref.delete().catch(() => {});
        }

        // 5. Query and delete all gratitude notes involving this user
        const notesFromSnap = await db.collection("gratitude_notes").where("fromUserId", "==", userId).get();
        for (const nDoc of notesFromSnap.docs) {
          await nDoc.ref.delete().catch(() => {});
        }
        const notesToSnap = await db.collection("gratitude_notes").where("toUserId", "==", userId).get();
        for (const nDoc of notesToSnap.docs) {
          await nDoc.ref.delete().catch(() => {});
        }

        // 6. Query and delete all reports by this user
        const reportsSnap = await db.collection("reports").where("reporterId", "==", userId).get();
        for (const rDoc of reportsSnap.docs) {
          await rDoc.ref.delete().catch(() => {});
        }

        // 7. Query and delete all notifications for this user
        const notificationsSnap = await db.collection("notifications").where("userId", "==", userId).get();
        for (const nDoc of notificationsSnap.docs) {
          await nDoc.ref.delete().catch(() => {});
        }

        // 8. Query and delete all invites created by or used by this user
        const invitesCreatedSnap = await db.collection("invites").where("createdBy", "==", userId).get();
        for (const iDoc of invitesCreatedSnap.docs) {
          await iDoc.ref.delete().catch(() => {});
        }
        const invitesUsedSnap = await db.collection("invites").where("usedBy", "==", userId).get();
        for (const iDoc of invitesUsedSnap.docs) {
          await iDoc.ref.delete().catch(() => {});
        }

        // 9. Query and delete all chats involving this user (including messages subcollection)
        const chatsSnap = await db.collection("chats").where("participants", "array-contains", userId).get();
        for (const chatDoc of chatsSnap.docs) {
          const messagesSnap = await chatDoc.ref.collection("messages").get();
          for (const msgDoc of messagesSnap.docs) {
            await msgDoc.ref.delete().catch(() => {});
          }
          await chatDoc.ref.delete().catch(e => console.error("Error deleting chat:", chatDoc.id, e));
        }

        // 10. Circle memberships: remove member and decrement count
        const joinedCircles: string[] = before.joinedCircles || [];
        for (const circleId of joinedCircles) {
          await db.collection("circles").doc(circleId).collection("members").doc(userId).delete().catch(() => {});
          await db.collection("circles").doc(circleId).update({
            memberCount: admin.firestore.FieldValue.increment(-1)
          }).catch(() => {});
        }

        // 11. Delete Storage media
        try {
          const bucket = admin.storage().bucket();
          await bucket.deleteFiles({ prefix: `items/uploads/${userId}/` });
          console.log(`[DELETION TRIGGER] Storage files deleted for user: ${userId}`);
        } catch (e) {
          console.error("Error deleting storage files:", e);
        }

        // 12. Delete Auth record
        try {
          await admin.auth().deleteUser(userId);
          console.log(`[DELETION TRIGGER] Auth record deleted for user: ${userId}`);
        } catch (e: any) {
          if (e.code !== 'auth/user-not-found') {
            console.error("Error deleting auth user:", e);
          }
        }

        // 13. Finally, delete the users/{userId} document itself
        await db.collection("users").doc(userId).delete().catch(e => console.error("Error deleting users profile:", e));
        console.log(`[DELETION TRIGGER] Profile document deleted for user: ${userId}. Deletion completed successfully!`);

      } catch (err) {
        console.error(`[DELETION TRIGGER] Critical error during account cleanup for user ${userId}:`, err);
      }
      return; // Stop execution here
    }

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
