import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Chat, UserProfile, Item } from '../types';
import ChatRoom from './ChatRoom';
import { MessageSquare, ArrowLeft, Clock, Tag, Archive, ArchiveRestore } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChatsListProps {
  selectedChatId: string | null;
  onSelectChat: (id: string | null) => void;
}

export default function ChatsList({ selectedChatId, onSelectChat }: ChatsListProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

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
          <h2 className="serif text-3xl font-bold text-[--color-brand]">
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
          <h4 className={`font-bold transition-colors ${isUnread ? 'text-[--color-brand]' : 'text-stone-800'}`}>
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
            <div className="w-2.5 h-2.5 bg-[--color-brand] rounded-full flex-shrink-0 ml-2" />
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
