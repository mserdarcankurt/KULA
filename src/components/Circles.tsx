/**
 * FILE: Circles.tsx
 * ROLE IN KULA: The "Micro-Communities Hub" — create, browse, and interact within Circles.
 * 
 * ARCHITECTURE:
 *   Circles are the primary GROUP FORMATION mechanism in KULA. They serve as
 *   intentional communities within the broader neighborhood network. Each circle
 *   acts as a self-contained sub-app with its own Feed, Discovery, Chat, and Members.
 * 
 * DATA MODEL (Firestore):
 *   circles/{circleId}                    → Circle metadata (name, privacy, memberCount)
 *   circles/{circleId}/members/{userId}   → Membership records (joinedAt timestamp)
 *   users/{userId}.joinedCircles          → Array of circle IDs (denormalized for fast lookups)
 * 
 * PRIVACY TIERS:
 *   - PUBLIC: Visible to all, anyone can join
 *   - PRIVATE: Visible in listings, requires invite code to join
 *   - HIDDEN: Not listed at all; only accessible via direct circle ID/code
 *     → When last member leaves, circle auto-transitions to HIDDEN (soft delete)
 * 
 * CIRCLE INTERIOR (selectedCircle):
 *   When a circle is selected, the component renders a tabbed sub-app:
 *   - FEED: Renders Feed.tsx filtered by circleId
 *   - CHAT: Shows 4 channel rooms (#General, #Announcements, #DailyGratitude, #UrgentNeeds)
 *     Each channel creates a CHANNEL-type chat doc with ID: circle_{id}_{channel}
 *   - DISCOVERY: Renders Discovery.tsx (swipe mode) filtered by circleId
 *   - POST: Renders PostItem.tsx with initialCircleId pre-filled
 *   - MEMBERS: Lists all circle members with direct message buttons
 * 
 * JOIN METHODS:
 *   1. Click "Join" on a PUBLIC circle card
 *   2. Enter circle ID/code in the "Join by Code" form (for PRIVATE/HIDDEN)
 *   3. Swipe right on a circle_invite card in Discovery.tsx
 * 
 * LEAVE FLOW:
 *   Leaving a circle requires:
 *   1. Unmount children FIRST (prevents snapshot permission errors)
 *   2. Wait 100ms for React to unsubscribe listeners
 *   3. Update memberCount (if 0 → set privacy to HIDDEN)
 *   4. Delete membership doc + remove from joinedCircles array
 * 
 * CALLED BY: Explore.tsx (CIRCLES view mode)
 */
import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { fetchUserDocsByIds } from '../lib/batchFetch';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Circle, UserProfile, Chat } from '../types';
import { Users, Plus, Star, MapPin, CheckCircle2, ShieldCheck, X, ArrowLeft, Layers, Map as MapIcon, LogOut, Send, Hash, MessageCircle, History, Search, Image as ImageIcon, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ART_DIRECTION } from '../lib/artDirection';
import Feed from './Feed';
import Discovery from './Discovery';
import PostItem from './PostItem';
import ChatRoom from './ChatRoom';

interface CirclesProps {
  onNavigateToChat?: (chatId: string) => void;
  selectedCircleId?: string | null;
  onClearSelection?: () => void;
}

interface CircleCardProps {
  circle: Circle;
  profile: any;
  onJoin: (id: string) => void;
  onLeave: (e: any, id: string) => void;
  onSelect: (circle: Circle) => void;
}

function CircleCard({ circle, profile, onJoin, onLeave, onSelect }: CircleCardProps) {
  const isJoined = profile?.joinedCircles?.includes(circle.id);
  
  const handleDragEnd = (_: any, info: any) => {
    // Swipe Right (Open/Join)
    if (info.offset.x > 80) {
      if (!isJoined) {
        onJoin(circle.id);
      }
      // Give join state a moment to propagate if needed, but usually we can just select it
      onSelect(circle);
    }
    // Swipe Left (Leave - only if joined)
    else if (info.offset.x < -80 && isJoined) {
      onLeave({ stopPropagation: () => {} } as any, circle.id);
    }
  };

  return (
    <motion.div 
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      onClick={() => isJoined && onSelect(circle)}
      className={`relative p-6 bg-white border border-stone-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all group overflow-hidden touch-pan-y ${
        isJoined ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Swipe Indicators */}
      <div className="absolute inset-y-0 left-0 w-1 bg-green-500 opacity-0 group-hover:opacity-20 transition-opacity" />
      <div className="absolute inset-y-0 right-0 w-1 bg-red-500 opacity-0 group-hover:opacity-20 transition-opacity" />

      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center text-brand">
            {circle.photoURL ? (
              <img referrerPolicy="no-referrer" src={circle.photoURL} alt={circle.name} className="w-full h-full object-cover" />
            ) : (
              <Users size={20} />
            )}
          </div>
          <div>
            <h4 className="serif text-xl font-bold text-stone-900 flex items-center gap-2">
              {circle.name}
              {circle.privacy === 'PRIVATE' && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-widest font-black">Private</span>}
              {circle.privacy === 'HIDDEN' && <span className="text-[8px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded uppercase tracking-widest font-black">Hidden</span>}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isJoined ? (
            <div className="flex items-center gap-1 group/joined">
              <div className="flex items-center gap-2 px-4 py-1.5 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                <ShieldCheck size={14} className="text-amber-400" />
                <span>Joined</span>
              </div>
              <button 
                onClick={(e) => onLeave(e, circle.id)}
                className="p-2 text-stone-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Leave Circle"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onJoin(circle.id); }}
              className="px-4 py-1.5 bg-stone-100 border border-stone-200 text-brand rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-brand hover:text-white transition-all shadow-sm"
            >
              Join
            </button>
          )}
        </div>
      </div>
      <p className="text-stone-500 text-sm italic line-clamp-2 mb-4 leading-relaxed">
        {circle.description || "A safe space for neighbors to connect and share."}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
           <span className="flex items-center gap-1">
             <Users size={12} strokeWidth={3} />
             {circle.memberCount || 1} members
           </span>
           <span className="flex items-center gap-1">
             <Star size={12} strokeWidth={3} />
             Active
           </span>
        </div>
        {isJoined ? (
           <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] opacity-0 group-hover:opacity-100 transition-opacity">
             Enter Space →
           </span>
        ) : (
          <span className="text-[10px] font-black uppercase tracking-widest text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">
             Swipe Right to Join →
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function Circles({ onNavigateToChat, selectedCircleId, onClearSelection }: CirclesProps = {}) {
  const { user, profile } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingInviteCircle, setPendingInviteCircle] = useState<Circle | null>(null);
  const [loadingPendingInvite, setLoadingPendingInvite] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [directChats, setDirectChats] = useState<{ chat: Chat; otherUserProfile: UserProfile | null }[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [sentInvites, setSentInvites] = useState<Record<string, boolean>>({});
  const [invitingChatId, setInvitingChatId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE' | 'HIDDEN'>('PUBLIC');
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [circleView, setCircleView] = useState<'FEED' | 'DISCOVERY' | 'POST' | 'CHAT' | 'MEMBERS'>('FEED');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [preSelectedPostType, setPreSelectedPostType] = useState<'ASK' | 'SHARE'>('SHARE');
  const [circleMembers, setCircleMembers] = useState<UserProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'JOINED' | 'DISCOVER'>('ALL');
  const [sortBy, setSortBy] = useState<'RECENT' | 'NAME' | 'MEMBERS'>('RECENT');
  const [showFilters, setShowFilters] = useState(false);
  const [showInfoCard, setShowInfoCard] = useState(true);


  const channels = ['#General', '#Announcements', '#DailyGratitude', '#UrgentNeeds'];

  useEffect(() => {
    let unsubscribe = () => {};
    
    const fetchCircles = async () => {
      setLoading(true);
      
      // 1. Fetch public/private circles (listable)
      const q = query(
        collection(db, 'circles'), 
        where('privacy', '!=', 'HIDDEN')
      );
      
      unsubscribe = onSnapshot(q, async (snapshot) => {
        const publicCircles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Circle));
        publicCircles.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        
        // 2. Fetch joined circles explicitly (including HIDDEN ones)
        const joinedCircleIds = (profile?.joinedCircles || []).filter(id => !publicCircles.some(c => c.id === id));
        const joinedHiddenCircles: Circle[] = [];
        
        if (joinedCircleIds.length > 0) {
          for (const cid of joinedCircleIds.slice(0, 30)) {
            try {
              const cSnap = await getDoc(doc(db, 'circles', cid));
              if (cSnap.exists()) {
                joinedHiddenCircles.push({ id: cSnap.id, ...cSnap.data() } as Circle);
              }
            } catch (err: any) {
              if (err?.code !== 'permission-denied') {
                console.error("Error fetching hidden joined circle:", err);
              }
            }
          }
        }
        
        setCircles([...publicCircles, ...joinedHiddenCircles]);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'circles');
        setLoading(false);
      });
    };

    fetchCircles();
    return () => unsubscribe();
  }, [profile?.joinedCircles]);

  // Handle external selection (from App.tsx/Discovery)
  useEffect(() => {
    if (selectedCircleId) {
      const isMember = profile?.joinedCircles?.includes(selectedCircleId);
      if (isMember) {
        const found = circles.find(c => c.id === selectedCircleId);
        if (found) {
          setSelectedCircle(found);
          setPendingInviteCircle(null);
        } else {
          getDoc(doc(db, 'circles', selectedCircleId)).then(snap => {
            if (snap.exists()) {
              setSelectedCircle({ id: snap.id, ...snap.data() } as Circle);
            }
            setPendingInviteCircle(null);
          });
        }
      } else {
        setLoadingPendingInvite(true);
        getDoc(doc(db, 'circles', selectedCircleId)).then(snap => {
          if (snap.exists()) {
            setPendingInviteCircle({ id: snap.id, ...snap.data() } as Circle);
          } else {
            alert("Circle invitation link is invalid or the circle no longer exists.");
            onClearSelection?.();
          }
          setLoadingPendingInvite(false);
        }).catch(err => {
          console.error("Error fetching pending invite circle:", err);
          setLoadingPendingInvite(false);
        });
      }
    } else {
      setPendingInviteCircle(null);
    }
  }, [selectedCircleId, circles, profile?.joinedCircles]);

  // Fetch direct chats when invite modal opens
  useEffect(() => {
    if (!showInviteModal || !user) return;
    
    setLoadingChats(true);
    setSentInvites({});
    
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    
    getDocs(q).then(async (snapshot) => {
      const allChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      const dChats = allChats.filter(c => c.type === 'DIRECT');
      
      const resolvedChats: { chat: Chat; otherUserProfile: UserProfile | null }[] = [];
      for (const chat of dChats) {
        const otherUserId = chat.participants.find(id => id !== user.uid);
        if (otherUserId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherUserId));
            resolvedChats.push({
              chat,
              otherUserProfile: userSnap.exists() ? ({ uid: userSnap.id, ...userSnap.data() } as UserProfile) : null
            });
          } catch (e) {
            console.error("Error fetching other user profile:", e);
            resolvedChats.push({ chat, otherUserProfile: null });
          }
        }
      }
      
      setDirectChats(resolvedChats);
      setLoadingChats(false);
    }).catch(err => {
      console.error("Error fetching direct chats for invite:", err);
      setLoadingChats(false);
    });
  }, [showInviteModal, user]);

  useEffect(() => {
    if (!selectedCircle || circleView !== 'MEMBERS') return;
    
    setLoadingMembers(true);
    const q = query(collection(db, 'circles', selectedCircle.id, 'members'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const memberIds = snapshot.docs.map(doc => doc.id);
      
      try {
        // Batched: chunked 'in' queries instead of one sequential getDoc per
        // member (the comment used to claim batching — now it's true).
        const profiles = await fetchUserDocsByIds(memberIds);
        const memberProfiles = memberIds
          .filter(id => profiles.has(id))
          .map(id => ({ uid: id, ...profiles.get(id) } as UserProfile));
        setCircleMembers(memberProfiles);
      } catch (err) {
        console.error("Error fetching member profiles:", err);
      } finally {
        setLoadingMembers(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `circles/${selectedCircle.id}/members`);
      setLoadingMembers(false);
    });

    return unsubscribe;
  }, [selectedCircle, circleView]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setPhotoURL(url);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || submitting) return;

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'circles'), {
        name,
        description,
        creatorId: user.uid,
        privacy,
        photoURL: photoURL || null,
        // Starts at 0 — the onCircleMemberCreated trigger increments it when
        // the creator's member doc (written just below) lands.
        memberCount: 0,
        createdAt: serverTimestamp()
      });

      // Join the circle automatically
      await setDoc(doc(db, 'circles', docRef.id, 'members', user.uid), {
        joinedAt: serverTimestamp()
      });

      // Update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        joinedCircles: arrayUnion(docRef.id)
      });

      setShowCreate(false);
      setName('');
      setDescription('');
      setPhotoURL('');
    } catch (err) {
      console.error('Error creating circle:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (circleId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'circles', circleId, 'members', user.uid), {
        joinedAt: serverTimestamp()
      });
      
      // Update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        joinedCircles: arrayUnion(circleId)
      });
      // memberCount is maintained server-side by onCircleMemberCreated.
    } catch (err) {
      console.error('Error joining circle:', err);
    }
  };

  const handleLeave = async (e: React.MouseEvent, circleId: string) => {
    e.stopPropagation();
    if (!user || leavingId) return;
    
    // Using a more reliable way than window.confirm in iframes
    setLeavingId(circleId);
  };

  const confirmLeave = async () => {
    if (!user || !leavingId) return;
    const circleId = leavingId;
    setLeavingId(null);

    // Unmount view BEFORE removing membership to prevent snapshot listeners from throwing permissions errors
    if (selectedCircle?.id === circleId) {
      setSelectedCircle(null);
      onClearSelection?.();
    }

    // Give React time to unmount children and unsubscribe snapshot listeners
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // memberCount (and auto-hiding empty circles) is maintained server-side
      // by onCircleMemberDeleted — deleting the member doc is all we do here.
      await deleteDoc(doc(db, 'circles', circleId, 'members', user.uid));
      
      // Update user profile
      await updateDoc(doc(db, 'users', user.uid), {
        joinedCircles: arrayRemove(circleId)
      });
    } catch (err) {
      console.error('Error leaving circle:', err);
      alert("Failed to leave circle. Please try again.");
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode || joiningCode) return;

    setJoiningCode(true);
    try {
      const circleRef = doc(db, 'circles', joinCode.trim());
      const circleSnap = await getDoc(circleRef);

      if (!circleSnap.exists()) {
        alert("Circle not found. Please check the code.");
        return;
      }

      await handleJoin(joinCode.trim());
      setShowJoinCode(false);
      setJoinCode('');
    } catch (err) {
      console.error('Error joining circle by code:', err);
      alert("Failed to join circle. Make sure the code is correct.");
    } finally {
      setJoiningCode(false);
    }
  };

  const handleSendDirectInvite = async (chatId: string) => {
    if (!user || !selectedCircle) return;
    setInvitingChatId(chatId);
    
    try {
      const inviteMsg = `Check out our neighborhood circle "${selectedCircle.name}"!`;
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: profile?.displayName || 'Neighbor',
        text: inviteMsg,
        type: 'INVITE',
        invite: {
          circleId: selectedCircle.id,
          circleName: selectedCircle.name,
          circlePhotoURL: selectedCircle.photoURL || null
        },
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: `Circle Invitation: ${selectedCircle.name}`,
        updatedAt: serverTimestamp(),
        unreadBy: directChats.find(dc => dc.chat.id === chatId)?.chat.participants.filter(p => p !== user.uid) || []
      });
      
      setSentInvites(prev => ({ ...prev, [chatId]: true }));
    } catch (err) {
      console.error("Error sending circle invite message:", err);
    } finally {
      setInvitingChatId(null);
    }
  };

  const filteredAndSortedCircles = circles
    .filter(circle => {
      const matchesSearch = circle.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           circle.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const isJoined = profile?.joinedCircles?.includes(circle.id);
      
      if (filterStatus === 'JOINED') return matchesSearch && isJoined;
      if (filterStatus === 'DISCOVER') return matchesSearch && !isJoined;
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'NAME') return a.name.localeCompare(b.name);
      if (sortBy === 'MEMBERS') return (b.memberCount || 0) - (a.memberCount || 0);
      // RECENT
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

  const openChannel = async (channelName: string) => {
    if (!selectedCircle) return;
    
    const chatId = `circle_${selectedCircle.id}_${channelName.replace('#', '').toLowerCase()}`;
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        type: 'CHANNEL',
        circleId: selectedCircle.id,
        channelName,
        participants: [], // In circle channels, anyone in the circle can join
        lastMessage: `Welcome to ${channelName}!`,
        updatedAt: serverTimestamp()
      });
    }
    
    setSelectedChannel(chatId);
  };

  const startPrivateChat = async (targetUserId: string) => {
    if (!user || targetUserId === user.uid) return;
    
    try {
      // Fetch all direct chats for the current user
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('type', '==', 'DIRECT'),
        where('participants', 'array-contains', user.uid)
      );
      
      const snapshot = await getDocs(q);
      const existingChat = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.participants.includes(targetUserId);
      });

      if (existingChat) {
        setSelectedChannel(existingChat.id);
      } else {
        const newChatRef = await addDoc(chatsRef, {
          type: 'DIRECT',
          participants: [user.uid, targetUserId],
          lastMessage: 'Conversation started',
          updatedAt: serverTimestamp()
        });
        setSelectedChannel(newChatRef.id);
      }
    } catch (err) {
      console.error('Error starting private chat:', err);
    }
  };

  const handleChatTabClick = async () => {
    if (!selectedCircle) return;
    setCircleView('CHAT');
    
    const chatId = `circle_${selectedCircle.id}_general`;
    setSelectedChannel(chatId);
    
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          type: 'CHANNEL',
          circleId: selectedCircle.id,
          channelName: '#General',
          participants: [],
          lastMessage: `Welcome to #General!`,
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Error creating general circle chat:', err);
    }
  };

  if (loadingPendingInvite) {
    return (
      <div className="h-full flex items-center justify-center bg-[#FDFBF4]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-800" />
      </div>
    );
  }

  if (pendingInviteCircle) {
    const isJoining = joiningCode;
    
    return (
      <div className="h-full flex flex-col bg-[#FDFBF4] overflow-hidden items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-white border border-[#D9D0C0] p-8 rounded-[2.5rem] shadow-xl relative"
        >
          <button 
            onClick={() => {
              setPendingInviteCircle(null);
              onClearSelection?.();
            }}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="w-24 h-24 rounded-[2rem] overflow-hidden border border-[#D9D0C0] mx-auto mb-6 shadow-inner bg-stone-50">
            {pendingInviteCircle.photoURL ? (
              <img src={pendingInviteCircle.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#a29b8c]">
                <Users size={40} />
              </div>
            )}
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a29b8c] block mb-2">
            Circle Invitation
          </span>
          <h2 className="serif text-2xl font-bold text-stone-900 mb-2 leading-tight">
            {pendingInviteCircle.name}
          </h2>
          <p className="text-stone-500 text-sm italic mb-8">
            {pendingInviteCircle.description || 'Welcome! You have been invited to join this neighborhood circle.'}
          </p>

          <div className="space-y-4">
            <button 
              onClick={async () => {
                setJoiningCode(true);
                try {
                  await handleJoin(pendingInviteCircle.id);
                } catch (e) {
                  console.error("Error joining from invite screen:", e);
                } finally {
                  setJoiningCode(false);
                }
              }}
              disabled={isJoining}
              className="w-full py-4 bg-stone-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <Users size={16} />
                  <span>Join Circle</span>
                </>
              )}
            </button>

            <button 
              onClick={() => {
                setPendingInviteCircle(null);
                onClearSelection?.();
              }}
              className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (selectedCircle) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/50">
          <button 
            onClick={() => {
              if (selectedChannel) {
                setSelectedChannel(null);
                setCircleView('FEED');
              } else {
                setSelectedCircle(null);
                onClearSelection?.();
              }
            }}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-900 transition-colors mb-4 text-[10px] uppercase font-black tracking-widest"
          >
            <ArrowLeft size={16} />
            <span>{selectedChannel ? 'Circle Feed' : 'All Circles'}</span>
          </button>
          
          <div className="flex justify-between items-start">
            <div>
              <h2 className="serif text-3xl font-bold text-stone-900">{selectedCircle.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-stone-500 italic text-sm">{selectedCircle.description}</p>
                <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-stone-100 rounded text-[9px] font-black uppercase tracking-widest text-stone-400">
                  <Hash size={10} />
                  <span>ID: {selectedCircle.id}</span>
                </div>
              </div>
            </div>
            {!selectedChannel && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowInviteModal(true)}
                  className="p-2 text-stone-500 hover:text-[#5B8266] transition-colors"
                  title="Invite Neighbors"
                >
                  <Share2 size={20} />
                </button>
                <button 
                  onClick={(e) => handleLeave(e, selectedCircle.id)}
                  className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                  title="Leave Circle"
                >
                  <LogOut size={20} />
                </button>
              </div>
            )}
          </div>

          <div className="flex bg-stone-100 p-1 rounded-2xl w-fit overflow-x-auto no-scrollbar max-w-full">
            <button 
              onClick={() => { setCircleView('FEED'); setSelectedChannel(null); }}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                circleView === 'FEED' && !selectedChannel ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'
              }`}
            >
              <Layers size={14} />
              <span>Feed</span>
            </button>
            <button 
              onClick={handleChatTabClick}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                circleView === 'CHAT' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'
              }`}
            >
              <MessageCircle size={14} />
              <span>Chat</span>
            </button>
            <button 
              onClick={() => { setCircleView('POST'); setSelectedChannel(null); }}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                circleView === 'POST' && !selectedChannel ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'
              }`}
            >
              <Send size={14} />
              <span>Post</span>
            </button>
            <button 
              onClick={() => { setCircleView('MEMBERS'); setSelectedChannel(null); }}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                circleView === 'MEMBERS' && !selectedChannel ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'
              }`}
            >
              <Users size={14} />
              <span>Members</span>
            </button>
          </div>
        </div>

        {selectedChannel ? (
          <ChatRoom 
            chatId={selectedChannel} 
            onAction={(type) => {
              setPreSelectedPostType(type);
              setCircleView('POST');
              setSelectedChannel(null);
            }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {circleView === 'FEED' ? (
              <Feed location={profile?.location || null} circleId={selectedCircle.id} onNavigateToChat={onNavigateToChat} />
            ) : circleView === 'CHAT' ? (
              <div className="flex items-center justify-center py-20 text-stone-400 font-serif italic animate-pulse">
                Opening chat space...
              </div>
            ) : circleView === 'DISCOVERY' ? (
              <Discovery location={profile?.location || null} circleId={selectedCircle.id} onNavigateToChat={onNavigateToChat} />
            ) : circleView === 'MEMBERS' ? (
              <div className="p-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-6 px-1">Circle Members ({circleMembers.length})</h4>
                {loadingMembers ? (
                  <div className="text-center py-20 text-stone-300 italic">Loading neighbors...</div>
                ) : (
                  <div className="grid gap-4">
                    {circleMembers.map((member) => (
                      <div 
                        key={member.uid}
                        className="flex items-center justify-between p-4 bg-white border border-stone-100 rounded-3xl group hover:border-stone-200 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-stone-100 rounded-2xl overflow-hidden border border-stone-50">
                            {member.photoURL ? (
                              <img referrerPolicy="no-referrer" src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300 font-bold">
                                {member.displayName?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                               <span className="font-bold text-stone-900">{member.displayName}</span>
                               {member.uid === user?.uid && <span className="text-[8px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">You</span>}
                            </div>
                            <p className="text-[10px] text-stone-400 font-medium line-clamp-1 italic">{member.bio || "Active neighbor"}</p>
                          </div>
                        </div>
                        
                        {member.uid !== user?.uid && (
                          <button 
                            onClick={() => startPrivateChat(member.uid)}
                            className="p-3 bg-stone-50 text-stone-400 hover:bg-stone-900 hover:text-white rounded-2xl transition-all shadow-inner group-hover:shadow-md"
                            title={`Message ${member.displayName}`}
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <PostItem 
                location={profile?.location || null} 
                onSuccess={() => setCircleView('FEED')} 
                onCancel={() => setCircleView('FEED')}
                initialCircleId={selectedCircle.id} 
                initialType={preSelectedPostType}
              />
            )}
          </div>
        )}
        <AnimatePresence>
          {leavingId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
                onClick={() => setLeavingId(null)}
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-xs w-full text-center border-2 border-stone-900"
              >
                <div className="w-16 h-16 bg-[#C86A51]/10 text-[#C86A51] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <LogOut size={32} />
                </div>
                <h3 className="serif text-2xl font-bold text-stone-900 mb-2">Leaving Circle?</h3>
                <p className="text-stone-500 text-sm italic mb-8">
                  You can always rejoin later if the circle is public or you have the code.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setLeavingId(null)}
                    className={`py-4 ${ART_DIRECTION.buttons.secondary} rounded-2xl font-black text-[10px] uppercase tracking-widest`}
                  >
                    Stay
                  </button>
                  <button 
                    onClick={confirmLeave}
                    className={`py-4 ${ART_DIRECTION.buttons.destructive} rounded-2xl font-black text-[10px] uppercase tracking-widest`}
                  >
                    Leave
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header - Non-scrolling */}
      <div className="pt-8 px-6 pb-6 bg-white border-b border-stone-50 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h2 className="serif text-4xl font-bold text-stone-900 leading-tight">Circles</h2>
            <p className="text-[10px] uppercase font-black tracking-widest text-brand mt-1.5 px-0.5">Intentional communities</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => { setShowFilters(!showFilters); setShowCreate(false); setShowJoinCode(false); }}
              className={`p-3.5 rounded-2xl transition-all shadow-xl border flex-shrink-0 ${
                showFilters ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-100 text-stone-400 hover:text-stone-900'
              }`}
              title="Search and Filter"
            >
              <Layers size={20} />
            </button>
            <button 
              onClick={() => { setShowJoinCode(!showJoinCode); setShowCreate(false); setShowFilters(false); }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3.5 rounded-2xl shadow-xl transform active:scale-95 transition-all font-black uppercase text-[9px] sm:text-[10px] tracking-[0.1em] border flex-shrink-0 ${
                showJoinCode ? 'bg-stone-100 text-stone-500 border-stone-100' : 'bg-white text-stone-900 border-stone-200'
              }`}
            >
              {showJoinCode ? <X size={16} /> : <Hash size={16} />}
              <span>{showJoinCode ? 'Dismiss' : 'Join'}</span>
            </button>
            <button 
              onClick={() => { setShowCreate(!showCreate); setShowJoinCode(false); setShowFilters(false); }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3.5 rounded-2xl shadow-xl transform active:scale-95 transition-all font-black uppercase text-[9px] sm:text-[10px] tracking-[0.1em] flex-shrink-0 ${
                showCreate ? 'bg-stone-100 text-stone-500' : 'bg-stone-900 text-white hover:bg-black'
              }`}
            >
              {showCreate ? <X size={16} /> : <Plus size={16} />}
              <span>{showCreate ? 'Dismiss' : 'Start'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrolling */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-20 no-scrollbar">
        <AnimatePresence mode="wait">
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-10 p-7 bg-stone-50 border-2 border-stone-100 rounded-[2.5rem] space-y-7 shadow-lg relative z-10"
            >
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search circles by name or purpose..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-stone-200 focus:border-stone-900 rounded-2xl px-12 py-3.5 text-sm font-bold transition-all outline-none text-stone-900 shadow-sm pr-12"
                />
                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-900 transition-colors p-1"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 ml-2 flex items-center gap-2">
                    <Layers size={14} className="text-brand" />
                    Filter circles by
                  </label>
                  {(searchQuery || filterStatus !== 'ALL' || sortBy !== 'RECENT') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilterStatus('ALL');
                        setSortBy('RECENT');
                      }}
                      className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-brand transition-colors flex items-center gap-1.5"
                    >
                      <History size={12} />
                      Reset Filters
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {(['ALL', 'JOINED', 'DISCOVER'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`py-4 px-2 rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.1em] transition-all border-2 flex flex-col items-center justify-center gap-2 shadow-sm ${
                          filterStatus === s 
                            ? 'bg-stone-900 border-stone-900 text-white shadow-xl scale-105 z-10' 
                            : 'bg-white border-stone-50 text-stone-400 hover:border-stone-200 hover:text-stone-900'
                        }`}
                      >
                        <span className="opacity-80">
                          {s === 'ALL' && <Layers size={16} />}
                          {s === 'JOINED' && <CheckCircle2 size={16} />}
                          {s === 'DISCOVER' && <Hash size={16} />}
                        </span>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 ml-2 flex items-center gap-2">
                    <Star size={14} className="text-amber-500" />
                    Order results by
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['RECENT', 'NAME', 'MEMBERS'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className={`py-4 px-2 rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.1em] transition-all border-2 flex flex-col items-center justify-center gap-2 shadow-sm ${
                          sortBy === s 
                            ? 'bg-amber-500 border-amber-500 text-white shadow-xl scale-105 z-10' 
                            : 'bg-white border-stone-50 text-stone-400 hover:border-stone-200 hover:text-stone-900'
                        }`}
                      >
                        <span className="opacity-80">
                          {s === 'RECENT' && <History size={16} />}
                          {s === 'NAME' && <Search size={16} />}
                          {s === 'MEMBERS' && <Users size={16} />}
                        </span>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        {showJoinCode && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleJoinByCode} 
            className="mb-8 p-6 bg-amber-50 border-2 border-stone-900 rounded-[2rem] space-y-4 shadow-xl"
          >
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-500 ml-5 block">Enter Circle Code (ID)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Invite Code or Circle ID"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="flex-1 bg-white border border-stone-200 focus:border-stone-900 rounded-xl px-5 py-3 text-sm font-bold transition-all outline-none text-stone-900 shadow-sm"
                  required
                />
                <button 
                  type="submit" 
                  disabled={joiningCode}
                  className="px-6 bg-stone-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-black disabled:opacity-50"
                >
                  {joiningCode ? '...' : 'Join'}
                </button>
              </div>
              <p className="text-[9px] text-stone-400 mt-2 px-5 italic leading-relaxed">
                Hidden circles can only be joined if you have their unique code.
              </p>
            </div>
          </motion.form>
        )}
        {showCreate && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleCreate} 
            className="mb-8 p-6 bg-stone-50 border-2 border-stone-900 rounded-[2rem] space-y-4 shadow-xl"
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-500 ml-5 mb-1 block">Circle Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. West End Neighbors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-stone-200 focus:border-stone-900 rounded-xl px-5 py-3 text-sm font-bold transition-all outline-none text-stone-900 shadow-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-500 ml-5 mb-1 block">The Purpose</label>
                <textarea 
                  placeholder="What is the shared intention?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-stone-200 focus:border-stone-900 rounded-xl px-5 py-3 text-sm font-medium transition-all outline-none text-stone-900 shadow-sm"
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-500 ml-5 mb-1 block">Picture</label>
                <div className="flex flex-col gap-2 px-1">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Paste image URL..."
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      className="flex-1 bg-white border border-stone-200 focus:border-stone-900 rounded-2xl px-5 py-4 text-sm font-medium transition-all outline-none text-stone-900 shadow-sm"
                    />
                    <label className="flex items-center justify-center gap-2 px-5 py-4 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-2xl text-sm font-medium transition-all text-stone-900 shadow-sm cursor-pointer whitespace-nowrap">
                      <ImageIcon size={18} />
                      <span className="hidden sm:inline">Upload</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>
                {photoURL && (
                  <div className="mt-2 ml-5 w-16 h-16 rounded-full overflow-hidden border border-stone-200">
                    <img referrerPolicy="no-referrer" src={photoURL} alt="Circle Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-500 ml-5 mb-1 block">Privacy Level</label>
                <div className="grid grid-cols-3 gap-2 px-1">
                  {(['PUBLIC', 'PRIVATE', 'HIDDEN'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrivacy(p)}
                      className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all ${
                        privacy === p 
                          ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                          : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-stone-400 mt-2 px-5 italic leading-relaxed">
                  {privacy === 'PUBLIC' && "Anyone can find and join."}
                  {privacy === 'PRIVATE' && "Visible, but requires approval."}
                  {privacy === 'HIDDEN' && "Invite-only access."}
                </p>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={submitting}
              className={`w-full mt-4 py-4 bg-stone-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.25em] shadow-lg hover:bg-black transition-all active:scale-[0.98] ${
                submitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? 'Launching...' : 'Launch Circle'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <AnimatePresence>
          {showInfoCard && (
            <motion.div
              key="info-card"
              initial={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="mb-6 overflow-hidden"
            >
              <div className="p-6 bg-stone-50/65 border border-stone-100 rounded-[2rem] space-y-3 relative">
                <button
                  onClick={() => setShowInfoCard(false)}
                  className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-all"
                  aria-label="Dismiss info card"
                >
                  <X size={14} />
                </button>
                <h3 className="serif text-base font-bold text-stone-900 flex items-center gap-2 pr-8">
                  🏡 About Community Circles
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Circles are self-organized micro-communities within KULA. Posting here limits visibility exclusively to circle members, creating a safe, focused space for collaborative sharing, tools coordination, and topic-specific conversations.
                </p>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider leading-normal">
                  Why you see this: These are active interest groups and local collectives in Berlin. Join public circles to participate in their feed and group chats.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {loading ? (
          <div className="text-center py-20 text-stone-300 italic">Finding your people...</div>
        ) : filteredAndSortedCircles.length > 0 ? (
          filterStatus === 'ALL' ? (
            <>
              {filteredAndSortedCircles.filter(c => profile?.joinedCircles?.includes(c.id)).length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#d4af37] mb-4 ml-2 flex items-center gap-2">
                    <ShieldCheck size={14} /> My Circles
                  </h3>
                  <div className="space-y-4">
                    {filteredAndSortedCircles.filter(c => profile?.joinedCircles?.includes(c.id)).map(circle => (
                      <CircleCard 
                        key={circle.id}
                        circle={circle}
                        profile={profile}
                        onJoin={handleJoin}
                        onLeave={handleLeave}
                        onSelect={setSelectedCircle}
                      />
                    ))}
                  </div>
                </div>
              )}
              {filteredAndSortedCircles.filter(c => !profile?.joinedCircles?.includes(c.id)).length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-4 ml-2 flex items-center gap-2">
                    <Search size={14} /> Discover
                  </h3>
                  <div className="space-y-4">
                    {filteredAndSortedCircles.filter(c => !profile?.joinedCircles?.includes(c.id)).map(circle => (
                      <CircleCard 
                        key={circle.id}
                        circle={circle}
                        profile={profile}
                        onJoin={handleJoin}
                        onLeave={handleLeave}
                        onSelect={setSelectedCircle}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            filteredAndSortedCircles.map(circle => (
              <CircleCard 
                key={circle.id}
                circle={circle}
                profile={profile}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onSelect={setSelectedCircle}
              />
            ))
          )
        ) : (
          <div className="text-center py-20 text-stone-400 font-serif italic">
            No circles yet. Be the first to start one!
          </div>
        )}
      </div>
      <AnimatePresence>
        {leavingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
              onClick={() => setLeavingId(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-xs w-full text-center border-2 border-stone-900"
            >
              <div className="w-16 h-16 bg-[#C86A51]/10 text-[#C86A51] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <LogOut size={32} />
              </div>
              <h3 className="serif text-2xl font-bold text-stone-900 mb-2">Leaving Circle?</h3>
              <p className="text-stone-500 text-sm italic mb-8">
                You can always rejoin later if the circle is public or you have the code.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setLeavingId(null)}
                  className={`py-4 ${ART_DIRECTION.buttons.secondary} rounded-2xl font-black text-[10px] uppercase tracking-widest`}
                >
                  Stay
                </button>
                <button 
                  onClick={confirmLeave}
                  className={`py-4 ${ART_DIRECTION.buttons.destructive} rounded-2xl font-black text-[10px] uppercase tracking-widest`}
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showInviteModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
              onClick={() => setShowInviteModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-[#FDFBF4] p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full border border-[#D9D0C0] flex flex-col max-h-[85vh]"
            >
              <button 
                onClick={() => setShowInviteModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a29b8c] block mb-1">Circle Sharing</span>
                <h3 className="serif text-2xl font-bold text-stone-900">Invite Neighbors</h3>
                <p className="text-xs text-stone-500 italic mt-1">Share {selectedCircle?.name} with your connections.</p>
              </div>

              {/* Share Options: Link & Code */}
              <div className="space-y-4 mb-6 flex-none">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a29b8c] block mb-1.5">Direct Invitation Link</span>
                  <div className="flex gap-2 bg-white p-2 rounded-2xl border border-[#D9D0C0]">
                    <input 
                      type="text" 
                      readOnly 
                      value={`${window.location.origin}/?circle=${selectedCircle?.id}`}
                      className="flex-1 bg-transparent border-none text-xs text-stone-600 outline-none px-2 select-all truncate"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/?circle=${selectedCircle?.id}`);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-4 py-2 bg-stone-950 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a29b8c] block mb-1.5">Circle Code / ID</span>
                  <div className="flex gap-2 bg-white p-2 rounded-2xl border border-[#D9D0C0]">
                    <input 
                      type="text" 
                      readOnly 
                      value={selectedCircle?.id || ''}
                      className="flex-1 bg-transparent border-none text-xs text-stone-600 outline-none px-2 select-all truncate font-mono"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(selectedCircle?.id || '');
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="px-4 py-2 bg-stone-950 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Connections List */}
              <div className="flex-1 flex flex-col min-h-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#a29b8c] block mb-2 flex-none">Send to Direct Chats</span>
                
                {loadingChats ? (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <span className="animate-spin rounded-full h-6 w-6 border-2 border-stone-800 border-t-transparent" />
                  </div>
                ) : directChats.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-white/40 rounded-2xl border border-[#D9D0C0]/50 px-4">
                    <p className="text-xs text-stone-400 italic">No direct connections yet.</p>
                    <p className="text-[9px] text-stone-400 mt-1">Start a conversation from public profiles or items to connect!</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
                    {directChats.map((dc) => {
                      const otherProfile = dc.otherUserProfile;
                      const hasSent = sentInvites[dc.chat.id];
                      
                      return (
                        <div 
                          key={dc.chat.id} 
                          className="flex items-center justify-between p-3 bg-white rounded-2xl border border-[#D9D0C0]/60 hover:border-[#D9D0C0] transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-stone-100 rounded-xl overflow-hidden border border-[#D9D0C0] flex-shrink-0">
                              {otherProfile?.photoURL ? (
                                <img src={otherProfile.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-bold">
                                  {otherProfile?.displayName?.charAt(0) || 'N'}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-bold text-stone-900 truncate">
                              {otherProfile?.displayName || 'Neighbor'}
                            </span>
                          </div>
                          
                          <button 
                            disabled={hasSent || invitingChatId === dc.chat.id}
                            onClick={() => handleSendDirectInvite(dc.chat.id)}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                              hasSent 
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold' 
                                : 'bg-[#5B8266] hover:bg-[#4A6B53] text-white shadow-sm active:scale-95'
                            }`}
                          >
                            {invitingChatId === dc.chat.id ? 'Sending...' : hasSent ? 'Sent ✓' : 'Send'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
