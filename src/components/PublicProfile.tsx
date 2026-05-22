/**
 * FILE: PublicProfile.tsx
 * ROLE IN KULA: The "Neighbor Card" — shows another user's public profile.
 * 
 * CIRCUIT C (Trust Fabric):
 *   This component is the PRIMARY way users evaluate trust before interacting.
 *   It shows:
 *     1. Identity: Name, photo, org badge, bio
 *     2. Trust Distance: ConnectionBadge (1st/2nd/3rd degree via BFS)
 *     3. Trust Mosaic: Growth stage, exchange count, gratitude wall
 *     4. Lookout/Standby tags: What this neighbor needs/offers
 *     5. Active items: Their current posts (clickable → ItemDetailsSheet)
 * 
 * PRIVACY GATE:
 *   Uses checkSymmetricVisibility() from trustGraph.ts to enforce network privacy.
 *   If the target user's visibilityPreference is DEGREE_2 and you're 3 hops away,
 *   the profile shows a "Private Profile" lock screen instead of their data.
 * 
 * VOUCH SYSTEM:
 *   Users can "Vouch for Neighbor" — creates a PENDING vouch in the `vouches` collection.
 *   The target user sees it in their Profile.tsx → pendingVouches section.
 *   Accepted vouches create new edges in the trust graph, tightening connections.
 *   States: NONE → PENDING → ACCEPTED (also tracks direction: SENT vs RECEIVED)
 * 
 * BLOCK SYSTEM:
 *   Users can block neighbors. This adds the target's UID to blockedUsers array
 *   on the blocker's profile. Blocked users are filtered out of feeds and chats.
 * 
 * NESTED PROFILES:
 *   Clicking an item in the profile → ItemDetailsSheet → clicking another user
 *   → opens ANOTHER PublicProfile on top (recursive). This creates a navigation
 *   stack without a router.
 * 
 * CALLED BY: Discovery.tsx, Feed.tsx, ChatsList.tsx, Profile.tsx
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, onSnapshot, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Item, Circle } from '../types';
import { X, Star, Award, MapPin, Shield, Tag, Heart, CheckCircle2, Clock, Ban, UserMinus, UserCheck, Instagram, Target, Sparkles, Lock, MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { getFallbackImage, ART_DIRECTION } from '../lib/artDirection';
import { checkSymmetricVisibility, clearTrustGraphCache } from '../lib/trustGraph';
import TrustMosaicComponent from './TrustMosaic';
import ConnectionBadge from './ConnectionBadge';
import { ItemDetailsSheet } from './ItemDetailsSheet';
import { getOrCreateChat } from '../services/chatService';

interface PublicProfileProps {
  userId: string;
  onClose: () => void;
  onNavigateToChat?: (chatId: string) => void;
}

export default function PublicProfile({ userId, onClose, onNavigateToChat }: PublicProfileProps) {
  const { user, profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [nestedProfileId, setNestedProfileId] = useState<string | null>(null);
  const [vouchStatus, setVouchStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED' | 'LOADING'>('LOADING');
  const [vouchId, setVouchId] = useState<string | null>(null);
  const [vouchDirection, setVouchDirection] = useState<'SENT' | 'RECEIVED' | null>(null);
  const [isVouching, setIsVouching] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [commonCircles, setCommonCircles] = useState<Circle[]>([]);

  const isBlocked = myProfile?.blockedUsers?.includes(userId);

  const handleToggleBlock = async () => {
    if (!user || isBlocking) return;
    
    const confirmBlock = isBlocked 
      ? window.confirm("Do you want to unblock this neighbor?")
      : window.confirm("Block this neighbor? You won't see each other's posts and they won't be able to message you.");
    
    if (!confirmBlock) return;

    setIsBlocking(true);
    try {
      const myRef = doc(db, 'users', user.uid);
      await updateDoc(myRef, {
        blockedUsers: isBlocked ? arrayRemove(userId) : arrayUnion(userId)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsBlocking(false);
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (docSnap.exists()) {
        const targetData = docSnap.data() as UserProfile;
        setProfile(targetData);
        
        // Fetch common circles
        if (myProfile?.joinedCircles && targetData.joinedCircles) {
          const commonIds = myProfile.joinedCircles.filter(id => 
            targetData.joinedCircles?.includes(id)
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
          } else {
            setCommonCircles([]);
          }
        } else {
          setCommonCircles([]);
        }
        
        // Privacy Check
        if (user) {
          const pref = myProfile?.privacySettings?.profileVisibility || myProfile?.visibilityPreference || 'PUBLIC';
          const isVis = await checkSymmetricVisibility(user.uid, pref, userId);
          if (!isVis) {
            setIsPrivate(true);
            setLoading(false);
            return;
          }
        }
      }
    }

    const q = query(
      collection(db, 'items'),
      where('ownerId', '==', userId),
      where('status', '==', 'ACTIVE')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      // [ALPHA] Filter out shelved types
      const SHELVED_TYPES = ['IMECE', 'MISSION'];
      const activeItems = fetchedItems.filter(item => !SHELVED_TYPES.includes(item.type));
      activeItems.sort((a, b) => {
         const timeA = a.createdAt?.toMillis?.() || 0;
         const timeB = b.createdAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setItems(activeItems);
      setLoading(false);
    });

    async function fetchVouchStatus() {
      if (!user || user.uid === userId) {
        setVouchStatus('NONE');
        return;
      }
      
      // Check if they are parent/child (which is inherently a vouch)
      const targetDoc = await getDoc(doc(db, 'users', userId));
      const targetData = targetDoc.data();
      if (targetData?.hostId === user.uid || myProfile?.hostId === userId) {
        setVouchStatus('ACCEPTED');
        return;
      }

      // Check vouches collection
      const q1 = query(collection(db, 'vouches'), where('fromUserId', '==', user.uid), where('toUserId', '==', userId));
      const q2 = query(collection(db, 'vouches'), where('fromUserId', '==', userId), where('toUserId', '==', user.uid));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      if (!snap1.empty) {
        setVouchStatus(snap1.docs[0].data().status);
        setVouchId(snap1.docs[0].id);
        setVouchDirection('SENT');
      } else if (!snap2.empty) {
        setVouchStatus(snap2.docs[0].data().status);
        setVouchId(snap2.docs[0].id);
        setVouchDirection('RECEIVED');
      } else {
        setVouchStatus('NONE');
        setVouchId(null);
        setVouchDirection(null);
      }
    }

    fetchProfile();
    fetchVouchStatus();
    return unsubscribe;
  }, [userId, user, myProfile]);

  const handleVouch = async () => {
    if (!user || isVouching) return;
    setIsVouching(true);
    try {
      const vouchRef = await addDoc(collection(db, 'vouches'), {
        fromUserId: user.uid,
        toUserId: userId,
        status: 'PENDING',
        createdAt: serverTimestamp()
      });
      setVouchStatus('PENDING');
      setVouchDirection('SENT');
      setVouchId(vouchRef.id);

      // Create a notification for the target user
      const senderName = myProfile?.displayName || 'A neighbor';
      await addDoc(collection(db, 'notifications'), {
        userId: userId,
        type: 'VOUCH_REQUEST',
        content: `${senderName} wants to vouch for you as a trusted neighbor.`,
        isRead: false,
        link: '/profile',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsVouching(false);
    }
  };

  const handleAcceptVouch = async () => {
    if (!vouchId || isVouching) return;
    setIsVouching(true);
    try {
      await updateDoc(doc(db, 'vouches', vouchId), {
        status: 'ACCEPTED'
      });
      setVouchStatus('ACCEPTED');
      clearTrustGraphCache();

      // Notify the person who sent the vouch
      const acceptorName = myProfile?.displayName || 'A neighbor';
      const senderUid = vouchDirection === 'RECEIVED' ? userId : user?.uid;
      if (senderUid && senderUid !== user?.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: senderUid,
          type: 'VOUCH_ACCEPTED',
          content: `${acceptorName} accepted your vouch! You are now connected neighbors.`,
          isRead: false,
          link: '/profile',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVouching(false);
    }
  };

  const handleStartChat = async () => {
    if (!user || isStartingChat) return;
    setIsStartingChat(true);
    try {
      const chatId = await getOrCreateChat(user.uid, userId);
      if (onNavigateToChat) {
        onNavigateToChat(chatId);
      }
      onClose();
    } catch (err) {
      console.error('Failed to start chat:', err);
    } finally {
      setIsStartingChat(false);
    }
  };

  if (loading && !profile) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-[#FDFBF4] flex items-center justify-center">
        {/* Background Dot Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.4] pointer-events-none z-0" 
          style={{ backgroundImage: ART_DIRECTION.backgrounds.pattern }} 
        />
        <div className="relative z-10 animate-pulse text-stone-400 italic serif">Getting to know your neighbor...</div>
      </div>,
      document.body
    );
  }

  if (!profile) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[#FDFBF4] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      {/* Background Dot Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.4] pointer-events-none z-0" 
        style={{ backgroundImage: ART_DIRECTION.backgrounds.pattern }} 
      />

      {/* Top Header Controls (Block & Close) */}
      <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          {user && user.uid !== userId && (
            <button
              onClick={handleToggleBlock}
              disabled={isBlocking}
              title={isBlocked ? "Unblock Neighbor" : "Block Neighbor"}
              className={`p-3 rounded-full transition-all border shadow-sm backdrop-blur-md ${
                isBlocked 
                  ? 'bg-red-50 text-red-650 border-red-200 hover:bg-red-100' 
                  : 'bg-white/90 text-stone-450 hover:text-stone-800 border-stone-200/60 hover:bg-white'
              }`}
            >
              {isBlocked ? <UserCheck size={18} /> : <Ban size={18} />}
            </button>
          )}
        </div>

        <div className="pointer-events-auto">
          <button 
            onClick={onClose}
            className="p-3 bg-white/90 border border-stone-200/60 hover:bg-white rounded-full text-stone-450 hover:text-stone-800 transition-all shadow-sm backdrop-blur-md"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="p-8 pb-32 space-y-8">
          {isPrivate ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4 space-y-6">
              <div className="w-24 h-24 bg-[#FAF7F0] border border-[#E8E2D2] rounded-[2.2rem] flex items-center justify-center text-stone-400 mb-4 shadow-sm">
                <Lock size={32} />
              </div>
              <h2 className="serif text-3xl font-bold text-stone-850 font-serif">Private Profile</h2>
              <p className="text-stone-500 italic max-w-xs text-sm leading-relaxed">
                This neighbor's network privacy settings limit who can view their profile.
              </p>
              {user && user.uid !== userId && !isBlocked && (
                <div className="pt-4">
                  <ConnectionBadge targetUserId={userId} showLineage={true} />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center space-y-6 pt-10">
                <div className="w-32 h-32 bg-[#FAF7F0] rounded-[2.2rem] overflow-hidden border-[6px] border-[#FAF7F0] shadow-md ring-1 ring-stone-205/30">
                  {profile.photoURL ? (
                    <img referrerPolicy="no-referrer" src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-4xl font-serif font-bold">
                      {profile.displayName.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <h2 className="serif text-3xl font-serif font-bold text-stone-850 leading-tight">{profile.displayName}</h2>
                    {profile.isOrganization && (
                      <Shield size={20} className="text-indigo-600 fill-indigo-50" />
                    )}
                  </div>
                  
                  <div className="flex justify-center pt-2">
                    <ConnectionBadge targetUserId={userId} showLineage={true} />
                  </div>
                </div>

                {user && user.uid !== userId && !isBlocked && (
                  <div className="flex justify-center items-center gap-3 w-full max-w-xs mx-auto">
                    {/* Primary chat action button */}
                    <button
                      onClick={handleStartChat}
                      disabled={isStartingChat}
                      className="flex-1 py-3 bg-[#5B6B56] hover:bg-[#4a5846] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <MessageSquare size={13} />
                      {isStartingChat ? 'Starting...' : 'Message'}
                    </button>

                    {/* Secondary vouch status button */}
                    {vouchStatus === 'NONE' && (
                      <button
                        onClick={handleVouch}
                        disabled={isVouching}
                        className="flex-1 py-3 border border-[#E8E2D2] bg-emerald-50/20 text-emerald-700 hover:bg-emerald-50/50 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Sparkles size={13} />
                        {isVouching ? 'Vouching...' : 'Vouch'}
                      </button>
                    )}
                    {vouchStatus === 'PENDING' && vouchDirection === 'SENT' && (
                      <span className="flex-1 py-3 bg-[#FAF7F0] text-stone-400 border border-[#E8E2D2] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-inner">
                        <Clock size={13} />
                        Pending
                      </span>
                    )}
                    {vouchStatus === 'PENDING' && vouchDirection === 'RECEIVED' && (
                      <button
                        onClick={handleAcceptVouch}
                        disabled={isVouching}
                        className="flex-1 py-3 border border-indigo-200 bg-indigo-50/20 text-indigo-700 hover:bg-indigo-50/50 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Sparkles size={13} />
                        {isVouching ? 'Accepting...' : 'Accept Vouch'}
                      </button>
                    )}
                    {vouchStatus === 'ACCEPTED' && (
                      <span className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-sm">
                        <CheckCircle2 size={13} />
                        Connected
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-stone-450 font-bold text-[9px] uppercase tracking-widest pt-2">
                  {profile.isOrganization ? (
                    <>
                      <MapPin size={12} className="text-indigo-650" />
                      <span className="text-indigo-650">Verified Organization • {profile.orgType}</span>
                    </>
                  ) : (
                    <>
                      <MapPin size={12} className="text-[#5B6B56]" />
                      <span>Local Neighbor</span>
                    </>
                  )}
                </div>
              </div>

              <p className="max-w-sm mx-auto text-center font-serif text-stone-600 italic leading-relaxed text-sm">
                "{profile.bio || "A friendly neighbor contributing to the community!"}"
              </p>

              {profile.instagramHandle && (
                <a 
                  href={`https://instagram.com/${profile.instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#FAF7F0] border border-[#E8E2D2] text-[#7A6D55] rounded-full font-black uppercase tracking-widest text-[9px] shadow-sm hover:shadow-md transition-all w-max mx-auto hover:bg-[#FAF7F0]/80"
                >
                  <Instagram size={14} className="text-pink-600" />
                  <span>@{profile.instagramHandle}</span>
                </a>
              )}

              {commonCircles.length > 0 && (
                <div className="w-full max-w-sm mx-auto bg-[#FAF7F0] border border-[#E8E2D2] rounded-[1.5rem] p-4 flex flex-col gap-2 shadow-sm mt-4 animate-in fade-in duration-500 text-left">
                  <div className="flex items-center gap-2 text-[#5B6B56]">
                    <Users size={14} className="flex-shrink-0" />
                    <h4 className="text-[9px] font-black uppercase tracking-widest leading-none">
                      Shared Circles ({commonCircles.length})
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {commonCircles.map(circle => (
                      <span
                        key={circle.id}
                        className="px-2.5 py-1 bg-white border border-[#E8E2D2] text-[#5B6B56] text-[8.5px] font-bold uppercase rounded-lg shadow-sm"
                      >
                        #{circle.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-stone-300/60 my-6" />

              <TrustMosaicComponent
                userId={userId}
                mosaic={profile.trustMosaic}
                memberSince={profile.createdAt}
                compact
              />

              {((profile.lookoutFor?.length || 0) > 0 || (profile.thePersonFor?.length || 0) > 0 || (profile.lookoutRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0 || (profile.standbyRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0) && (
                <div className="space-y-6 w-full text-left pt-4">
                  {((profile.lookoutFor?.length || 0) > 0 || (profile.lookoutRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0) && (
                    <div className="bg-emerald-50/30 rounded-[2rem] p-6 border border-emerald-100/50">
                      <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-4">
                        <Target size={14} /> I am on the lookout for...
                      </h4>
                      <div className="flex flex-wrap gap-2.5">
                        {profile.lookoutFor?.map((item, i) => (
                          <span key={i} className="px-4 py-2 bg-white text-emerald-850 font-bold text-xs rounded-xl shadow-sm border border-emerald-100/60">
                            {item}
                          </span>
                        ))}
                        {profile.lookoutRules?.filter(r => r.privacy !== 'PRIVATE').map(r => (
                          <span key={r.id} className="px-4 py-2 bg-white text-emerald-850 font-bold text-xs rounded-xl shadow-sm border border-emerald-100/60">
                            {r.keyword} 
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {((profile.thePersonFor?.length || 0) > 0 || (profile.standbyRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0) && (
                    <div className="bg-purple-50/30 rounded-[2rem] p-6 border border-purple-100/50">
                      <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-800 mb-4">
                        <Sparkles size={14} /> I am the person for...
                      </h4>
                      <div className="flex flex-wrap gap-2.5">
                        {profile.thePersonFor?.map((item, i) => (
                          <span key={i} className="px-4 py-2 bg-white text-purple-850 font-bold text-xs rounded-xl shadow-sm border border-purple-100/60">
                            {item}
                          </span>
                        ))}
                        {profile.standbyRules?.filter(r => r.privacy !== 'PRIVATE').map(r => (
                          <span key={r.id} className="px-4 py-2 bg-white text-purple-850 font-bold text-xs rounded-xl shadow-sm border border-purple-100/60">
                            {r.keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-6 px-8 pb-32">
          <div className="flex items-center justify-between border-b border-dashed border-stone-300/60 pb-4">
            <h3 className="serif text-2xl font-serif font-bold text-stone-850">Current Shares</h3>
            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{items.length} items</span>
          </div>

          <div className="space-y-4">
            {items.length > 0 ? (
              items.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className={`w-full p-4 border rounded-2xl flex items-center gap-4 transition-all text-left hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${
                    item.type === 'JOIN' ? 'bg-[#FAF7F0] border-teal-100/60' : 'bg-white border-stone-200/55'
                  }`}
                >
                  <div className="w-16 h-16 bg-stone-50 rounded-xl flex-shrink-0 overflow-hidden">
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <img src={getFallbackImage(item.category)} alt="" className="w-full h-full object-cover opacity-80" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-sm truncate ${
                      item.type === 'JOIN' ? 'text-teal-900' : 'text-stone-850'
                    }`}>
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-stone-400 mt-1 line-clamp-1 italic">{item.description}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-12 text-center text-stone-400 font-serif italic text-sm">
                This neighbor is currently taking a break.
              </div>
            )}
          </div>
        </div>
      </div>
      {selectedItem && !isPrivate && (
        <ItemDetailsSheet 
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onViewProfile={(targetId) => {
            if (targetId !== userId) {
              setNestedProfileId(targetId);
            }
            setSelectedItem(null);
          }}
        />
      )}

      {nestedProfileId && (
        <PublicProfile 
          userId={nestedProfileId} 
          onClose={() => setNestedProfileId(null)} 
          onNavigateToChat={(chatId) => {
            if (onNavigateToChat) {
              onNavigateToChat(chatId);
            }
            onClose();
          }}
        />
      )}
    </div>,
    document.body
  );
}
