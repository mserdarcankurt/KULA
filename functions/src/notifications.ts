import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from 'firebase-admin';
import { getDb } from "./utils";

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const isDevMode = isEmulator || process.env.NODE_ENV === 'development';
const databaseId = isDevMode ? '(default)' : 'kulasharingapp';

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
