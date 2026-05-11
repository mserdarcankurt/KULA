import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Circle, UserProfile } from '../types';
import { Users, Plus, Star, MapPin, CheckCircle2, ShieldCheck, X, ArrowLeft, Layers, Map as MapIcon, LogOut, Send, Hash, MessageCircle, History, Search, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Feed from './Feed';
import Discovery from './Discovery';
import PostItem from './PostItem';
import ChatRoom from './ChatRoom';

interface CirclesProps {
  onNavigateToChat?: (chatId: string) => void;
}

export default function Circles({ onNavigateToChat }: CirclesProps = {}) {
  const { user, profile } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (!selectedCircle || circleView !== 'MEMBERS') return;
    
    setLoadingMembers(true);
    const q = query(collection(db, 'circles', selectedCircle.id, 'members'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const memberIds = snapshot.docs.map(doc => doc.id);
      
      try {
        const memberProfiles: UserProfile[] = [];
        // Fetch profiles in batches to avoid too many requests
        for (const id of memberIds) {
          const userDoc = await getDoc(doc(db, 'users', id));
          if (userDoc.exists()) {
            memberProfiles.push({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
          }
        }
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
        memberCount: 1,
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

      // Update memberCount
      const circleRef = doc(db, 'circles', circleId);
      const circleSnap = await getDoc(circleRef);
      if (circleSnap.exists()) {
        await updateDoc(circleRef, {
          memberCount: (circleSnap.data().memberCount || 0) + 1
        });
      }
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
    }

    // Give React time to unmount children and unsubscribe snapshot listeners
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Update memberCount and privacy FIRST before removing membership
      const circleRef = doc(db, 'circles', circleId);
      const circleSnap = await getDoc(circleRef);
      if (circleSnap.exists()) {
        const currentCount = circleSnap.data().memberCount || 1;
        if (currentCount <= 1) {
          await updateDoc(circleRef, {
            memberCount: 0,
            privacy: 'HIDDEN'
          });
        } else {
          await updateDoc(circleRef, {
            memberCount: currentCount - 1
          });
        }
      }

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

  if (selectedCircle) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="p-6 border-b border-stone-100 bg-stone-50/50">
          <button 
            onClick={() => {
              if (selectedChannel) {
                setSelectedChannel(null);
              } else {
                setSelectedCircle(null);
              }
            }}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-900 transition-colors mb-4 text-[10px] uppercase font-black tracking-widest"
          >
            <ArrowLeft size={16} />
            <span>{selectedChannel ? 'Circle Channels' : 'All Circles'}</span>
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
              <button 
                onClick={(e) => handleLeave(e, selectedCircle.id)}
                className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                title="Leave Circle"
              >
                <LogOut size={20} />
              </button>
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
              onClick={() => { setCircleView('CHAT'); setSelectedChannel(null); }}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                circleView === 'CHAT' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'
              }`}
            >
              <MessageCircle size={14} />
              <span>Chat</span>
            </button>
            <button 
              onClick={() => { setCircleView('DISCOVERY'); setSelectedChannel(null); }}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                circleView === 'DISCOVERY' && !selectedChannel ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'
              }`}
            >
              <MapIcon size={14} />
              <span>Map</span>
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

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {selectedChannel ? (
            <ChatRoom 
              chatId={selectedChannel} 
              onAction={(type) => {
                setPreSelectedPostType(type);
                setCircleView('POST');
                setSelectedChannel(null);
              }}
            />
          ) : circleView === 'FEED' ? (
            <Feed location={profile?.location || null} circleId={selectedCircle.id} onNavigateToChat={onNavigateToChat} />
          ) : circleView === 'CHAT' ? (
            <div className="p-6 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-6 px-1">Community Channels</h4>
              {channels.map((channel) => (
                <button
                  key={channel}
                  onClick={() => openChannel(channel)}
                  className="w-full flex items-center justify-between p-6 bg-white border-2 border-stone-100 rounded-[2.5rem] hover:border-stone-900 transition-all group shadow-sm active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all shadow-inner">
                      <Hash size={24} />
                    </div>
                    <div className="text-left">
                      <span className="text-base font-black text-stone-900 block tracking-tight">{channel}</span>
                      <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Join the thread</span>
                    </div>
                  </div>
                  <div className="w-4 h-4 rounded-full border-2 border-stone-100 group-hover:bg-[--color-brand] group-hover:border-[--color-brand] transition-all" />
                </button>
              ))}
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
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <LogOut size={32} />
                </div>
                <h3 className="serif text-2xl font-bold text-stone-900 mb-2">Leaving Circle?</h3>
                <p className="text-stone-500 text-sm italic mb-8">
                  You can always rejoin later if the circle is public or you have the code.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setLeavingId(null)}
                    className="py-4 bg-stone-100 text-stone-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all"
                  >
                    Stay
                  </button>
                  <button 
                    onClick={confirmLeave}
                    className="py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg transition-all"
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
            <p className="text-[10px] uppercase font-black tracking-widest text-[--color-brand] mt-1.5 px-0.5">Intentional communities</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button 
              onClick={() => { setShowFilters(!showFilters); setShowCreate(false); setShowJoinCode(false); }}
              className={`p-3.5 sm:p-4 rounded-2xl transition-all shadow-xl border flex-shrink-0 ${
                showFilters ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-100 text-stone-400 hover:text-stone-900'
              }`}
              title="Search and Filter"
            >
              <Layers size={20} className="sm:w-[22px] sm:h-[22px]" />
            </button>
            <button 
              onClick={() => { setShowJoinCode(!showJoinCode); setShowCreate(false); setShowFilters(false); }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-8 py-3.5 sm:py-4 rounded-2xl shadow-xl transform active:scale-95 transition-all font-black uppercase text-[9px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.15em] border flex-shrink-0 ${
                showJoinCode ? 'bg-stone-100 text-stone-500 border-stone-100' : 'bg-white text-stone-900 border-stone-200'
              }`}
            >
              {showJoinCode ? <X size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Hash size={16} className="sm:w-[18px] sm:h-[18px]" />}
              <span>{showJoinCode ? 'Dismiss' : 'Join'}</span>
            </button>
            <button 
              onClick={() => { setShowCreate(!showCreate); setShowJoinCode(false); setShowFilters(false); }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-8 py-3.5 sm:py-4 rounded-2xl shadow-xl transform active:scale-95 transition-all font-black uppercase text-[9px] sm:text-[11px] tracking-[0.1em] sm:tracking-[0.15em] flex-shrink-0 ${
                showCreate ? 'bg-stone-100 text-stone-500' : 'bg-stone-900 text-white hover:bg-black'
              }`}
            >
              {showCreate ? <X size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />}
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
                    <Layers size={14} className="text-[--color-brand]" />
                    Filter circles by
                  </label>
                  {(searchQuery || filterStatus !== 'ALL' || sortBy !== 'RECENT') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilterStatus('ALL');
                        setSortBy('RECENT');
                      }}
                      className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-[--color-brand] transition-colors flex items-center gap-1.5"
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
                      <div 
                        key={circle.id} 
                        onClick={() => profile?.joinedCircles?.includes(circle.id) && setSelectedCircle(circle)}
                        className={`p-6 bg-white border border-stone-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all group ${
                          profile?.joinedCircles?.includes(circle.id) ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center text-[--color-brand]">
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
                            {profile?.joinedCircles?.includes(circle.id) ? (
                              <div className="flex items-center gap-1 group/joined">
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                                  <ShieldCheck size={14} className="text-amber-400" />
                                  <span>Joined</span>
                                </div>
                                <button 
                                  onClick={(e) => handleLeave(e, circle.id)}
                                  className="p-2 text-stone-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Leave Circle"
                                >
                                  <LogOut size={16} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleJoin(circle.id)}
                                className="px-4 py-1.5 bg-stone-100 border border-stone-200 text-[--color-brand] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[--color-brand] hover:text-white transition-all shadow-sm"
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
                          {profile?.joinedCircles?.includes(circle.id) && (
                             <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] opacity-0 group-hover:opacity-100 transition-opacity">
                               Enter Space →
                             </span>
                          )}
                        </div>
                      </div>
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
                      <div 
                        key={circle.id} 
                        onClick={() => profile?.joinedCircles?.includes(circle.id) && setSelectedCircle(circle)}
                        className={`p-6 bg-white border border-stone-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all group ${
                          profile?.joinedCircles?.includes(circle.id) ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center text-[--color-brand]">
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
                            {profile?.joinedCircles?.includes(circle.id) ? (
                              <div className="flex items-center gap-1 group/joined">
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                                  <ShieldCheck size={14} className="text-amber-400" />
                                  <span>Joined</span>
                                </div>
                                <button 
                                  onClick={(e) => handleLeave(e, circle.id)}
                                  className="p-2 text-stone-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Leave Circle"
                                >
                                  <LogOut size={16} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleJoin(circle.id)}
                                className="px-4 py-1.5 bg-stone-100 border border-stone-200 text-[--color-brand] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[--color-brand] hover:text-white transition-all shadow-sm"
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
                          {profile?.joinedCircles?.includes(circle.id) && (
                             <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] opacity-0 group-hover:opacity-100 transition-opacity">
                               Enter Space →
                             </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            filteredAndSortedCircles.map(circle => (
              <div 
                key={circle.id} 
                onClick={() => profile?.joinedCircles?.includes(circle.id) && setSelectedCircle(circle)}
                className={`p-6 bg-white border border-stone-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all group ${
                  profile?.joinedCircles?.includes(circle.id) ? 'cursor-pointer' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center text-[--color-brand]">
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
                    {profile?.joinedCircles?.includes(circle.id) ? (
                      <div className="flex items-center gap-1 group/joined">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-stone-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                          <ShieldCheck size={14} className="text-amber-400" />
                          <span>Joined</span>
                        </div>
                        <button 
                          onClick={(e) => handleLeave(e, circle.id)}
                          className="p-2 text-stone-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Leave Circle"
                        >
                          <LogOut size={16} />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleJoin(circle.id)}
                        className="px-4 py-1.5 bg-stone-100 border border-stone-200 text-[--color-brand] rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[--color-brand] hover:text-white transition-all shadow-sm"
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
                  {profile?.joinedCircles?.includes(circle.id) && (
                     <span className="text-[10px] font-black uppercase tracking-widest text-[#d4af37] opacity-0 group-hover:opacity-100 transition-opacity">
                       Enter Space →
                     </span>
                  )}
                </div>
              </div>
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
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <LogOut size={32} />
              </div>
              <h3 className="serif text-2xl font-bold text-stone-900 mb-2">Leaving Circle?</h3>
              <p className="text-stone-500 text-sm italic mb-8">
                You can always rejoin later if the circle is public or you have the code.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setLeavingId(null)}
                  className="py-4 bg-stone-100 text-stone-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all"
                >
                  Stay
                </button>
                <button 
                  onClick={confirmLeave}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg transition-all"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
