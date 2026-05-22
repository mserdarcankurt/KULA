import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { useAuth } from './useAuth';
import { Notification } from '../types';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to notifications:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  return { notifications, unreadCount, loading, markAllAsRead };
}
