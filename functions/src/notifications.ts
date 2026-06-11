import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from 'firebase-admin';
import { getDb, getDatabaseId } from "./utils";

const databaseId = getDatabaseId();

/**
 * onNotificationCreated:
 * Listens for new documents in the `notifications` collection.
 * When a notification is created, it finds the target user's FCM tokens
 * and sends a push notification to their devices.
 */
export const onNotificationCreated = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    database: databaseId
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const notificationData = snapshot.data();
    const userId = notificationData.userId;

    if (!userId) {
      console.log("No userId found in notification, skipping FCM.");
      return;
    }

    // SPAM THROTTLE: firestore.rules pin actorId to the creator but cannot
    // rate-limit volume — a hostile client could loop addDoc to push-bomb
    // any user. Cap each actor at 30 notifications/minute (far above any
    // legitimate behavior, including fast Discovery swiping); past the cap
    // the spam doc is deleted and no push is sent.
    const actorId = notificationData.actorId;
    if (actorId) {
      try {
        const windowStart = admin.firestore.Timestamp.fromMillis(Date.now() - 60_000);
        const recent = await getDb().collection("notifications")
          .where("actorId", "==", actorId)
          .where("createdAt", ">", windowStart)
          .count().get();
        if (recent.data().count > 30) {
          console.warn(`[THROTTLE] actor ${actorId} exceeded 30 notifications/min — dropping ${snapshot.ref.path}`);
          await snapshot.ref.delete();
          return;
        }
      } catch (err) {
        console.error("[THROTTLE] rate check failed (continuing):", err);
      }
    }

    // 1. Fetch the user's profile to get their fcmTokens
    const userRef = getDb().collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    console.log(`User ${userId} not found, skipping FCM.`);
    return;
  }

  const userData = userDoc.data();
  const fcmTokens = userData?.fcmTokens as string[] | undefined;

  if (!fcmTokens || fcmTokens.length === 0) {
    console.log(`User ${userId} has no registered FCM tokens.`);
    return;
  }

  // 2. Prepare the notification payload
  const title = notificationData.title || "KULA";
  const body = notificationData.body || "You have a new notification";

  const message = {
    notification: {
      title,
      body,
    },
    // Optional: Add data payload if you want the app to handle it (e.g. routing to chat)
    data: Object.fromEntries(
      Object.entries(notificationData).map(([key, value]) => [key, String(value)])
    ),
    tokens: fcmTokens,
  };

  try {
    // 3. Send the notification via Firebase Cloud Messaging
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`${response.successCount} messages were sent successfully`);
    
    // 4. Cleanup stale tokens if any failed (e.g. device unregistered)
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(fcmTokens[idx]);
          console.error(`Failed to send to token: ${resp.error}`);
        }
      });

      if (failedTokens.length > 0) {
        // Remove invalid tokens from the user's profile
        await userRef.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
        });
        console.log(`Removed ${failedTokens.length} stale FCM tokens for user ${userId}`);
      }
    }
  } catch (error) {
    console.error("Error sending FCM notification:", error);
  }
});
