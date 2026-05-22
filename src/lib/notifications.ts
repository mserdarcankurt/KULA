import { db } from './firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Notification } from '../types';

/**
 * sendNotification:
 * Writes a notification document to the global notifications collection.
 */
export async function sendNotification(
  userId: string,
  type: string,
  content: string,
  link: string
) {
  try {
    const notifData = {
      userId,
      type,
      content,
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
