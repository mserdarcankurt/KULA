import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Notification } from '../types';

/**
 * sendNotification:
 * Writes a notification document to the global notifications collection.
 * actorId records WHO generated the notification — firestore.rules require
 * it to match the signed-in user, so "from" identity cannot be forged.
 */
export async function sendNotification(
  userId: string,
  type: string,
  content: string,
  link: string
) {
  try {
    const actorId = auth.currentUser?.uid;
    if (!actorId) return;
    // firestore.rules cap notification content at 500 chars — truncate long
    // payloads (e.g. full chat messages) instead of losing the push entirely.
    const safeContent = content.length > 500 ? `${content.slice(0, 497)}…` : content;
    const notifData = {
      userId,
      actorId,
      type,
      content: safeContent,
      link,
      isRead: false,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'notifications'), notifData);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

/**
 * markNotificationRead:
 * Marks a single notification document as read.
 */
export async function markNotificationRead(id: string) {
  try {
    const ref = doc(db, 'notifications', id);
    await updateDoc(ref, { isRead: true });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
}
