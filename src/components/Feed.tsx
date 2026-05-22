/**
 * FILE: Feed.tsx
 * ROLE IN KULA: The "Scrollable Bulletin Board" — a list view of community items.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   While Discovery.tsx shows one card at a time (swipe interface), Feed.tsx shows
 *   ALL matching items in a vertical scrolling list. Same data source (useItems.ts),
 *   different UX pattern.
 * 
 * FILTERING PIPELINE:
 *   1. useItems.ts fetches and distance-sorts all active items
 *   2. Local/Global toggle filters by localRadius
 *   3. Scope selector: ALL / LOCAL (VICINITY only) / CIRCLES / ORGS
 *   4. Type filter: ALL / SHARE / ASK / JOIN / IMECE / MISSION
 *   5. Text search: matches against title and description
 * 
 * FEATURED ITEMS:
 *   Items with isFeatured=true (set by admins in AdminPanel.tsx) appear in a
 *   horizontally-scrolling carousel at the top (dark cards with amber accents).
 *   These are high-priority or urgent community items.
 * 
 * ITEM CARD INTERACTIONS:
 *   Each ItemCard can trigger different actions based on item.type:
 *   - ASK/SHARE: "View Profile" → opens PublicProfile.tsx
 *   - IMECE: "Join İmece" → adds/removes user from participants array
 *   - JOIN: "Join & RSVP" → creates interest + notification + chat
 *   - MISSION: "Contact Org" → creates interest + notification + chat
 *   - Clicking any card → opens ItemDetailsSheet.tsx for full view + comments
 * 
 * CIRCLE CONTEXT:
 *   When `circleId` is provided (rendered inside Circles.tsx), the feed filters
 *   to show only items belonging to that circle. The scope filters are hidden.
 * 
 * CALLED BY: Explore.tsx (FEED view mode), Circles.tsx (circle-specific feed)
 */
import React, { useState, useEffect } from 'react';
import { useItems } from '../hooks/useItems';
import { db } from '../lib/firebase';
import { query, collection, getDocs, updateDoc, doc, arrayUnion, arrayRemove, setDoc, serverTimestamp, getDoc, addDoc, where } from 'firebase/firestore';
import { MapPin, Tag, Users, Globe, Shield, Target, HeartHandshake, Plus, MessageSquare, Clock, Languages, Loader2, Calendar, Coffee, Share, MessageCircle } from 'lucide-react';
import { Item, Circle } from '../types';
import { OwnerName } from './OwnerName';
import { useAuth } from '../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { translateText } from '../services/geminiService';
import { getOrCreateChat } from '../services/chatService';
import { getFallbackImage, ART_DIRECTION } from '../lib/artDirection';
import PublicProfile from './PublicProfile';
import { ItemDetailsSheet } from './ItemDetailsSheet';
import ConnectionBadge from './ConnectionBadge';
import { OwnerAvatar } from './OwnerAvatar';
import BridgeSheet from './BridgeSheet';
import { AnimatePresence } from 'motion/react';

interface FeedProps {
  location: { lat: number; lng: number } | null;
  circleId?: string;
  circleFilter?: string;
  onNavigateToChat?: (chatId: string) => void;
  trustFilter?: number;
  typeFilter?: string;
  categoryFilter?: string;
  onNavigateToTab?: (tab: string) => void;
}

export default function Feed({ 
  location, 
  circleId, 
  circleFilter,
  onNavigateToChat, 
  trustFilter = 6, 
  typeFilter = 'ALL',
  categoryFilter = 'ALL',
  onNavigateToTab
}: FeedProps) {
  const { user, profile } = useAuth();
  const { items, loading } = useItems(location, profile, circleId);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [shouldFocusComment, setShouldFocusComment] = useState(false);
  const [sharingItem, setSharingItem] = useState<Item | null>(null);
  const [circles, setCircles] = useState<Record<string, Circle>>({});

  const dismissNudge = async () => {
    if (profile && user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          skippedFirstAct: false
        });
      } catch (err) {
        console.error('Failed to dismiss first act nudge:', err);
      }
    }
  };

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'circles'),
          where('privacy', '!=', 'HIDDEN')
        ));
        const circleMap: Record<string, Circle> = {};
        snap.docs.forEach(d => {
          circleMap[d.id] = { id: d.id, ...d.data() } as Circle;
        });
        setCircles(circleMap);
      } catch (err) {
        console.error('Error fetching circles:', err);
      }
    };
    fetchCircles();
  }, []);

  // [ALPHA] Show all active featured items
  const featuredItems = items.filter(item => item.status === 'ACTIVE' && item.isFeatured);
  
  // Apply trust, type, category, and circle filtering to items
  const filteredItems = items.filter(item => {
    if (circleId) return true;
    
    // 1. Network / Trust filter
    if (trustFilter < 6) {
      if (item.degrees === undefined || item.degrees > trustFilter) {
        return false;
      }
    }
    
    // 2. Circle filter
    if (circleFilter && circleFilter !== 'ALL') {
      if (item.circleId !== circleFilter && !item.targetCircles?.includes(circleFilter)) {
        return false;
      }
    }
    
    // 3. Type filter
    if (typeFilter !== 'ALL') {
      if (item.type !== typeFilter) {
        return false;
      }
    } else {
      if (item.type === 'FLOW') {
        return false;
      }
    }
    
    // 4. Category filter
    if (categoryFilter !== 'ALL') {
      if (item.category !== categoryFilter) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar relative h-full w-full pt-4">
      {!circleId && featuredItems.length > 0 && (
        <div className="px-6 space-y-3 pt-4 pb-2 transition-all animate-in fade-in slide-in-from-top-2 duration-700">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2 px-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Featured & Urgent
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
            {featuredItems.map(item => (
              <div key={item.id} className="w-64 flex-shrink-0 bg-stone-900 rounded-[2rem] p-5 text-white space-y-3 shadow-xl transform hover:-translate-y-1 transition-all">
                 <div className="flex justify-between items-start">
                   <span className="text-[8px] font-black uppercase tracking-widest bg-white/20 px-2 py-1 rounded">
                     {item.type}
                   </span>
                   <Tag size={16} className="text-amber-400" />
                 </div>
                 <h4 className="serif text-xl font-bold leading-tight line-clamp-2">{item.title}</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 text-[10px] font-bold text-white/90">
                    {(item.distance !== undefined || item.venueName) && (
                      <div className="flex items-center gap-2">
                        {item.venueName ? <Coffee size={12} /> : <MapPin size={12} />}
                        <span>
                          {item.venueName && `${item.venueName}`}
                          {item.venueName && item.distance !== undefined && ' · '}
                          {item.distance !== undefined && `${item.distance.toFixed(1)} km away`}
                        </span>
                      </div>
                    )}
                    {item.createdAt && (
                      <div className="flex items-center gap-1.5 bg-white/10 sm:bg-transparent px-2 py-0.5 sm:p-0 rounded-full w-fit">
                        <Clock size={10} />
                        <span>{formatDistanceToNow(item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt), { addSuffix: true })}</span>
                      </div>
                    )}
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {circleId && (
        <div className="px-6 mb-4">
          {/* Circle specific view has no additional header filters */}
        </div>
      )}

      <div className="px-6 space-y-6 pb-20">
        {profile?.skippedFirstAct && (
          circleId ? (
            // ── Circle context ────────────────────────────────────────────
            !loading && filteredItems.length === 0 ? (
              // Empty circle — invite to be the first poster
              <div className="p-5 bg-[#FDFBF9] border border-stone-300 rounded-3xl space-y-4 shadow-sm relative animate-in fade-in slide-in-from-top-2 duration-500">
                <button onClick={dismissNudge} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors">
                  <span className="text-sm font-bold">✕</span>
                </button>
                <div className="space-y-1 pr-6 text-left">
                  <h4 className="serif text-base font-bold text-stone-900 flex items-center gap-2">
                    <span>✨</span> Be the first to post
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed font-medium">
                    Nothing shared in this circle yet. Kick things off — give something away, ask a question, or organise a meet-up with the group.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onNavigateToTab?.('post')} className="px-4 py-2 bg-[#5A5A40] text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-[#4E4E38] active:scale-[0.98] transition-all shadow-sm flex items-center gap-1.5">
                    🎁 Give something
                  </button>
                  <button onClick={() => onNavigateToTab?.('post')} className="px-4 py-2 bg-stone-200 text-stone-700 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-stone-300 active:scale-[0.98] transition-all flex items-center gap-1.5">
                    🙋 Ask for something
                  </button>
                  <button onClick={() => onNavigateToTab?.('post')} className="px-4 py-2 bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-teal-100 active:scale-[0.98] transition-all flex items-center gap-1.5">
                    🤝 Organize a Join
                  </button>
                </div>
              </div>
            ) : !loading && filteredItems.length > 0 ? (
              // Circle has items — softer nudge to contribute
              <div className="p-4 bg-stone-50/80 border border-stone-200 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in duration-500">
                <p className="text-xs text-stone-500 leading-relaxed font-medium flex-1">
                  👋 Others are already sharing here. Got something to contribute?
                </p>
                <button
                  onClick={dismissNudge}
                  className="text-stone-400 hover:text-stone-600 transition-colors flex-none"
                >
                  <span className="text-sm font-bold">✕</span>
                </button>
                <button
                  onClick={() => onNavigateToTab?.('post')}
                  className="px-3 py-2 bg-[#5A5A40] text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-[#4E4E38] active:scale-[0.98] transition-all shadow-sm flex-none"
                >
                  Post
                </button>
              </div>
            ) : null
          ) : (
            // ── Home feed context ─────────────────────────────────────────
            <div className="p-5 bg-[#FDFBF9] border border-stone-300 rounded-3xl space-y-4 shadow-sm relative animate-in fade-in slide-in-from-top-2 duration-500">
              <button onClick={dismissNudge} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors">
                <span className="text-sm font-bold">✕</span>
              </button>
              <div className="space-y-1 pr-6 text-left">
                <h4 className="serif text-base font-bold text-stone-900 flex items-center gap-2">
                  <span>🏡</span> Join the Neighborhood
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed font-medium">
                  You haven't joined the conversation yet. Give something away, ask for a hand, or discover community activities and groups near you.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onNavigateToTab?.('post')} className="px-4 py-2 bg-[#5A5A40] text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-[#4E4E38] active:scale-[0.98] transition-all shadow-sm flex items-center gap-1.5">
                  🎁 Give something
                </button>
                <button onClick={() => onNavigateToTab?.('post')} className="px-4 py-2 bg-stone-200 text-stone-700 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-stone-300 active:scale-[0.98] transition-all flex items-center gap-1.5">
                  🙋 Ask for something
                </button>
                <button onClick={() => onNavigateToTab?.('post')} className="px-4 py-2 bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-teal-100 active:scale-[0.98] transition-all flex items-center gap-1.5">
                  🤝 Organize a Join
                </button>
              </div>
            </div>
          )
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-stone-100 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          filteredItems.map(item => (
            <div key={item.id}>
              <ItemCard 
                item={item} 
                circle={item.circleId ? circles[item.circleId] : undefined} 
                onNavigateToChat={onNavigateToChat}
                onViewProfile={setSelectedProfileId}
                onClick={() => {
                  setDetailItem(item);
                  setShouldFocusComment(false);
                }}
                onShare={(it) => setSharingItem(it)}
                onComment={(it) => {
                  setDetailItem(it);
                  setShouldFocusComment(true);
                }}
              />
            </div>
          ))
        ) : (
          <div className="text-center py-20 space-y-4">
            <p className="text-stone-400 italic font-serif">No items in the feed yet.</p>
          </div>
        )}
      </div>

      {selectedProfileId && (
        <PublicProfile 
          userId={selectedProfileId} 
          onClose={() => setSelectedProfileId(null)} 
          onNavigateToChat={onNavigateToChat}
        />
      )}

      {detailItem && (
        <ItemDetailsSheet 
          item={detailItem}
          focusComment={shouldFocusComment}
          onClose={() => {
            setDetailItem(null);
            setShouldFocusComment(false);
          }}
          onViewProfile={(userId) => {
            setSelectedProfileId(userId);
            setDetailItem(null);
            setShouldFocusComment(false);
          }}
        />
      )}

      <AnimatePresence>
        {sharingItem && (
          <BridgeSheet
            item={sharingItem}
            onClose={() => setSharingItem(null)}
            onBridged={() => setSharingItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export interface ItemCardProps {
  item: Item;
  circle?: Circle;
  onNavigateToChat?: (chatId: string) => void;
  onViewProfile?: (userId: string) => void;
  onClick?: () => void;
  onShare?: (item: Item) => void;
  onComment?: (item: Item) => void;
}

export function ItemCard({ item, circle, onNavigateToChat, onViewProfile, onClick, onShare, onComment }: ItemCardProps) {
  const { user, profile } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [isJoiningCircle, setIsJoiningCircle] = useState(false);

  const handleJoinCircle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !circle) return;

    if (circle.privacy !== 'PUBLIC') {
      alert("This is a private circle. Visit the circles page to request access.");
      return;
    }

    setIsJoiningCircle(true);
    try {
      // Logic from Circles.tsx handleJoin
      await setDoc(doc(db, 'circles', circle.id, 'members', user.uid), {
        joinedAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'users', user.uid), {
        joinedCircles: arrayUnion(circle.id)
      });

      const itemRef = doc(db, 'circles', circle.id);
      const snap = await getDoc(itemRef);
      if (snap.exists()) {
        await updateDoc(itemRef, {
          memberCount: (snap.data().memberCount || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error joining circle:', err);
    } finally {
      setIsJoiningCircle(false);
    }
  };

  const handleJoinImece = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    
    setIsJoining(true);
    try {
      const isParticipating = item.participants?.includes(profile.uid);
      const itemRef = doc(db, 'items', item.id);
      
      await updateDoc(itemRef, {
        participants: isParticipating ? arrayRemove(profile.uid) : arrayUnion(profile.uid)
      });
    } catch (err) {
      console.error('Error joining Imece:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const handleInterest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !profile) return;
    
    setIsJoining(true);
    try {
      await addDoc(collection(db, 'swipes'), {
        itemId: item.id,
        swiperId: user.uid,
        ownerId: item.ownerId,
        type: 'LIKE',
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'notifications'), {
        userId: item.ownerId,
        type: 'MATCH_INTEREST',
        content: `Interest in ${item.type}: ${item.title}`,
        isRead: false,
        link: `/chats`,
        createdAt: serverTimestamp()
      });

      const chatId = await getOrCreateChat(user.uid, item.ownerId, item.id, item.title);
      
      if (onNavigateToChat) {
        onNavigateToChat(chatId);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsJoining(false);
    }
  };

  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);

  const targetLanguage = profile?.preferredLanguage || 'English';

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (translatedDescription) {
      setShowOriginal(!showOriginal);
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateText(item.description, targetLanguage);
      setTranslatedDescription(result);
      setShowOriginal(false);
    } catch (err) {
      console.error('Translation failed', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const participantCount = item.participants?.length || 0;
  const targetParticipants = item.neededParticipants || 5;
  const progress = Math.min((participantCount / targetParticipants) * 100, 100);
  const isUserParticipating = profile ? item.participants?.includes(profile.uid) : false;

  return (
    <div 
      onClick={onClick}
      className={`bg-[#FDFBF9] border border-stone-200/80 rounded-[2rem] p-5 shadow-sm hover:shadow-md hover:border-stone-300/80 transition-all group overflow-hidden relative cursor-pointer flex flex-col gap-3.5 ${
        item.type === 'JOIN' ? 'bg-[#F4F7F4] border-teal-200/80' : ''
      }`}
    >
      {/* 1. Header Line: Profile Avatar, Name, Time, Type Badge */}
      <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
        <div className="flex items-center gap-2">
          <OwnerAvatar 
            ownerId={item.ownerId} 
            initialPhotoURL={item.ownerPhoto} 
            initialName={item.ownerName} 
            className="w-8 h-8 ring-2 ring-stone-100 group-hover:ring-[#5B6B56]/40 transition-all cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile?.(item.ownerId);
            }}
          />
          <div className="flex flex-col">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile?.(item.ownerId);
              }}
              className="text-stone-800 text-[11px] font-black uppercase tracking-wider hover:text-[#5B6B56] transition-colors text-left"
            >
              <OwnerName ownerId={item.ownerId} initialName={item.ownerName} />
            </button>
            {item.createdAt && (
              <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                {formatDistanceToNow(item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.isFeatured && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Featured" />}
          {item.category && (
            <span className="px-2 py-1 bg-stone-100/90 border border-stone-200/40 rounded-full text-[8px] font-black uppercase tracking-widest text-stone-500">
              {item.category}
            </span>
          )}
          {item.sharingMode && (
            <span className={`px-2 py-0.5 border rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm ${
              item.sharingMode === 'GIFT' ? 'bg-emerald-50/80 text-emerald-800 border-emerald-100' :
              item.sharingMode === 'LEND' ? 'bg-amber-50/80 text-amber-800 border-amber-100' :
              item.sharingMode === 'BORROW' ? 'bg-amber-50/80 text-amber-800 border-amber-100' :
              item.sharingMode === 'SKILL' ? 'bg-indigo-50/80 text-indigo-800 border-indigo-100' :
              'bg-rose-50/80 text-rose-800 border-rose-100'
            }`}>
              <span>
                {item.sharingMode === 'GIFT' && '🎁'}
                {item.sharingMode === 'LEND' && '🛠️'}
                {item.sharingMode === 'BORROW' && '🔍'}
                {item.sharingMode === 'SKILL' && '🤝'}
                {item.sharingMode === 'FAVOR' && '❤️'}
              </span>
              <span>
                {item.sharingMode === 'GIFT' ? (item.type === 'SHARE' ? 'Giveaway' : 'Keep') :
                 item.sharingMode === 'LEND' ? 'Lend' :
                 item.sharingMode === 'BORROW' ? 'Borrow' :
                 item.sharingMode === 'SKILL' ? 'Skill Share' : 'Favor'}
              </span>
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-sm ${
            item.type === 'SHARE' ? 'bg-[#4A6B53]' : 
            item.type === 'ASK' ? 'bg-[#C86A51]' : 
            'bg-[#D4A373]'
          }`}>
            {item.type}
          </span>
        </div>
      </div>

      {/* 2. Body: Polaroid thumbnail and metadata/description */}
      <div className="flex gap-4">
        {/* Polaroid frame thumbnail */}
        <div className="w-24 h-24 bg-white p-1 border border-stone-200/80 rounded-xl flex-shrink-0 relative overflow-hidden shadow-sm rotate-[-1.5deg] group-hover:rotate-[0deg] transition-all">
          {item.images?.[0] ? (
            <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <img src={getFallbackImage(item.category)} alt={item.category || item.type} className="w-full h-full object-cover rounded-lg opacity-85" />
          )}
        </div>

        {/* Content detail area */}
        <div className="flex-1 flex flex-col justify-between pr-2 min-w-0">
          <div>
            <h4 className={`serif font-bold text-base leading-tight transition-colors line-clamp-2 ${
              item.type === 'JOIN' ? 'text-teal-900 group-hover:text-teal-700' : 
              'text-stone-900 group-hover:text-[#5B6B56]'
            }`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.title}
                {(item as any).ownerIsOrganization && (
                  <Shield size={13} className="text-indigo-500 fill-indigo-50 inline" />
                )}
              </div>
            </h4>

            {/* Scope / Circle info */}
            <div className="mt-1 flex items-center min-h-[16px]">
              {circle ? (
                <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-[#B38F4F] bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                  <Users size={10} />
                  <span>{circle.name} Circle</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(item.reachTypes) ? item.reachTypes : [item.reachTypes || 'VICINITY']).map(rt => (
                    <div key={rt} className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit ${
                      item.type === 'JOIN' ? 'text-teal-600 bg-teal-100/40' :
                      'text-stone-400 bg-stone-100/60'
                    }`}>
                      {rt === 'VICINITY' && <Globe size={9} />}
                      {rt === 'ALL_CIRCLES' && <Shield size={9} />}
                      {rt === 'SPECIFIC_CIRCLES' && <Target size={9} />}
                      <span>
                        {rt === 'VICINITY' && 'Local'}
                        {rt === 'ALL_CIRCLES' && 'Inner'}
                        {rt === 'SPECIFIC_CIRCLES' && 'Selected'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {!circle && item.ownerIsOrganization && (
                 <div className="text-[8px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1 ml-2">
                   <Shield size={9} />
                   <span>Verified Org</span>
                 </div>
              )}
            </div>
          </div>

          {/* Inline location/distance + Trust connection metadata */}
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[9px] font-bold text-stone-500 uppercase tracking-wider">
            {(item.distance !== undefined || item.venueName) && (item.distance === undefined || item.distance < 100) && (
              <div className="flex items-center gap-1 text-stone-500">
                {item.venueName ? <Coffee size={11} className="text-stone-400" /> : <MapPin size={11} className="text-stone-400" />}
                <span>
                  {item.venueName && item.venueName}
                  {item.venueName && item.distance !== undefined && ' · '}
                  {item.distance !== undefined && `${item.distance.toFixed(1)} km`}
                </span>
              </div>
            )}
            <ConnectionBadge targetUserId={item.ownerId} className="!mt-0" />
          </div>
        </div>
      </div>

      {/* 3. Description Block */}
      <div className="relative group/desc bg-stone-50/50 p-2.5 rounded-2xl border border-stone-100/80">
        <p className="text-xs text-stone-600 italic leading-relaxed">
          "{showOriginal ? item.description : translatedDescription}"
        </p>
        <button 
          onClick={handleTranslate}
          className="absolute right-2 top-2 opacity-0 group-hover/desc:opacity-100 transition-opacity p-1 bg-white rounded-full shadow-sm text-stone-400 hover:text-[#5B6B56]"
          title={`Translate to ${targetLanguage}`}
        >
          {isTranslating ? <Loader2 size={11} className="animate-spin" /> : <Languages size={11} />}
        </button>
        {!showOriginal && translatedDescription && (
          <div className="text-[9px] text-stone-400 mt-1 flex items-center gap-1">
            <Languages size={10} /> Translated to {targetLanguage} · <button onClick={(e) => { e.stopPropagation(); setShowOriginal(true); }} className="hover:underline">Original</button>
          </div>
        )}
      </div>

      {/* 4. Footer Actions & Dates */}
      <div className="flex justify-between items-center mt-0.5 border-t border-stone-100 pt-3">
        <div className="flex flex-col gap-1 min-w-0">
          {item.type === 'JOIN' && participantCount > 0 && (
            <div className="text-[9px] font-black uppercase tracking-widest text-teal-700 flex items-center gap-1">
              <Users size={11} className="text-teal-600" />
              <span>{participantCount} {participantCount === 1 ? 'going' : 'going'}</span>
            </div>
          )}
          {item.expiresAt && (
            <div className="flex items-center gap-1 text-amber-700 text-[8px] font-bold uppercase tracking-wider bg-amber-50/60 px-2 py-0.5 rounded-full w-fit">
              <Calendar size={10} />
              <span>Until {new Date(item.expiresAt.toDate ? item.expiresAt.toDate() : item.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
          {item.eventTime && (
            <div className="flex items-center gap-1 text-indigo-700 text-[8px] font-bold uppercase tracking-wider bg-indigo-50/60 px-2 py-0.5 rounded-full w-fit">
              <Calendar size={10} />
              <span>{new Date(item.eventTime.toDate ? item.eventTime.toDate() : item.eventTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Share Action */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onShare?.(item);
            }}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-all flex items-center justify-center border border-stone-200/40"
            title="Share / Bridge item"
          >
            <Share size={12} className="stroke-[2.5]" />
          </button>

          {/* Comment / Discuss Action */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onComment?.(item);
            }}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-all flex items-center justify-center gap-1.5 px-3 border border-stone-200/40"
            title="Discuss / Comment"
          >
            <MessageCircle size={12} className="stroke-[2.5]" />
            <span className="text-[9px] font-black uppercase tracking-wider">Discuss</span>
          </button>

          {item.type === 'JOIN' ? (
            <button 
              onClick={handleJoinImece}
              disabled={isJoining}
              className={`px-4 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest transition-all flex items-center gap-1.5 shadow-sm ${
                isUserParticipating 
                  ? 'bg-teal-100 text-teal-700 border border-teal-200/80' 
                  : 'bg-[#4A6B53] text-white hover:bg-[#3D5A40]'
              }`}
            >
              <Users size={11} />
              <span>{isJoining ? 'Wait...' : isUserParticipating ? 'Going!' : 'RSVP & Join'}</span>
            </button>
          ) : (
            <button 
              onClick={handleInterest}
              disabled={isJoining}
              className="px-4 py-1.5 bg-[#5B6B56] hover:bg-[#4A5746] text-white rounded-full text-[9px] uppercase font-black tracking-widest transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isJoining ? 'Wait...' : (
                <>
                  <MessageSquare size={11} />
                  <span>Contact</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
