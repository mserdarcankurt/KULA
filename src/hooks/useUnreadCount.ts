/**
 * FILE: useUnreadCount.ts
 * ROLE IN KULA: The "Badge Counter" — powers the red notification dots in the UI.
 * 
 * CIRCUIT D (Conversation Loop):
 *   This hook is the FINAL STEP of the notification pipeline:
 *     1. A message is sent in ChatRoom.tsx
 *     2. The sender adds the recipient's UID to the chat's `unreadBy` array
 *     3. This hook DETECTS that change via onSnapshot (real-time)
 *     4. Navigation.tsx reads the count and shows a red badge on the "Chats" tab
 * 
 * WHAT IT WATCHES:
 *   1. NOTIFICATIONS: The `notifications` collection — filtered by userId and isRead.
 *      These are system-generated alerts (new vouch, item match, etc.)
 *      Created by: Cloud Functions (functions/index.ts)
 *      Displayed by: NotificationsOverlay.tsx
 * 
 *   2. CHATS: The `chats` collection — checks the `unreadBy` array for the current UID.
 *      Also checks `archivedBy` — archived chats don't count as "unread."
 *      Created by: chatService.ts when a message triggers the unreadBy field
 *      Displayed by: Navigation.tsx (red dot on the Chats icon)
 * 
 * WHY TWO LISTENERS?
 *   Notifications and Chats are separate systems. A user might have 3 unread
 *   notifications (system events) AND 2 unread chats (messages from people).
 *   Navigation.tsx adds them together for the total badge count.
 * 
 * CLEANUP: Both listeners are stored in the `unsubs` array and cleaned up
 *   when the user logs out or the component unmounts. This prevents
 *   "ghost listeners" that keep querying Firestore after the user is gone.
 */
import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './useAuth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    // If no user is logged in, reset counts to 0
    if (!user) {
      setUnreadNotifications(0);
      setUnreadChats(0);
      return;
    }

    // Array to store cleanup functions for all our listeners
    const unsubs: (() => void)[] = [];

    // ── LISTENER 1: Unread Notifications ─────────────────
    // Query: "notifications where userId == me AND isRead == false"
    // This is a LIVE listener — the count updates the moment a Cloud Function
    // creates a new notification for this user.
    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('isRead', '==', false)
    );
    let isInitialLoad = true;

    unsubs.push(
      onSnapshot(notifQ, (snapshot) => {
        // The count IS the number of matching documents
        setUnreadNotifications(snapshot.docs.length);

        if (!isInitialLoad) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const notifData = change.doc.data();
              import('../lib/pushService').then(({ showLocalNotification }) => {
                showLocalNotification(
                  notifData.type === 'new_message' ? 'New Message' : 'KULA Alert',
                  notifData.content || ''
                );
              });
            }
          });
        }
        isInitialLoad = false;
      }, (error) => {
        // Route errors through the centralized handler (firebase.ts)
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      })
    );

    // ── LISTENER 2: Unread Chats ─────────────────────────
    // Query: "chats where participants contains me"
    // Then we CLIENT-SIDE filter for: unreadBy includes me AND NOT archivedBy me.
    // 
    // WHY CLIENT-SIDE? Firestore doesn't support compound array-contains queries
    // across multiple arrays. So we fetch all my chats and filter in JavaScript.
    const chatsQ = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    unsubs.push(
      onSnapshot(chatsQ, (snapshot) => {
        let chatUnreadCount = 0;
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          // Check if this chat has unread messages for me
          if (data.unreadBy && data.unreadBy.includes(user.uid)) {
            // BUT don't count it if I've archived this chat
            // (archived = "I don't want to see this conversation anymore")
            if (!data.archivedBy?.includes(user.uid)) {
              chatUnreadCount++;
            }
          }
        });
        setUnreadChats(chatUnreadCount);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      })
    );

    // Cleanup: unsubscribe from ALL listeners when the user changes or component unmounts
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user]);

  // Return individual counts AND a combined total for Navigation.tsx
  return { unreadNotifications, unreadChats, totalUnread: unreadNotifications + unreadChats };
}
