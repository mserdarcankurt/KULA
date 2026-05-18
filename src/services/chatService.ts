/**
 * FILE: chatService.ts
 * ROLE IN KULA: The "Chat Orchestrator" — handles creating and reusing conversations.
 * 
 * CIRCUIT D (Conversation Loop):
 *   When a user expresses interest in an item (swipes LIKE in ItemDetailsSheet.tsx,
 *   or clicks "Message" on PublicProfile.tsx), this function is called.
 *   It either FINDS an existing chat between the two users or CREATES a new one.
 * 
 * WHY "GET OR CREATE"?
 *   Without this pattern, clicking "Message" on the same person 10 times would
 *   create 10 separate chat threads. Instead, we REUSE the existing conversation.
 *   This keeps the user's inbox clean and conversations in one place.
 * 
 * FLOW:
 *   1. Query Firestore for all chats where the current user is a participant.
 *   2. Search through those chats for one that also contains the other user.
 *   3a. IF FOUND: Update the existing chat with the new item context and unarchive it.
 *   3b. IF NOT FOUND: Create a brand new chat document.
 *   4. Return the chatId — the calling component (ItemDetailsSheet, PublicProfile)
 *      uses this to navigate to ChatRoom.tsx.
 * 
 * DOWNSTREAM EFFECTS:
 *   - Setting `unreadBy: [otherUserId]` triggers useUnreadCount.ts on the
 *     OTHER user's device, showing them a badge notification.
 *   - Setting `archivedBy: []` un-archives the chat for BOTH users.
 *     This handles the case where Alice archived a conversation with Bob,
 *     but Bob expresses new interest — Alice should see the chat again.
 *   - The `lastMessage` field is what appears as the preview text in ChatsList.tsx.
 */
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * getOrCreateChat():
 * The single entry point for starting a conversation.
 * 
 * @param currentUserId - The logged-in user's UID (from useAuth)
 * @param otherUserId - The UID of the person they want to chat with
 * @param itemId - Optional: which item triggered this conversation
 * @param itemTitle - Optional: the title of that item (for the preview message)
 * @returns The chatId (string) — used to navigate to ChatRoom.tsx
 * 
 * CALLED BY:
 *   - ItemDetailsSheet.tsx → when user clicks "I'm interested" on an item
 *   - PublicProfile.tsx → when user clicks "Send Message" on someone's profile
 *   - Explore.tsx → when user swipes right (LIKE) on an item card
 * 
 * SECURITY:
 *   firestore.rules for `chats` requires `request.auth.uid in resource.data.participants`
 *   for reads and updates. This means you can only access chats you're part of.
 */
export async function getOrCreateChat(currentUserId: string, otherUserId: string, itemId?: string, itemTitle?: string) {
  const chatsRef = collection(db, 'chats');
  
  // Step 1: Find all chats where the CURRENT user is a participant
  // NOTE: Firestore's `array-contains` only allows one per query,
  // so we query for the current user and then filter client-side for the other.
  const q = query(
    chatsRef, 
    where('participants', 'array-contains', currentUserId)
  );
  
  const querySnapshot = await getDocs(q);
  
  // Step 2: Search for an existing chat that ALSO includes the other user
  let existingChat = querySnapshot.docs.find(doc => {
    const data = doc.data();
    return data.participants.includes(otherUserId);
  });

  // Build the preview message for the chat list
  const lastMessage = itemTitle 
    ? `Interested in: ${itemTitle}` 
    : 'Started a new conversation';

  if (existingChat) {
    // EXISTING CHAT: Update it with new context.
    // This handles the scenario: Alice and Bob chatted last month about a drill.
    // Now Bob is interested in Alice's new sourdough starter.
    // We UPDATE the same chat with the new item context.
    await updateDoc(doc(db, 'chats', existingChat.id), {
      ...(itemId && { itemId }),          // Update the item context if provided
      lastMessage: lastMessage,            // New preview text
      updatedAt: serverTimestamp(),         // Bump to top of chat list
      archivedBy: [],                      // UNARCHIVE for both — new activity revives the chat
      unreadBy: [otherUserId]              // Mark as unread for the OTHER user → triggers their badge
    });
    return existingChat.id;
  } else {
    // NEW CHAT: Create a fresh conversation document.
    const newChatRef = await addDoc(chatsRef, {
      participants: [currentUserId, otherUserId],
      type: 'DIRECT',                      // 1:1 conversation (not a channel)
      ...(itemId && { itemId }),
      lastMessage: lastMessage,
      updatedAt: serverTimestamp(),
      archivedBy: [],                      // Nobody has archived it yet
      unreadBy: [otherUserId]              // The other user hasn't seen it yet
    });
    return newChatRef.id;
  }
}
