/**
 * FILE: ChatRoom.tsx
 * ROLE IN KULA: The "Conversation Engine" — renders and manages a real-time chat.
 * 
 * CIRCUIT D (Conversation Loop):
 *   This is the CORE communication component. It handles:
 *     1. DIRECT CHATS: 1-on-1 between two users (about an item or general)
 *     2. CHANNEL CHATS: Group messages within a Circle (many-to-many)
 *     3. THREADS: Nested replies under a specific message (Slack-like)
 * 
 * DATA ARCHITECTURE (Firestore):
 *   chats/{chatId}                 → Chat metadata (participants, lastMessage, unreadBy)
 *   chats/{chatId}/messages/{id}   → Individual messages (text, polls, urgent, system)
 *   chats/{chatId}/messages/{id}/replies/{replyId} → Thread replies
 * 
 * MESSAGE TYPES:
 *   - TEXT: Normal messages with optional reply-to context
 *   - POLL: Community decision-making ("İmece Decision") with votable options
 *   - URGENT: SOS-style emergency needs (#UrgentNeeds channel) that can be CLAIMED
 *   - SYSTEM: Automated messages (handover confirmations, status changes)
 * 
 * KEY BEHAVIORS:
 *   - Auto-scroll: scrollRef keeps view at bottom when new messages arrive
 *   - Mark-as-read: Opening a chat clears your UID from `unreadBy` array
 *   - Confirm Handover: Item owner can mark exchange as COMPLETED, triggering GratitudeFlow
 *   - Quick Messages: Pre-written neighborly phrases for fast engagement
 * 
 * AI TRANSLATION:
 *   Each message has a translate button (Languages icon) that calls geminiService.ts.
 *   It uses the user's preferredLanguage from their profile to translate.
 *   Translated text toggles between original and translated views.
 * 
 * CALLED BY: ChatsList.tsx (selected chat), Circles.tsx (circle channels)
 * WRITES TO: chats/{chatId}/messages, chats/{chatId} (lastMessage, unreadBy)
 * READS FROM: chats/{chatId}, users/{otherUserId}, items/{itemId}
 */
import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Message, Item, Chat, UserProfile, Circle } from '../types';
import { Send, Smile, Languages, Loader2, MessageSquare, CheckCircle2, Clock, Plus, Info, X, Users, Heart, ArrowLeft, BarChart2 } from 'lucide-react';

import { translateText } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { sendNotification } from '../lib/notifications';
import { getFallbackImage } from '../lib/artDirection';
import GratitudeFlow from './GratitudeFlow';

const EMOJIS = [
  '😊', '👋', '❤️', '👍', '🙌', '🎉', '✨', '🌟', '💬', '💡',
  '🏡', '🤝', '🙏', '🛠️', '🚲', '📦', '🎨', '🌱', '🌸', '☕',
  '🍕', '🍎', '🧺', '📚', '🧸', '🐱', '🐶', '🍷', '👟', '🌍'
];


interface ChatRoomProps {
  chatId: string;
}

interface ChatMessageProps {
  msg: Message;
  isOwn: boolean;
  targetLanguage: string;
  onVote: (pollId: string, optionKey: string) => void;
  onClaim: (msgId: string) => void;
  onReply: (msg: Message) => void;
  onOpenThread?: (msg: Message) => void;
  displayName?: string;
  onJoinCircle?: (circleId: string, circleName: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ msg, isOwn, targetLanguage, onVote, onClaim, onReply, onOpenThread, displayName, onJoinCircle }) => {
  const { user, profile } = useAuth();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);

  const handleTranslate = async () => {
    if (translatedText) {
      setShowOriginal(!showOriginal);
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateText(msg.text, targetLanguage);
      setTranslatedText(result);
      setShowOriginal(false);
    } catch (err) {
      console.error('Translation failed', err);
    } finally {
      setIsTranslating(false);
    }
  };

  if (msg.type === 'POLL' && msg.poll) {
    const options = msg.poll.options;
    const totalVotes = Object.values(options).reduce((acc: number, opt: any) => acc + (opt.votes?.length || 0), 0);
    
    return (
      <div className="flex justify-start w-full">
        <div className="bg-stone-900 text-white p-6 rounded-[2rem] w-full max-w-[90%] shadow-xl border border-stone-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-stone-800 rounded-2xl flex items-center justify-center text-amber-400">
              <BarChart2 size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">Community Poll</h4>
              <p className="serif text-lg font-bold">{msg.poll.question}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {Object.entries(options).map(([key, option]: [string, any]) => {
              const hasVoted = option.votes?.includes(user?.uid || '');
              const count = option.votes?.length || 0;
              const tv = totalVotes as number;
              const percentage = tv > 0 ? (count / tv) * 100 : 0;
              
              return (
                <button 
                  key={key}
                  onClick={() => onVote(msg.id, key)}
                  className={`relative w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between overflow-hidden group ${
                    hasVoted 
                      ? 'border-amber-400 bg-stone-800' 
                      : 'border-stone-800 bg-stone-900 hover:border-stone-700'
                  }`}
                >
                  <div 
                    className="absolute inset-y-0 left-0 bg-amber-400/10 transition-all duration-1000" 
                    style={{ width: `${percentage}%` }}
                  />
                  <span className="relative z-10 text-sm font-bold">{option.text}</span>
                  <div className="relative z-10 flex items-center gap-2">
                    {hasVoted && <CheckCircle2 size={14} className="text-amber-400" />}
                    <span className="text-[10px] font-black">{option.votes?.length || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-stone-800 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-stone-500">
            <span>{totalVotes} total votes</span>
            <span>İmece Decision</span>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === 'URGENT') {
    const isClaimed = msg.metadata?.status === 'CLAIMED' || msg.metadata?.status === 'RESOLVED';
    const isClaimedByMe = msg.metadata?.claimedBy === user?.uid;

    return (
      <div className="flex justify-center w-full my-6 px-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-full max-w-md bg-stone-900 text-white rounded-[2.5rem] overflow-hidden shadow-2xl border-4 ${isClaimed ? 'border-stone-800 grayscale' : 'border-red-500/20'}`}
        >
          <div className={`px-6 py-4 flex items-center justify-between ${isClaimed ? 'bg-stone-800' : 'bg-red-500'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <Clock size={16} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Urgent Need</span>
            </div>
            {isClaimed && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                {msg.metadata?.status}
              </span>
            )}
          </div>
          
          <div className="p-8 space-y-6">
            <p className="serif text-2xl font-bold leading-tight">{msg.text}</p>
            
            {!isClaimed ? (
              <button 
                onClick={() => onClaim(msg.id)}
                className="w-full py-4 bg-white text-stone-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_8px_24px_rgba(255,255,255,0.2)] hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                I can help with this
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-stone-800 rounded-2xl border border-stone-700">
                <div className="w-10 h-10 bg-stone-700 rounded-xl flex items-center justify-center text-green-400">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-stone-500 block">Claimed By</span>
                  <span className="text-sm font-bold text-white">{isClaimedByMe ? 'You' : msg.metadata?.claimedByName}</span>
                </div>
              </div>
            )}
          </div>
          
          {!isClaimed && (
            <div className="bg-red-500/5 px-8 py-3 text-[9px] font-bold text-red-500/50 uppercase tracking-[0.2em] text-center">
              Broadcasting to all Circle members
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (msg.type === 'INVITE' && msg.invite) {
    const isJoined = profile?.joinedCircles?.includes(msg.invite.circleId);
    
    return (
      <div className="flex justify-center w-full my-6 px-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-[#FDFBF4] rounded-[2rem] overflow-hidden shadow-xl border border-[#D9D0C0] p-6 text-stone-900"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#D9D0C0] shrink-0 bg-stone-100">
              {msg.invite.circlePhotoURL ? (
                <img src={msg.invite.circlePhotoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                  <Users size={28} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a29b8c] mb-1">
                Circle Invitation
              </h4>
              <h3 className="serif text-lg font-bold text-stone-900 truncate">
                {msg.invite.circleName}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Join our neighborhood circle
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {isJoined ? (
              <div className="w-full py-3.5 bg-stone-100 text-stone-500 rounded-2xl font-black text-xs uppercase tracking-widest border border-stone-200 flex items-center justify-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Joined 🤝
              </div>
            ) : (
              <button 
                onClick={() => onJoinCircle?.(msg.invite!.circleId, msg.invite!.circleName)}
                className="w-full py-3.5 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Users size={16} />
                Join Circle
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (msg.type === 'SYSTEM') {
    return (
      <div className="flex justify-center w-full my-4 px-8">
        <div className="bg-stone-100/80 backdrop-blur-sm px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 border border-stone-200/50 flex items-center gap-2">
          <Info size={12} />
          {msg.text}
        </div>
      </div>
    );
  }

  const finalDisplayName = displayName || msg.senderName;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="flex flex-col max-w-[80%] gap-1">
        {finalDisplayName && (
          <span className={`text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 ${isOwn ? 'text-right pr-1' : 'pl-1'}`}>
            {finalDisplayName}
          </span>
        )}
        {msg.replyToText && (
          <div className={`flex items-center gap-2 px-3 py-1 text-[10px] text-stone-400 bg-stone-100 rounded-lg border border-stone-200 mb-1 ${isOwn ? 'mr-4 self-end' : 'ml-4 self-start'}`}>
            <MessageSquare size={10} />
            <span className="line-clamp-1">
              <span className="font-bold">{msg.replyToName || 'Neighbor'}:</span> {msg.replyToText}
            </span>
          </div>
        )}
        <div 
          className={`px-4 py-3 rounded-2xl text-sm shadow-sm relative group ${
            isOwn 
              ? 'bg-stone-900 text-white rounded-tr-none' 
              : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'
          }`}
        >
          {showOriginal ? msg.text : translatedText}
          
          <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${isOwn ? '-left-28' : '-right-28'}`}>
            <button 
              onClick={() => onReply(msg)}
              className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
              title="Reply"
            >
              <Plus size={14} />
            </button>
            {onOpenThread ? (
              <button 
                onClick={() => onOpenThread(msg)}
                className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
                title="Open Thread"
              >
                <MessageSquare size={14} />
              </button>
            ) : null}
            <button 
              onClick={handleTranslate}
              className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600"
              title={`Translate to ${targetLanguage}`}
            >
              {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
            </button>
          </div>
        </div>
        {msg.replyCount && msg.replyCount > 0 && (
          <button 
            onClick={() => onOpenThread(msg)}
            className={`text-[10px] font-black text-brand uppercase tracking-widest mt-1 flex items-center gap-1 hover:underline ${isOwn ? 'self-end' : 'self-start'}`}
          >
            <MessageSquare size={10} />
            {msg.replyCount} {msg.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
        {!showOriginal && translatedText && (
          <span className="text-[10px] text-stone-400 px-1 flex items-center gap-1">
            <Languages size={10} /> Translated to {targetLanguage}
            <button onClick={() => setShowOriginal(true)} className="underline ml-1">See original</button>
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatRoom({ chatId, onAction }: { chatId: string, onAction?: (type: 'ASK' | 'SHARE') => void }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [commonCircles, setCommonCircles] = useState<Circle[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);
  const [showGratitudeFlow, setShowGratitudeFlow] = useState(false);

  const [gratitudeSent, setGratitudeSent] = useState(false);

  const targetLanguage = profile?.preferredLanguage || 'English';

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const smileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target as Node) &&
        smileButtonRef.current &&
        !smileButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const insertEmoji = (emoji: string) => {
    if (!inputRef.current) {
      setText(prev => prev + emoji);
      return;
    }
    const input = inputRef.current;
    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setText(newText);
    
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };


  const [userCache, setUserCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const missingUids = new Set<string>();
    messages.forEach(msg => {
      if (!msg.senderName && msg.senderId && !userCache[msg.senderId]) {
        missingUids.add(msg.senderId);
      }
    });
    threadMessages.forEach(msg => {
      if (!msg.senderName && msg.senderId && !userCache[msg.senderId]) {
        missingUids.add(msg.senderId);
      }
    });

    if (missingUids.size === 0) return;

    missingUids.forEach(async (uid) => {
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserCache(prev => ({
            ...prev,
            [uid]: data.displayName || 'Neighbor'
          }));
        }
      } catch (err) {
        console.error("Error fetching user name for message:", err);
      }
    });
  }, [messages, threadMessages, userCache]);

  useEffect(() => {
    if (!item?.id || !user?.uid) {
      setGratitudeSent(false);
      return;
    }

    const q = query(
      collection(db, 'gratitude_notes'),
      where('itemId', '==', item.id),
      where('fromUserId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGratitudeSent(!snapshot.empty);
    }, (error) => {
      console.error('Error querying gratitude notes:', error);
    });

    return () => unsubscribe();
  }, [item?.id, user?.uid]);

  useEffect(() => {
    const unsubscribeChat = onSnapshot(doc(db, 'chats', chatId), (snapshot) => {
      if (snapshot.exists()) {
        const chatData = { id: snapshot.id, ...snapshot.data() } as Chat;
        setChat(chatData);

        // Mark as read
        if (user && chatData.unreadBy?.includes(user.uid)) {
          updateDoc(doc(db, 'chats', chatId), {
            unreadBy: arrayRemove(user.uid)
          }).catch(err => console.error("Could not clear unread count:", err));
        }
        
        if (chatData.type === 'DIRECT' && user) {
          const otherId = chatData.participants.find(p => p !== user.uid);
          if (otherId) {
            getDoc(doc(db, 'users', otherId)).then(async (userSnap) => {
              if (userSnap.exists()) {
                const otherProfile = { uid: userSnap.id, ...userSnap.data() } as UserProfile;
                setOtherUser(otherProfile);

                if (profile?.joinedCircles && otherProfile.joinedCircles) {
                  const commonIds = profile.joinedCircles.filter(id => 
                    otherProfile.joinedCircles?.includes(id)
                  );
                  
                  if (commonIds.length > 0) {
                    const fetchedCircles: Circle[] = [];
                    for (const id of commonIds) {
                      const circleSnap = await getDoc(doc(db, 'circles', id));
                      if (circleSnap.exists()) {
                        fetchedCircles.push({ id: circleSnap.id, ...circleSnap.data() } as Circle);
                      }
                    }
                    setCommonCircles(fetchedCircles);
                  }
                }
              }
            });
          }
        }
        
        if (chatData.itemId) {
          getDoc(doc(db, 'items', chatData.itemId)).then(itemSnap => {
            if (itemSnap.exists()) {
              setItem({ id: itemSnap.id, ...itemSnap.data() } as Item);
            }
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
    });

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(fetchedMessages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId]);

  // Keep chatRef always up-to-date so other effects can read the latest chat
  // without needing `chat` in their dependency array (which would cause re-subscriptions)
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);


  useEffect(() => {
    if (!activeThread) {
      setThreadMessages([]);
      return;
    }

    // Always read the latest chat from the ref — avoids stale closure where
    // `chat` captured when the thread was opened might have an outdated circleId
    const currentChat = chatRef.current;
    const baseQueryConstraints: any[] = [];
    if (currentChat) {
      if (currentChat.type === 'CHANNEL' && currentChat.circleId) {
        baseQueryConstraints.push(where('circleId', '==', currentChat.circleId));
      } else {
        baseQueryConstraints.push(where('participants', 'array-contains', user!.uid));
      }
    }

    const q = query(
      collection(db, 'chats', chatId, 'messages', activeThread.id, 'replies'),
      ...baseQueryConstraints,
      orderBy('createdAt', 'asc')
    );

    const unsubscribeThread = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
      setThreadMessages(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages/${activeThread.id}/replies`);
    });

    return () => unsubscribeThread();
  }, [chatId, activeThread]);


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText: string, type: 'TEXT' | 'POLL' | 'SYSTEM' | 'URGENT' = 'TEXT', pollOrMetadata?: any) => {
    if (!user) return;
    if (type === 'TEXT' && !messageText.trim()) return;

    try {
      const msgData: any = {
        chatId,
        senderId: user.uid,
        senderName: profile?.displayName || 'Neighbor',
        text: messageText,
        type,
        createdAt: serverTimestamp(),
        chatType: chat?.type || 'DIRECT',
        participants: chat?.participants || [],
        circleId: chat?.circleId || null
      };

      if (type === 'POLL') msgData.poll = pollOrMetadata;
      if (type === 'URGENT') msgData.metadata = pollOrMetadata?.metadata || { status: 'PENDING' };

      await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: type === 'POLL' ? `Poll: ${pollOrMetadata.question}` : 
                     type === 'URGENT' ? `🚨 SOS: ${messageText}` : messageText,
        updatedAt: serverTimestamp(),
        unreadBy: chat?.participants.filter(p => p !== user?.uid) || []
      });

      // Send notification if DIRECT chat
      if (chat?.type === 'DIRECT') {
        const recipientId = chat.participants.find(p => p !== user.uid);
        if (recipientId) {
          const displayMsg = type === 'POLL' ? 'Sent a poll' : 
                             type === 'URGENT' ? `🚨 SOS: ${messageText}` : messageText;
          sendNotification(
            recipientId,
            'new_message',
            `${profile?.displayName || 'Neighbor'}: ${displayMsg}`,
            `/chats/${chatId}`
          );
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    const messageText = text;
    setText('');
    
    const isUrgentThread = chat?.channelName === '#UrgentNeeds';
    const msgType = (isUrgentThread && messageText.length < 100) ? 'URGENT' : 'TEXT';
    
    const metadata = msgType === 'URGENT' ? { status: 'PENDING' } : undefined;
    
    const msgData: any = {
      chatId,
      senderId: user?.uid,
      senderName: profile?.displayName || 'Neighbor',
      text: messageText,
      type: msgType,
      createdAt: serverTimestamp(),
      chatType: chat?.type || 'DIRECT',
      participants: chat?.participants || [],
      circleId: chat?.circleId || null
    };

    if (activeThread) {
      // Sending to thread
      try {
        const docRef = await addDoc(collection(db, 'chats', chatId, 'messages', activeThread.id, 'replies'), msgData);

        // Optimistic update: show the message immediately so the user doesn't
        // have to close and re-open the thread if the snapshot is slow.
        // The listener will overwrite this entry (same doc ID) when it fires.
        setThreadMessages(prev => {
          if (prev.some(m => m.id === docRef.id)) return prev;
          return [...prev, { id: docRef.id, ...msgData, createdAt: { toMillis: () => Date.now() } as any }];
        });

        // Update parent message replyCount
        await updateDoc(doc(db, 'chats', chatId, 'messages', activeThread.id), {
          replyCount: (activeThread.replyCount || 0) + 1
        });

        // Send notification if DIRECT chat
        if (chat?.type === 'DIRECT') {
          const recipientId = chat.participants.find(p => p !== user?.uid);
          if (recipientId) {
            sendNotification(
              recipientId,
              'new_message',
              `${profile?.displayName || 'Neighbor'} replied: ${messageText}`,
              `/chats/${chatId}`
            );
          }
        }
      } catch (err) {
        console.error('Error sending reply:', err);
      }
    } else {
      // Normal message
      msgData.replyToId = replyingTo?.id || null;
      msgData.replyToText = replyingTo?.text || null;
      msgData.replyToName = replyingTo?.senderName || 'Neighbor';

      if (msgType === 'URGENT') msgData.metadata = metadata;
      
      try {
        await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
        setReplyingTo(null);

        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: msgType === 'URGENT' ? `🚨 SOS: ${messageText}` : messageText,
          updatedAt: serverTimestamp(),
          unreadBy: chat?.participants.filter(p => p !== user?.uid) || []
        });

        // Send notification if DIRECT chat
        if (chat?.type === 'DIRECT') {
          const recipientId = chat.participants.find(p => p !== user?.uid);
          if (recipientId) {
            sendNotification(
              recipientId,
              'new_message',
              `${profile?.displayName || 'Neighbor'}: ${messageText}`,
              `/chats/${chatId}`
            );
          }
        }
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
  };

  const createPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) return;
    
    const pollData = {
      question: pollQuestion,
      options: pollOptions.reduce((acc, opt, i) => {
        if (opt.trim()) {
          acc[`option_${i}`] = { text: opt, votes: [] };
        }
        return acc;
      }, {} as any)
    };

    await sendMessage('', 'POLL', pollData);
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const handleVote = async (messageId: string, optionKey: string) => {
    if (!user) return;
    
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;
    
    const msgData = msgSnap.data() as Message;
    if (!msgData.poll) return;

    // Remove user votes from all options first to allow re-voting (or just use one vote)
    const newOptions = { ...msgData.poll.options };
    Object.keys(newOptions).forEach(key => {
      newOptions[key].votes = newOptions[key].votes.filter(v => v !== user.uid);
    });
    
    // Add new vote
    newOptions[optionKey].votes.push(user.uid);

    await updateDoc(msgRef, {
      'poll.options': newOptions
    });
  };

  const confirmHandover = async () => {
    if (!item || item.ownerId !== user?.uid) return;
    
    try {
      await updateDoc(doc(db, 'items', item.id), {
        status: 'COMPLETED'
      });
      
      await sendMessage(`${profile?.displayName || 'Owner'} marked this as completed. Handover confirmed!`, 'SYSTEM');
      
      setItem(prev => prev ? { ...prev, status: 'COMPLETED' } : null);
    } catch (err) {
      console.error('Error confirming handover:', err);
    }
  };

  const handleClaim = async (messageId: string) => {
    if (!user || !profile) return;
    
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(msgRef, {
      'metadata.status': 'CLAIMED',
      'metadata.claimedBy': user.uid,
      'metadata.claimedByName': profile.displayName || 'Neighbor'
    });
    
    await sendMessage(`${profile.displayName || 'Neighbor'} is on it! Claimed this urgent need.`, 'SYSTEM');
  };

  const handleJoinCircle = async (circleId: string, circleName: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'circles', circleId, 'members', user.uid), {
        joinedAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'users', user.uid), {
        joinedCircles: arrayUnion(circleId)
      });

      const circleRef = doc(db, 'circles', circleId);
      const circleSnap = await getDoc(circleRef);
      if (circleSnap.exists()) {
        await updateDoc(circleRef, {
          memberCount: (circleSnap.data().memberCount || 0) + 1
        });
      }

      const systemMessageText = `${profile?.displayName || 'Neighbor'} joined the circle "${circleName}"!`;
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: 'system',
        senderName: 'System',
        text: systemMessageText,
        type: 'SYSTEM',
        createdAt: serverTimestamp(),
        chatType: chat?.type || 'DIRECT',
        participants: chat?.participants || [],
        circleId: chat?.circleId || null
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: systemMessageText,
        updatedAt: serverTimestamp(),
        unreadBy: chat?.participants.filter(p => p !== user?.uid) || []
      });

    } catch (err) {
      console.error('Error joining circle from chat invite:', err);
    }
  };


  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-stone-50/50">
      {/* Context Header */}
      {item && (
        <div className="bg-white border-b border-stone-100 p-4 shadow-sm z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-stone-100 rounded-2xl overflow-hidden shadow-inner border border-stone-50">
                {item.images?.[0] ? (
                  <img referrerPolicy="no-referrer" src={item.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={getFallbackImage(item.category)} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <h3 className="serif text-sm font-bold text-stone-900 leading-tight line-clamp-1">{item.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    item.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    item.status === 'MATCHED' ? 'bg-amber-100 text-amber-700' :
                    'bg-stone-100 text-stone-500'
                  }`}>
                    {item.status}
                  </span>
                  <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest flex items-center gap-1">
                    <Clock size={10} />
                    Coordination
                  </span>
                </div>
              </div>
            </div>
            
            {item.ownerId === user?.uid && (item.status === 'ACTIVE' || item.status === 'MATCHED') && (
              <button 
                onClick={confirmHandover}
                className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-black transition-all active:scale-95"
              >
                <CheckCircle2 size={14} className="text-amber-400" />
                <span>Confirm Handover</span>
              </button>
            )}

            {item.status === 'COMPLETED' && otherUser && (
              gratitudeSent ? (
                <button 
                  disabled
                  className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 text-stone-400 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-stone-200"
                >
                  <span>Gratitude Sent 💚</span>
                </button>
              ) : (
                <button 
                  onClick={() => setShowGratitudeFlow(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white hover:bg-stone-800 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
                >
                  <Heart size={14} className="text-emerald-500" fill="currentColor" />
                  <span>Say Thanks</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {chat?.type === 'DIRECT' && otherUser && (
        <div className="bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-100 rounded-2xl overflow-hidden border border-stone-50">
              {otherUser.photoURL ? (
                <img src={otherUser.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300 font-bold">
                  {otherUser.displayName?.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 leading-tight">{otherUser.displayName}</h2>
              {commonCircles.length > 0 ? (
                <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in slide-in-from-left-2 duration-1000">
                  <div className="flex -space-x-1">
                    {commonCircles.slice(0, 3).map((c, i) => (
                      <div key={c.id} className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-white flex items-center justify-center" style={{ zIndex: 10 - i }}>
                        <Users size={8} className="text-stone-900" />
                      </div>
                    ))}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-brand">
                    In Common: {commonCircles.map(c => c.name).join(', ')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 italic">
                    Neighbor Discovery
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Channel Header Removed */}

      {chat?.channelName === '#UrgentNeeds' && messages.filter(m => m.type === 'URGENT' && m.metadata?.status === 'PENDING').length > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-900">
              {messages.filter(m => m.type === 'URGENT' && m.metadata?.status === 'PENDING').length} Active Needs
            </span>
          </div>
          <span className="text-[9px] font-bold text-amber-700 italic">Neighbors are coordinating...</span>
        </div>
      )}

      {/* Thread navigation bar — shown whenever a thread is open */}
      {activeThread && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-stone-100 shadow-sm z-10 flex-none">
          <button
            onClick={() => setActiveThread(null)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-all active:scale-95"
            aria-label="Back to chat"
          >
            <ArrowLeft size={16} />
            <span className="text-[11px] font-black uppercase tracking-widest">Back</span>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Thread</span>
            <span className="text-xs font-semibold text-stone-700 line-clamp-1">
              {activeThread.text}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {activeThread && (
          <div className="mb-6 p-4 bg-stone-50 rounded-[2rem] border border-stone-100">
            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1 mb-3">
              <MessageSquare size={10} /> Root message
            </span>
            <ChatMessage 
              msg={activeThread} 
              isOwn={activeThread.senderId === user?.uid} 
              targetLanguage={targetLanguage}
              onVote={handleVote}
              onClaim={handleClaim}
              onReply={setReplyingTo}
              displayName={activeThread.senderName || userCache[activeThread.senderId] || (activeThread.senderId === user?.uid ? (profile?.displayName || 'You') : 'Neighbor')}
              onJoinCircle={handleJoinCircle}
            />
            <div className="mt-6 mb-2 flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-stone-200" />
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                {threadMessages.length} {threadMessages.length === 1 ? 'Response' : 'Responses'}
              </span>
              <div className="h-[1px] flex-1 bg-stone-200" />
            </div>
          </div>
        )}

        {(activeThread ? threadMessages : messages).map((msg) => (
          <ChatMessage 
            key={msg.id} 
            msg={msg} 
            isOwn={msg.senderId === user?.uid} 
            targetLanguage={targetLanguage}
            onVote={handleVote}
            onClaim={handleClaim}
            onReply={setReplyingTo}
            onOpenThread={activeThread ? undefined : setActiveThread}
            displayName={msg.senderName || userCache[msg.senderId] || (msg.senderId === user?.uid ? (profile?.displayName || 'You') : 'Neighbor')}
            onJoinCircle={handleJoinCircle}
          />
        ))}
        {(activeThread ? threadMessages : messages).length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-300">
              <MessageSquare size={32} />
            </div>
            <div>
              <h4 className="serif text-xl font-bold text-stone-400">Start the conversation</h4>
              <p className="text-stone-300 text-sm italic">Neighbors are waiting to connect!</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {replyingTo && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-stone-100 border-t border-stone-200 px-6 py-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <MessageSquare size={12} className="text-stone-400 shrink-0" />
              <div className="text-[10px] text-stone-500 font-medium truncate">
                Replying to <span className="font-bold">{replyingTo.senderName || 'Neighbor'}</span>: <span className="italic">"{replyingTo.text}"</span>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-stone-400 hover:text-stone-900 p-1">
              <X size={14} />
            </button>
          </motion.div>
        )}
        {showPollCreator && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-t border-stone-100 p-6 space-y-4 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Create Circle Poll</h4>
              <button onClick={() => setShowPollCreator(false)} className="text-stone-400 hover:text-stone-900">
                <X size={16} />
              </button>
            </div>
            <input 
              type="text" 
              placeholder="The Question..."
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-1 focus:ring-stone-900 shadow-inner"
            />
            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={`Option ${i+1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                    className="flex-1 bg-white border border-stone-100 rounded-xl px-4 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-stone-900"
                  />
                  {pollOptions.length > 2 && (
                    <button 
                      onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-2 text-stone-300 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={() => setPollOptions(prev => [...prev, ''])}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand px-2 py-1"
              >
                <Plus size={12} />
                Add Option
              </button>
            </div>
            <button 
              onClick={createPoll}
              disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-md hover:bg-black transition-all disabled:opacity-50"
            >
              Post Poll to Circle
            </button>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Emoji Picker Popover */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiPickerRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-[76px] left-4 bg-[#FDFBF4] border border-[#D9D0C0] rounded-3xl p-4 shadow-xl z-20 w-72"
          >
            {/* Triangular arrow indicator pointing to Smile button */}
            <div className="absolute -bottom-2 left-[22px] w-4 h-4 bg-[#FDFBF4] border-r border-b border-[#D9D0C0] rotate-45" />
            
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 px-1 flex justify-between items-center relative z-10">
              <span>Neighborly Emojis</span>
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2 relative z-10">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="w-10 h-10 flex items-center justify-center text-xl rounded-xl hover:bg-stone-100/50 active:scale-90 transition-all"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form 
        onSubmit={handleSend}
        className="p-4 bg-white border-t border-stone-100 flex items-center gap-2 relative z-10"
      >
        <button 
          ref={smileButtonRef}
          type="button" 
          onClick={() => setShowEmojiPicker(prev => !prev)}
          className={`p-2 transition-colors rounded-full ${showEmojiPicker ? 'text-[#a29b8c] bg-stone-100' : 'text-stone-500 hover:text-stone-700'}`}
          aria-label="Choose emoji"
        >
          <Smile size={20} />
        </button>
        <input 
          ref={inputRef}
          type="text" 
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-stone-100 border-none rounded-2xl px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-1 focus:ring-stone-900 outline-none"
        />
        <button 
          type="submit"
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-md ${
            text.trim() 
              ? 'bg-stone-900 text-white hover:bg-stone-800' 
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
          disabled={!text.trim()}
        >
          <Send size={18} />
        </button>
      </form>

      {showGratitudeFlow && otherUser && item && (
        <GratitudeFlow
          recipientId={otherUser.uid}
          recipientName={otherUser.displayName || 'Neighbor'}
          recipientPhoto={otherUser.photoURL}
          itemId={item.id}
          itemTitle={item.title}
          itemType={item.type}
          onClose={() => setShowGratitudeFlow(false)}
          onComplete={() => {
            setShowGratitudeFlow(false);
            setGratitudeSent(true);
          }}
        />
      )}
    </div>
  );
}
