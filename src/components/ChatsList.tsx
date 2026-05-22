/**
 * FILE: ChatsList.tsx
 * ROLE IN KULA: The "Inbox" — lists all conversations and manages chat navigation.
 * 
 * CIRCUIT D (Conversation Loop):
 *   This is the ENTRY POINT for all chat interactions. It shows:
 *     - Active conversations (sorted by most recent message)
 *     - Archived conversations (hidden but recoverable)
 *   When a user selects a conversation, it renders ChatRoom.tsx inline.
 * 
 * DATA FLOW:
 *   1. Subscribes to `chats WHERE participants contains currentUserId` (onSnapshot)
 *   2. Sorts by updatedAt (most recent first)
 *   3. Splits into active vs archived based on `archivedBy` array
 *   4. For each chat, ChatPreview fetches the OTHER participant's profile
 *   5. Shows unread indicator if `unreadBy` includes the current user
 * 
 * ARCHIVE SYSTEM:
 *   Archiving is PER-USER. When Alice archives a chat with Bob:
 *     - Alice's UID is added to `archivedBy` array
 *     - Bob still sees the chat as active
 *   If Bob sends a new message, chatService.ts clears `archivedBy: []`,
 *   which UN-ARCHIVES the chat for Alice automatically.
 * 
 * NESTED NAVIGATION:
 *   When selectedChatId is set, the entire list is REPLACED by a ChatRoom view
 *   with a back button header (ActiveChatHeader). This creates a "drill-down"
 *   navigation pattern without a router.
 * 
 * USED BY: App.tsx (the 'chats' tab)
 * CREATES CHATS: chatService.ts → getOrCreateChat()
 * REAL-TIME: useUnreadCount.ts listens to the same data for badge counts
 */
import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Chat, UserProfile, Item } from '../types';
import ChatRoom from './ChatRoom';
import { MessageSquare, ArrowLeft, Clock, Tag, Archive, ArchiveRestore } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getOrCreateChat } from '../services/chatService';

interface ChatsListProps {
  selectedChatId: string | null;
  onSelectChat: (id: string | null) => void;
}

export default function ChatsList({ selectedChatId, onSelectChat }: ChatsListProps) {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [hostProfile, setHostProfile] = useState<UserProfile | null>(null);
  const [loadingHost, setLoadingHost] = useState(false);
  const [sendingGreeting, setSendingGreeting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      
      fetchedChats.sort((a, b) => {
         const timeA = a.updatedAt?.toMillis?.() || 0;
         const timeB = b.updatedAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      
      setChats(fetchedChats);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!profile?.hostId || chats.length > 0) {
      setHostProfile(null);
      return;
    }

    setLoadingHost(true);
    getDoc(doc(db, 'users', profile.hostId))
      .then((snap) => {
        if (snap.exists()) {
          setHostProfile(snap.data() as UserProfile);
        }
      })
      .catch((err) => {
        console.error('Error fetching host profile:', err);
      })
      .finally(() => {
        setLoadingHost(false);
      });
  }, [profile?.hostId, chats.length]);

  const handleSendGreeting = async () => {
    if (!user || !profile?.hostId || !hostProfile) return;
    setSendingGreeting(true);

    try {
      // 1. Get or create the chat room with the host
      const chatId = await getOrCreateChat(user.uid, profile.hostId);

      const hostFirstName = hostProfile.displayName ? hostProfile.displayName.split(' ')[0] : 'Neighbor';
      const greetingText = `👋 Hey ${hostFirstName}! Thanks for the invite to Kula. Excited to join the neighborhood!`;

      // 2. Add the greeting message to the subcollection chats/{chatId}/messages
      const msgData = {
        chatId,
        senderId: user.uid,
        senderName: profile?.displayName || 'Neighbor',
        text: greetingText,
        type: 'TEXT',
        createdAt: serverTimestamp(),
        chatType: 'DIRECT',
        participants: [user.uid, profile.hostId],
        circleId: null
      };
      await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);

      // 3. Update the chat document preview metadata
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: greetingText,
        updatedAt: serverTimestamp(),
        unreadBy: [profile.hostId]
      });

      // 4. Select the chat to navigate to the ChatRoom
      onSelectChat(chatId);
    } catch (err) {
      console.error('Error sending host greeting:', err);
    } finally {
      setSendingGreeting(false);
    }
  };

  const toggleArchive = async (e: React.MouseEvent, chatId: string, isArchived: boolean) => {
    e.stopPropagation();
    if (!user) return;

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        archivedBy: isArchived ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (err) {
      console.error('Error toggling archive:', err);
    }
  };

  const activeChats = chats.filter(c => !c.archivedBy?.includes(user?.uid || ''));
  const archivedChats = chats.filter(c => c.archivedBy?.includes(user?.uid || ''));
  const currentChats = showArchived ? archivedChats : activeChats;

  if (selectedChatId) {
    const chat = chats.find(c => c.id === selectedChatId);
    return (
      <div className="h-full bg-white flex flex-col">
        <ActiveChatHeader 
          chat={chat} 
          currentUserId={user?.uid || ''} 
          onBack={() => onSelectChat(null)} 
        />
        <ChatRoom chatId={selectedChatId} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-4">
      <div className="px-6 mb-6 flex items-end justify-between">
        <div className="space-y-1">
          <h2 className="serif text-3xl font-bold text-brand">
            {showArchived ? 'Archived' : 'Connections'}
          </h2>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest italic">
            {showArchived ? 'Hidden conversations' : 'Your active circle'}
          </p>
        </div>
        <button 
          onClick={() => setShowArchived(!showArchived)}
          className={`p-2.5 rounded-xl transition-all ${
            showArchived 
              ? 'bg-stone-900 text-white' 
              : 'bg-stone-100 text-stone-400 hover:text-stone-600'
          }`}
          title={showArchived ? "Show Active" : "Show Archived"}
        >
          {showArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {loading ? (
          <div className="text-center py-20 text-stone-300 italic">Syncing your circle...</div>
        ) : currentChats.length > 0 ? (
          currentChats.map(chat => (
            <div key={chat.id} className="relative group">
              <ChatPreview 
                chat={chat} 
                currentUserId={user?.uid || ''} 
                onClick={() => onSelectChat(chat.id)}
              />
              <button 
                onClick={(e) => toggleArchive(e, chat.id, showArchived)}
                className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm text-stone-400 hover:text-stone-900 transition-all"
              >
                {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            </div>
          ))
        ) : !showArchived && (loadingHost || hostProfile) ? (
          loadingHost ? (
            <div className="p-6 bg-[#FDFBF9] border border-stone-100 rounded-[2rem] shadow-sm animate-pulse space-y-4 max-w-md mx-auto mt-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-stone-100 rounded-2xl" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-stone-100 rounded w-1/3" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-10 bg-stone-100 rounded-xl w-full" />
            </div>
          ) : hostProfile ? (
            <div className="p-6 bg-[#FDFBF9] border border-stone-100 rounded-[2rem] shadow-sm text-center md:text-left space-y-6 max-w-md mx-auto mt-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-16 h-16 bg-stone-100 rounded-2xl flex-shrink-0 overflow-hidden border border-stone-200/60 relative mx-auto md:mx-0">
                  {hostProfile.photoURL ? (
                    <img referrerPolicy="no-referrer" src={hostProfile.photoURL} alt={hostProfile.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold text-xl bg-stone-50">
                      {hostProfile.displayName?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="serif text-xl font-bold text-stone-850">Welcome to Kula!</h3>
                  <p className="text-sm text-stone-500">
                    You were invited by <span className="font-semibold text-stone-700">{hostProfile.displayName}</span>
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-stone-600 leading-relaxed text-center md:text-left">
                Send a friendly greeting to thank them for the invite and start connecting with your neighborhood circle.
              </p>

              <button
                disabled={sendingGreeting}
                onClick={handleSendGreeting}
                className="w-full text-left p-4 bg-white border border-stone-200/80 hover:border-stone-400 rounded-2xl hover:bg-stone-50/50 active:bg-stone-50 transition-all shadow-sm flex items-start gap-3 group relative disabled:opacity-50"
              >
                <span className="text-xl select-none pt-0.5">👋</span>
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Say Hello</span>
                  <p className="text-stone-700 text-sm leading-snug pr-6 italic">
                    "Hey {hostProfile.displayName ? hostProfile.displayName.split(' ')[0] : 'Neighbor'}! Thanks for the invite to Kula. Excited to join the neighborhood!"
                  </p>
                </div>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 group-hover:text-stone-700 transition-colors">
                  {sendingGreeting ? (
                    <span className="inline-block w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                  ) : (
                    '→'
                  )}
                </span>
              </button>
            </div>
          ) : null
        ) : (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-300">
              {showArchived ? <Archive size={32} /> : <MessageSquare size={32} />}
            </div>
            <p className="text-stone-400 italic serif">
              {showArchived ? 'No archived chats.' : 'No active connections yet. Start swiping to meet neighbors!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatPreviewProps {
  chat: Chat;
  currentUserId: string;
  onClick: () => void;
}

function ChatPreview({ chat, currentUserId, onClick }: ChatPreviewProps) {
  const otherUserId = chat.participants.find(id => id !== currentUserId);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  const isUnread = chat.unreadBy?.includes(currentUserId);

  useEffect(() => {
    if (!otherUserId) return;
    getDoc(doc(db, 'users', otherUserId)).then(snap => {
      if (snap.exists()) setOtherUser(snap.data() as UserProfile);
    });
  }, [otherUserId]);

  return (
    <button 
      onClick={onClick}
      className={`relative w-full flex gap-4 p-4 hover:bg-stone-50 transition-all rounded-3xl group mb-2 ${isUnread ? 'bg-stone-50' : ''}`}
    >
      <div className="w-14 h-14 bg-stone-100 rounded-2xl flex-shrink-0 overflow-hidden border border-stone-100 relative">
        {otherUser?.photoURL ? (
          <img referrerPolicy="no-referrer" src={otherUser.photoURL} alt={otherUser.displayName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 font-bold">
            {otherUser?.displayName?.charAt(0)}
          </div>
        )}
      </div>
      
      <div className="flex-1 text-left pt-1 relative">
        <div className="flex justify-between items-baseline">
          <h4 className={`font-bold transition-colors ${isUnread ? 'text-brand' : 'text-stone-800'}`}>
            {otherUser?.displayName || 'Loading...'}
          </h4>
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter text-stone-400">
            <Clock size={10} />
            <span>
              {chat.updatedAt ? formatDistanceToNow(chat.updatedAt.toDate ? chat.updatedAt.toDate() : new Date(chat.updatedAt), { addSuffix: true }) : ''}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className={`text-sm line-clamp-1 italic ${isUnread ? 'text-stone-900 font-medium' : 'text-stone-500'}`}>
            {chat.lastMessage || 'Start a conversation...'}
          </p>
          {isUnread && (
            <div className="w-2.5 h-2.5 bg-brand rounded-full flex-shrink-0 ml-2" />
          )}
        </div>
      </div>
    </button>
  );
}

interface ActiveChatHeaderProps {
  chat?: Chat;
  currentUserId: string;
  onBack: () => void;
}

function ActiveChatHeader({ chat, currentUserId, onBack }: ActiveChatHeaderProps) {
  const otherUserId = chat?.participants.find(id => id !== currentUserId);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    if (!otherUserId) return;
    getDoc(doc(db, 'users', otherUserId)).then(snap => {
      if (snap.exists()) setOtherUser(snap.data() as UserProfile);
    });
  }, [otherUserId]);

  useEffect(() => {
    if (!chat?.itemId) return;
    getDoc(doc(db, 'items', chat.itemId)).then(snap => {
      if (snap.exists()) setItem({ id: snap.id, ...snap.data() } as Item);
    });
  }, [chat?.itemId]);

  return (
    <header className="py-3 px-4 border-b border-stone-100 flex items-center gap-3 bg-white sticky top-0 z-10 shadow-sm">
      <button onClick={onBack} className="text-stone-400 hover:text-stone-900 transition-colors p-1">
        <ArrowLeft size={20} />
      </button>
      
      <div className="flex-1 flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 bg-stone-100 rounded-xl flex-shrink-0 overflow-hidden border border-stone-50">
          {otherUser?.photoURL ? (
            <img src={otherUser.photoURL} alt={otherUser.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300 font-bold text-xs">
              {otherUser?.displayName?.charAt(0)}
            </div>
          )}
        </div>
        
        <div className="flex flex-col min-w-0">
          <h3 className="font-bold text-stone-900 text-sm truncate">
            {otherUser?.displayName || 'Loading...'}
          </h3>
          {item ? (
            <div className="flex items-center gap-1.5 text-[9px] text-stone-400 font-bold uppercase tracking-wider">
              <Tag size={10} className="text-amber-500" />
              <span className="truncate">Discussing: {item.title}</span>
            </div>
          ) : (
            <span className="text-[10px] text-stone-400 font-medium">Neighbor Connection</span>
          )}
        </div>
      </div>
    </header>
  );
}
