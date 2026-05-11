import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './useAuth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      setUnreadChats(0);
      return;
    }

    const unsubs: (() => void)[] = [];

    // Notifications listener
    const notifQ = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('isRead', '==', false)
    );
    unsubs.push(
      onSnapshot(notifQ, (snapshot) => {
        setUnreadNotifications(snapshot.docs.length);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      })
    );

    // Chats listener
    const chatsQ = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    unsubs.push(
      onSnapshot(chatsQ, (snapshot) => {
        let chatUnreadCount = 0;
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.unreadBy && data.unreadBy.includes(user.uid)) {
            // Also ensure the chat wasn't archived
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

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user]);

  return { unreadNotifications, unreadChats, totalUnread: unreadNotifications + unreadChats };
}
