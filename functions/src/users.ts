import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { BatchManager, getDb, getDatabaseId } from "./utils";
import * as admin from "firebase-admin";

const databaseId = getDatabaseId();

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
        // ── Phase A: gather everything that needs deleting, in parallel ──
        const [
          swipesSnap, vouchesFromSnap, vouchesToSnap,
          notesFromSnap, notesToSnap, reportsSnap,
          notificationsSnap, invitesCreatedSnap, invitesUsedSnap,
          itemsSnap, chatsSnap,
        ] = await Promise.all([
          db.collection("swipes").where("swiperId", "==", userId).get(),
          db.collection("vouches").where("fromUserId", "==", userId).get(),
          db.collection("vouches").where("toUserId", "==", userId).get(),
          db.collection("gratitude_notes").where("fromUserId", "==", userId).get(),
          db.collection("gratitude_notes").where("toUserId", "==", userId).get(),
          db.collection("reports").where("reporterId", "==", userId).get(),
          db.collection("notifications").where("userId", "==", userId).get(),
          db.collection("invites").where("createdBy", "==", userId).get(),
          db.collection("invites").where("usedBy", "==", userId).get(),
          db.collection("items").where("ownerId", "==", userId).get(),
          db.collection("chats").where("participants", "array-contains", userId).get(),
        ]);

        // ── Phase B: flat documents via BulkWriter (parallel, auto-retried,
        // auto-batched — replaces hundreds of sequential awaited deletes) ──
        const writer = db.bulkWriter();
        writer.onWriteError((err) => {
          console.error(`[DELETION TRIGGER] write failed (attempt ${err.failedAttempts}):`, err.documentRef.path);
          return err.failedAttempts < 3; // retry up to 3 times
        });

        for (const snap of [
          swipesSnap, vouchesFromSnap, vouchesToSnap, notesFromSnap, notesToSnap,
          reportsSnap, notificationsSnap, invitesCreatedSnap, invitesUsedSnap,
        ]) {
          snap.docs.forEach(d => writer.delete(d.ref));
        }

        // Private doc + circle memberships. memberCount/privacy maintenance
        // now happens in the onCircleMemberDeleted trigger (social.ts) — the
        // old manual decrement here would double-count against it.
        writer.delete(db.collection("users_private").doc(userId));
        const joinedCircles: string[] = before.joinedCircles || [];
        for (const circleId of joinedCircles) {
          writer.delete(db.collection("circles").doc(circleId).collection("members").doc(userId));
        }

        await writer.close();

        // ── Phase C: documents with subcollections via recursiveDelete —
        // also covers thread replies (messages/*/replies), which the old
        // per-collection loop silently missed ──
        await Promise.all(itemsSnap.docs.map(d =>
          db.recursiveDelete(d.ref).catch(e => console.error("Error deleting item tree:", d.id, e))
        ));
        await Promise.all(chatsSnap.docs.map(d =>
          db.recursiveDelete(d.ref).catch(e => console.error("Error deleting chat tree:", d.id, e))
        ));

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
