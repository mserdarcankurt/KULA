import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function getOrCreateChat(currentUserId: string, otherUserId: string, itemId?: string, itemTitle?: string) {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef, 
    where('participants', 'array-contains', currentUserId)
  );
  
  const querySnapshot = await getDocs(q);
  let existingChat = querySnapshot.docs.find(doc => {
    const data = doc.data();
    return data.participants.includes(otherUserId);
  });

  const lastMessage = itemTitle 
    ? `Interested in: ${itemTitle}` 
    : 'Started a new conversation';

  if (existingChat) {
    // Update existing chat with new item context and unarchive for both
    await updateDoc(doc(db, 'chats', existingChat.id), {
      ...(itemId && { itemId }),
      lastMessage: lastMessage,
      updatedAt: serverTimestamp(),
      archivedBy: [], // Unarchive for both when new interest happens
      unreadBy: [otherUserId]
    });
    return existingChat.id;
  } else {
    // Create new chat
    const newChatRef = await addDoc(chatsRef, {
      participants: [currentUserId, otherUserId],
      type: 'DIRECT',
      ...(itemId && { itemId }),
      lastMessage: lastMessage,
      updatedAt: serverTimestamp(),
      archivedBy: [],
      unreadBy: [otherUserId]
    });
    return newChatRef.id;
  }
}
