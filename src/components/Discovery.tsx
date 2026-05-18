/**
 * FILE: Discovery.tsx
 * ROLE IN KULA: The "Tinder for Neighbors" — a swipeable card interface for items.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   This is the PRIMARY content consumption component. It fetches items from
 *   useItems.ts and presents them as swipeable cards.
 * 
 * SWIPE MECHANICS:
 *   - SWIPE RIGHT (or ❤️ button): "I'm interested"
 *     → Creates a swipe record, sends a notification to the item owner,
 *     → Creates or finds a chat via chatService.getOrCreateChat()
 *     → Navigates to the chat via onNavigateToChat callback
 *   - SWIPE LEFT (or ✕ button): "Not interested"
 *     → Records a PASS swipe (prevents showing the item again)
 *   - SWIPE UP (or 💬 button): "View details"
 *     → Opens ItemDetailsSheet.tsx with full item info and comments
 * 
 * CIRCLE_INVITE CARDS:
 *   Public circles the user hasn't joined appear as special JOIN cards.
 *   Swiping right on these joins the circle (adds to members subcollection,
 *   updates user's joinedCircles array, increments memberCount).
 * 
 * INTERLEAVING ALGORITHM (useMemo):
 *   Items are grouped by type (ASK, SHARE, JOIN, etc.) then interleaved
 *   to prevent monotony — max 2 of the same type in a row. Within each type,
 *   items are sorted by distance (closest first).
 * 
 * FILTERS:
 *   - Local/Global toggle: limits items by distance radius
 *   - Scope: ALL / VICINITY / CIRCLES / ORGS
 *   - Type: ALL / ASK / SHARE / JOIN / IMECE / MISSION
 *   Persisted in localStorage for session continuity.
 * 
 * SUB-COMPONENTS:
 *   - SwipeCard: The draggable card with Framer Motion physics
 *   - BridgeSheet: Share items with circles or connections
 *   - MapView: Alternative map view of the same filtered items
 * 
 * CALLED BY: Explore.tsx (DISCOVERY view mode)
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { X, Heart, MapPin, Tag, Map as MapIcon, Layers, Globe, Users, Clock, Shield, Languages, Loader2, Zap, Send, Share2, Copy, MessageCircle } from 'lucide-react';
import { useItems } from '../hooks/useItems';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDoc, doc, updateDoc, documentId, getDocs, setDoc, arrayUnion } from 'firebase/firestore';
import { getOrCreateChat } from '../services/chatService';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import MapView from './MapView';
import { formatDistanceToNow } from 'date-fns';
import { translateText } from '../services/geminiService';
import { getFallbackImage, ART_DIRECTION } from '../lib/artDirection';
import { DISCOVERY_DEFAULTS } from '../lib/constants';

import PublicProfile from './PublicProfile';
import { OwnerName } from './OwnerName';
import { ItemDetailsSheet } from './ItemDetailsSheet';
import ConnectionBadge from './ConnectionBadge';

interface DiscoveryProps {
  location: { lat: number; lng: number } | null;
  circleId?: string;
  onNavigateToChat?: (chatId: string) => void;
  onNavigateToCircle?: (circleId: string) => void;
}

export default function Discovery({ location, circleId, onNavigateToChat, onNavigateToCircle }: DiscoveryProps) {
  const { user, profile } = useAuth();
  const { items, loading } = useItems(location, profile, circleId);
  const [localSwipedIds, setLocalSwipedIds] = useState<Set<string>>(new Set());
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [isLocalOnly, setIsLocalOnly] = useState(() => {
    const saved = localStorage.getItem('kula_discovery_local_only');
    return saved !== null ? saved === 'true' : DISCOVERY_DEFAULTS.localOnly;
  });
  const [localRadius, setLocalRadius] = useState(() => {
    const saved = localStorage.getItem('kula_discovery_radius');
    return saved !== null ? Number(saved) : DISCOVERY_DEFAULTS.radius;
  });
  const [viewMode, setViewMode] = useState<'RADAR' | 'MAP'>('RADAR');
  const [scope, setScope] = useState<'ALL' | 'VICINITY' | 'CIRCLES' | 'ORGS'>(() => {
    return (localStorage.getItem('kula_discovery_scope') as any) || DISCOVERY_DEFAULTS.scope;
  });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'ASK' | 'SHARE' | 'IMECE' | 'MISSION' | 'JOIN' | 'CIRCLE_INVITE'>(() => {
    return (localStorage.getItem('kula_discovery_type_filter') as any) || DISCOVERY_DEFAULTS.typeFilter;
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [bridgingItem, setBridgingItem] = useState<Item | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [circleItems, setCircleItems] = useState<Item[]>([]);

  useEffect(() => {
    if (circleId) {
      setCircleItems([]);
      return;
    }
    const fetchCircles = async () => {
      try {
        const q = query(collection(db, 'circles'), where('privacy', '==', 'PUBLIC'));
        const snap = await getDocs(q);
        const mapped: Item[] = [];
        snap.forEach(docSnap => {
          const c = docSnap.data();
          if (profile?.joinedCircles?.includes(docSnap.id)) return; // Already joined
          
          mapped.push({
            id: docSnap.id,
            ownerId: c.creatorId,
            title: `Circle: ${c.name}`,
            description: c.description,
            type: 'CIRCLE_INVITE' as const,
            category: 'Community',
            images: c.photoURL ? [c.photoURL] : [ART_DIRECTION.fallbacks.CircleInvite],
            status: 'ACTIVE',
            location: { lat: 0, lng: 0 }, // fallback
            isFeatured: false,
            reachTypes: ['ALL_CIRCLES'],
            distance: 0, // Mock distance
            createdAt: c.createdAt,
            ownerName: 'Circle Invite',
          });
        });
        setCircleItems(mapped);
      } catch (err) {
        console.error('Failed to fetch circles for discovery', err);
      }
    };
    fetchCircles();
  }, [circleId, profile?.joinedCircles]);

  useEffect(() => {
    localStorage.setItem('kula_discovery_local_only', String(isLocalOnly));
    localStorage.setItem('kula_discovery_radius', String(localRadius));
    localStorage.setItem('kula_discovery_scope', scope);
    localStorage.setItem('kula_discovery_type_filter', typeFilter);
    setLocalSwipedIds(new Set());
  }, [scope, typeFilter, localRadius, isLocalOnly]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'swipes'), where('swiperId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set(snapshot.docs.map(doc => doc.data().itemId));
      setSwipedIds(ids);
    });
    return unsubscribe;
  }, [user]);

  // Type-aware interleaving logic to prevent too many of the same "card type" in a row
  const activeItems = React.useMemo(() => {
    const rawItems = [...items, ...circleItems].filter(item => {
      if (item.ownerId === user?.uid) return false;
      if (swipedIds.has(item.id) || localSwipedIds.has(item.id)) return false;
      
      // For CIRCLE_INVITE, bypass local radius filter as they are global or logic is different
      if (item.type !== 'CIRCLE_INVITE') {
        // Local/Global Filter
        const isLocalhost = window.location.hostname === 'localhost';
        if (isLocalOnly && !isLocalhost && item.distance !== undefined && item.distance !== Infinity && item.distance > localRadius) return false;
        
        // Scope Filter
        if (scope === 'VICINITY' && !item.reachTypes?.includes('VICINITY')) return false;
        if (scope === 'CIRCLES' && !(item.reachTypes?.includes('ALL_CIRCLES') || item.reachTypes?.includes('SPECIFIC_CIRCLES'))) return false;
        if (scope === 'ORGS' && !item.ownerIsOrganization) return false;
      }

      // Type Filter
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      
      return true;
    });

    // If a specific filter is set, just return standard distance-based/chronological sorting
    if (typeFilter !== 'ALL') {
      const groups: Record<string, Item[]> = {};
      rawItems.forEach(item => {
        const type = item.type || 'UNKNOWN';
        if (!groups[type]) groups[type] = [];
        groups[type].push(item);
      });

      Object.values(groups).forEach(group => {
        group.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      });

      const interleaved: Item[] = [];
      const totalToFetch = rawItems.length;

      while (interleaved.length < totalToFetch) {
        const availableTypes = Object.keys(groups).filter(t => groups[t].length > 0);
        if (availableTypes.length === 0) break;

        let selectedType = availableTypes[0];
        let minDist = groups[selectedType][0].distance ?? 999999;
        
        for (let i = 1; i < availableTypes.length; i++) {
          const t = availableTypes[i];
          const d = groups[t][0].distance ?? 999999;
          if (d < minDist) {
            minDist = d;
            selectedType = t;
          }
        }

        const item = groups[selectedType].shift()!;
        interleaved.push(item);
      }
      return interleaved;
    }

    // For 'ALL', separate CIRCLE_INVITE items from normal posts to prevent distance-0 dominance
    const circleInvites = rawItems.filter(item => item.type === 'CIRCLE_INVITE');
    const otherItems = rawItems.filter(item => item.type !== 'CIRCLE_INVITE');

    // Interleave all other items normally
    const groups: Record<string, Item[]> = {};
    otherItems.forEach(item => {
      const type = item.type || 'UNKNOWN';
      if (!groups[type]) groups[type] = [];
      groups[type].push(item);
    });

    Object.values(groups).forEach(group => {
      group.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    });

    const otherInterleaved: Item[] = [];
    const currentStreak = { type: '', count: 0 };
    const maxInARow = 2;
    const totalToFetchOther = otherItems.length;

    while (otherInterleaved.length < totalToFetchOther) {
      const availableTypes = Object.keys(groups).filter(t => groups[t].length > 0);
      if (availableTypes.length === 0) break;

      let selectedType = '';

      if (currentStreak.count >= maxInARow && availableTypes.length > 1) {
        const otherTypes = availableTypes.filter(t => t !== currentStreak.type);
        selectedType = otherTypes[0];
        let minOtherDist = groups[selectedType][0].distance ?? 999999;
        
        for (let i = 1; i < otherTypes.length; i++) {
          const t = otherTypes[i];
          const d = groups[t][0].distance ?? 999999;
          if (d < minOtherDist) {
            minOtherDist = d;
            selectedType = t;
          }
        }
      } else {
        selectedType = availableTypes[0];
        let minDist = groups[selectedType][0].distance ?? 999999;
        
        for (let i = 1; i < availableTypes.length; i++) {
          const t = availableTypes[i];
          const d = groups[t][0].distance ?? 999999;
          if (d < minDist) {
            minDist = d;
            selectedType = t;
          }
        }
      }

      const item = groups[selectedType].shift()!;
      otherInterleaved.push(item);

      const itemType = String(item.type || 'UNKNOWN');
      if (itemType === currentStreak.type) {
        currentStreak.count++;
      } else {
        currentStreak.type = itemType;
        currentStreak.count = 1;
      }
    }

    // Merge CIRCLE_INVITE cards into the normal card deck.
    // Strategy: calculate proportional positions, but CAP the maximum gap so
    // a circle invite always appears within MAX_GAP normal cards of the previous one.
    //
    // With 220 normals and 3 circles, pure proportionality → first circle at card ~73.
    // With MAX_GAP=5 → circle invites appear at cards 5, 11, 17, then all normals after.
    //
    // MAX_GAP = the most normal cards the user can swipe before a circle invite must appear.
    const MAX_GAP = 5;

    if (circleInvites.length === 0) {
      return otherInterleaved;
    }
    if (otherInterleaved.length === 0) {
      return circleInvites;
    }

    // Pre-calculate capped insertion positions.
    // Each position is the minimum of the proportional position and the gap-capped position.
    const totalFinal = otherInterleaved.length + circleInvites.length;
    const stride = totalFinal / circleInvites.length;

    const circleInsertPositions = new Set<number>();
    let lastInsertedAt = -1;
    for (let i = 0; i < circleInvites.length; i++) {
      const proportionalPos = Math.round(stride * i + stride / 2) - 1;
      const gapCappedPos = lastInsertedAt + MAX_GAP + 1;
      const actualPos = Math.min(proportionalPos, gapCappedPos);
      circleInsertPositions.add(actualPos);
      lastInsertedAt = actualPos;
    }

    // Build the final array in a single pass.
    const finalInterleaved: Item[] = [];
    let otherIdx = 0;
    let circleIdx = 0;

    for (let pos = 0; pos < totalFinal; pos++) {
      if (circleInsertPositions.has(pos) && circleIdx < circleInvites.length) {
        finalInterleaved.push(circleInvites[circleIdx++]);
      } else if (otherIdx < otherInterleaved.length) {
        finalInterleaved.push(otherInterleaved[otherIdx++]);
      } else {
        finalInterleaved.push(circleInvites[circleIdx++]);
      }
    }

    return finalInterleaved;
  }, [items, circleItems, user?.uid, swipedIds, localSwipedIds, isLocalOnly, localRadius, scope, typeFilter]);

  const currentItem = activeItems[0];

  const handleSwipe = async (direction: 'right' | 'left' | 'up') => {
    if (!currentItem || !user) return;

    // Optimistically hide the current item
    const itemToHandle = currentItem;
    const itemId = itemToHandle.id;
    
    if (direction === 'up') {
      setDetailItem(itemToHandle);
      return; // UI will handle the rest via the ItemDetailsSheet
    }

    setLocalSwipedIds(prev => new Set([...prev, itemId]));
    
    if (direction === 'right') {
      if (currentItem.type === 'CIRCLE_INVITE') {
        try {
          console.log("Joining circle...");
          await setDoc(doc(db, 'circles', currentItem.id, 'members', user.uid), {
            joinedAt: serverTimestamp()
          });
          
          await updateDoc(doc(db, 'users', user.uid), {
            joinedCircles: arrayUnion(currentItem.id)
          });

          const circleRef = doc(db, 'circles', currentItem.id);
          const circleSnap = await getDoc(circleRef);
          if (circleSnap.exists()) {
            await updateDoc(circleRef, {
              memberCount: (circleSnap.data().memberCount || 0) + 1
            });
          }

          // Automatically open the circle space after joining
          if (onNavigateToCircle) {
            onNavigateToCircle(currentItem.id);
          }
        } catch (err: any) {
          console.error("Right swipe on circle failed with error:", err);
          handleFirestoreError(err, OperationType.WRITE, 'circles');
        }
      } else {
        try {
          console.log("Adding swipe...");
          await addDoc(collection(db, 'swipes'), {
            itemId: currentItem.id,
            swiperId: user.uid,
            ownerId: currentItem.ownerId,
            type: 'LIKE',
            createdAt: serverTimestamp()
          });

          console.log("Adding notification...");
          await addDoc(collection(db, 'notifications'), {
            userId: currentItem.ownerId,
            type: 'MATCH_INTEREST',
            content: `Someone is interested in your ${
              currentItem.type === 'ASK' ? 'need' : 
              currentItem.type === 'SHARE' ? 'gift' : 
              currentItem.type === 'JOIN' ? 'gathering' : 'item'
            }: ${currentItem.title}`,
            isRead: false,
            link: `/chats`,
            createdAt: serverTimestamp()
          });

          console.log("Getting or creating chat...");
          const chatId = await getOrCreateChat(user.uid, currentItem.ownerId, currentItem.id, currentItem.title);
          console.log("Chat Id:", chatId);

          if (onNavigateToChat) {
            console.log("Navigating to chat...");
            onNavigateToChat(chatId);
          } else {
            console.log("No onNavigateToChat function passed!");
          }
        } catch (err: any) {
          console.error("Right swipe failed with error:", err);
          handleFirestoreError(err, OperationType.WRITE, 'swipes/chats');
        }
      }
    } else {
      try {
        await addDoc(collection(db, 'swipes'), {
          itemId: currentItem.id,
          swiperId: user.uid,
          ownerId: currentItem.ownerId,
          type: 'PASS',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Failed to record skip:', err);
      }
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-pulse text-stone-300 font-serif text-xl italic">Curating your circle...</div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col p-1 sm:p-4 relative overflow-y-auto no-scrollbar min-h-0 h-full w-full">
      {!circleId && (
        <div className="flex-none space-y-2 sm:space-y-4 mb-1 sm:mb-4 px-1 sm:px-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="serif text-lg sm:text-2xl font-bold text-stone-900">Discovery</h2>
              
              <div className="flex items-center gap-2">
                <button 
                  id="tour-discovery-filter"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    isFilterOpen || scope !== 'ALL' || typeFilter !== 'ALL' || !isLocalOnly
                      ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                      : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                  }`}
                >
                  <Tag size={12} />
                  <span>Filter</span>
                  {(scope !== 'ALL' || typeFilter !== 'ALL' || !isLocalOnly) && (
                    <span className="w-4 h-4 bg-amber-400 text-stone-900 rounded-full flex items-center justify-center text-[8px] font-black">
                      !
                    </span>
                  )}
                </button>

                <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200">
                  <button 
                    onClick={() => setViewMode('RADAR')}
                    className={`p-1 rounded-lg transition-all ${viewMode === 'RADAR' ? 'bg-white shadow-md text-stone-900' : 'text-stone-400'}`}
                  >
                    <Layers size={14} />
                  </button>
                  <button 
                    onClick={() => setViewMode('MAP')}
                    className={`p-1 rounded-lg transition-all ${viewMode === 'MAP' ? 'bg-white shadow-md text-stone-900' : 'text-stone-400'}`}
                  >
                    <MapIcon size={14} />
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-4 pt-2 pb-4 border-b border-stone-100"
                >
                  {/* Location Scope Toggle & Radius */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Search Area</span>
                      <div className="flex bg-stone-200 p-0.5 rounded-xl self-start">
                        <button 
                          onClick={() => setIsLocalOnly(true)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isLocalOnly ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
                        >
                          Local
                        </button>
                        <button 
                          onClick={() => setIsLocalOnly(false)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${!isLocalOnly ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}
                        >
                          Global
                        </button>
                      </div>
                    </div>

                    {isLocalOnly && (
                      <div className="flex flex-col gap-1 flex-1 max-w-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Radius</span>
                          <span className="text-[10px] font-black text-stone-900">{localRadius}km</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="100" 
                          value={localRadius} 
                          onChange={(e) => setLocalRadius(Number(e.target.value))}
                          className="w-full accent-stone-900 h-1 rounded-lg appearance-none cursor-pointer bg-stone-200"
                        />
                      </div>
                    )}
                  </div>

                  {/* Context Scope */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 px-1">Neighbor Source</span>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { id: 'ALL', label: 'All', icon: Globe },
                        { id: 'VICINITY', label: 'Near', icon: MapPin },
                        { id: 'CIRCLES', label: 'Circles', icon: Users },
                        { id: 'ORGS', label: 'Orgs', icon: Shield }
                      ].map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setScope(s.id as any)}
                          className={`flex-1 min-w-[70px] py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 border-2 transition-all ${
                            scope === s.id 
                              ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                              : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                          }`}
                        >
                          <s.icon size={10} />
                          <span>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Type Selection */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 px-1">Interaction Type</span>
                    <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                      {(['ALL', 'SHARE', 'ASK', 'JOIN', 'IMECE', 'MISSION', 'CIRCLE_INVITE'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTypeFilter(t)}
                          className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 border ${
                            typeFilter === t 
                              ? 'bg-amber-100 border-amber-200 text-amber-900 shadow-sm' 
                              : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
                          }`}
                        >
                          {t === 'ALL' ? 'All' : t === 'SHARE' ? 'Gives' : t === 'ASK' ? 'Asks' : t === 'JOIN' ? 'Joins' : t === 'IMECE' ? 'İmece' : t === 'MISSION' ? 'Missions' : 'Circles'}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}


      {circleId && (
        <div className="flex justify-end mb-4 px-2">
          <div className="flex bg-stone-100 p-1 rounded-2xl">
            <button 
              onClick={() => setViewMode('RADAR')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'RADAR' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}
            >
              <Layers size={18} />
            </button>
            <button 
              onClick={() => setViewMode('MAP')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'MAP' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}
            >
              <MapIcon size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-none relative min-h-[400px]">
        {viewMode === 'RADAR' ? (
          <AnimatePresence mode="wait">
            {activeItems.length > 0 ? (
              <div key={currentItem?.id} className="w-full">
                <SwipeCard 
                  item={currentItem} 
                  onSwipe={handleSwipe} 
                  onViewProfile={setSelectedProfileId}
                  isLocalOnly={isLocalOnly}
                />
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4"
              >
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                  <MapPin size={32} />
                </div>
                <h2 className="serif text-2xl font-bold text-stone-800">No more items matching filters</h2>
                <p className="text-stone-500 italic text-sm">Check back later or try different categories!</p>
                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={() => {
                      setScope('ALL');
                      setTypeFilter('ALL');
                      setLocalSwipedIds(new Set());
                    }}
                    className="bg-stone-900 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-stone-800 transition-all"
                  >
                    Clear All Filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <MapView 
            items={activeItems} 
            center={location || { lat: 52.5200, lng: 13.4050 }} 
            onItemClick={setDetailItem}
          />
        )}
      </div>

      {viewMode === 'RADAR' && activeItems.length > 0 && (
        <div className="flex-none flex items-center justify-center gap-6 sm:gap-8 py-8">
          <button 
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 bg-white border-2 border-stone-200 rounded-full flex items-center justify-center shadow-lg text-stone-400 hover:text-red-500 hover:border-red-200 transition-all active:scale-90"
          >
            <X size={28} />
          </button>
          
          <button 
            onClick={() => handleSwipe('up')}
            className="w-14 h-14 bg-indigo-50 border-2 border-indigo-100 rounded-full flex items-center justify-center shadow-md text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all active:scale-95 group"
            title="View details and comments"
          >
            <MessageCircle size={24} className="group-hover:fill-current transition-colors" />
          </button>

          <button 
            onClick={() => handleSwipe('right')}
            className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center shadow-2xl text-white transform hover:scale-105 active:scale-95 transition-all"
          >
            <Heart size={36} fill="white" />
          </button>
        </div>
      )}

      {detailItem && (
        <ItemDetailsSheet 
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onViewProfile={(userId) => {
            setSelectedProfileId(userId);
            setDetailItem(null);
          }}
        />
      )}

      {bridgingItem && (
        <BridgeSheet 
          item={bridgingItem} 
          onClose={() => setBridgingItem(null)}
          onBridged={() => {
            setLocalSwipedIds(prev => new Set([...prev, bridgingItem.id]));
            setBridgingItem(null);
          }}
        />
      )}

      {selectedProfileId && (
        <PublicProfile userId={selectedProfileId} onClose={() => setSelectedProfileId(null)} />
      )}
    </div>
  );
}

interface SwipeCardProps {
  item: Item;
  onSwipe: (dir: 'right' | 'left' | 'up') => Promise<void> | void;
  onViewProfile?: (userId: string) => void;
  isLocalOnly: boolean;
}

export function SwipeCard({ item, onSwipe, onViewProfile, isLocalOnly }: SwipeCardProps) {
  const { profile } = useAuth();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);
  const bridgeOpacity = useTransform(y, [-150, -50], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) onSwipe('right');
    else if (info.offset.x < -100) onSwipe('left');
    else if (info.offset.y < -100) onSwipe('up');
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

  return (
    <motion.div
      style={{ x, y, rotate, opacity }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      className="relative mx-1 sm:mx-4 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-xl overflow-hidden cursor-grab active:cursor-grabbing border border-stone-100 flex flex-col"
    >
      <div className="flex flex-col">
        <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
          {item.images?.[0] ? (
            <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <img src={getFallbackImage(item.category)} alt={item.category || item.type} className="w-full h-full object-cover opacity-90" />
          )}
          
          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex gap-1.5 sm:gap-2">
            <span className={`px-2 sm:px-4 py-0.5 sm:py-1.5 rounded-full text-[8px] sm:text-xs font-bold uppercase tracking-widest shadow-sm ${
              item.type === 'SHARE' ? 'bg-green-500 text-white' : 
              item.type === 'ASK' ? 'bg-blue-500 text-white' : 
              item.type === 'MISSION' ? 'bg-indigo-600 text-white' : 
              item.type === 'JOIN' ? 'bg-teal-600 text-white' : 'bg-amber-600 text-white italic'
            }`}>
              {item.type}
            </span>
            {item.isFeatured && (
              <span className="px-2 sm:px-4 py-0.5 sm:py-1.5 rounded-full text-[8px] sm:text-xs font-bold uppercase tracking-widest bg-amber-400 text-white shadow-sm">
                Urgent
              </span>
            )}
          </div>

          <motion.div style={{ opacity: likeOpacity }} className="absolute top-1/2 left-12 -translate-y-1/2 border-4 border-green-500 rounded px-4 py-2 transform -rotate-12 z-20">
            <span className="text-4xl font-black text-green-500">YES</span>
          </motion.div>
          <motion.div style={{ opacity: nopeOpacity }} className="absolute top-1/2 right-12 -translate-y-1/2 border-4 border-red-500 rounded px-4 py-2 transform rotate-12 z-20">
            <span className="text-4xl font-black text-red-500">NOPE</span>
          </motion.div>
          <motion.div style={{ opacity: bridgeOpacity }} className="absolute top-12 left-1/2 -translate-x-1/2 border-4 border-indigo-500 rounded px-6 py-2 transform -rotate-3 z-20 bg-white/10 backdrop-blur-sm">
            <span className="text-4xl font-black text-indigo-500">DETAILS</span>
          </motion.div>
        </div>

        <div className="flex-none p-3 sm:p-8 space-y-2 sm:space-y-4 relative flex flex-col bg-white border-t border-stone-50">
          <div className="flex justify-between items-start gap-2">
            <h3 className="serif text-base sm:text-3xl font-bold text-stone-900 leading-tight line-clamp-2">
              {item.title}
            </h3>
            <div className="flex-shrink-0 flex flex-col items-end">
              {item.distance !== undefined && item.distance < 100 && (
                <span className="text-[7px] sm:text-xs font-bold text-stone-500 bg-stone-100 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-lg whitespace-nowrap flex items-center gap-1">
                  <MapPin size={8} />
                  {item.distance < 1 ? '< 1 km' : `${item.distance.toFixed(1)} km`}
                </span>
              )}
              {onViewProfile && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewProfile(item.ownerId);
                  }}
                  className="mt-1 flex items-center gap-1.5 text-[7px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors group/name"
                >
                  <Users size={10} className="group-hover/name:scale-110 transition-transform" />
                  <span className="group-hover/name:underline decoration-2 underline-offset-4">
                    <OwnerName 
                      ownerId={item.ownerId} 
                      initialName={item.ownerName} 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile?.(item.ownerId);
                      }}
                    />
                  </span>
                </button>
              )}
              <ConnectionBadge targetUserId={item.ownerId} className="mt-1" />
            </div>
          </div>
          
          <div className="relative group/desc">
            <p className="text-stone-600 text-[9px] sm:text-base line-clamp-2 sm:line-clamp-3 italic leading-relaxed">
              "{showOriginal ? item.description : translatedDescription}"
            </p>
            <button 
              onClick={handleTranslate}
              className="absolute -right-2 -top-1 opacity-0 group-hover/desc:opacity-100 transition-opacity p-1 bg-white/80 rounded-full shadow-sm text-stone-400 hover:text-[--color-brand]"
              title={`Translate to ${targetLanguage}`}
            >
              {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
            </button>
            {!showOriginal && translatedDescription && (
              <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                <Languages size={10} /> Translated to {targetLanguage} · <button onClick={() => setShowOriginal(true)} className="hover:underline text-[--color-brand] font-bold">Original</button>
              </div>
            )}
          </div>

          <div className="pt-2 sm:pt-4 border-t border-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-stone-400 text-[9px] font-black uppercase tracking-widest">
             <div className="flex items-center gap-1.5">
               {item.circleId ? <Users size={12} className="text-[--color-brand]" /> : <Globe size={12} className="text-[--color-brand]" />}
               <span>{item.circleId ? 'Specific Circle' : (isLocalOnly ? 'Local Vicinity' : 'Global Community')}</span>
             </div>
             {item.createdAt && (
               <div className="flex items-center gap-1.5">
                 <Clock size={12} />
                 <span>{formatDistanceToNow(item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt), { addSuffix: true })}</span>
               </div>
             )}
          </div>
          {(item.expiresAt || item.eventTime) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[9px] font-black uppercase tracking-widest mt-2 pt-2 border-t border-stone-50">
              {item.expiresAt && (
                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                  <Clock size={12} />
                  <span>Expires {new Date(item.expiresAt.toDate ? item.expiresAt.toDate() : item.expiresAt).toLocaleDateString()}</span>
                </div>
              )}
              {item.eventTime && (
                <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit">
                  <Clock size={12} />
                  <span>{new Date(item.eventTime.toDate ? item.eventTime.toDate() : item.eventTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function BridgeSheet({ item, onClose, onBridged }: { item: Item; onClose: () => void; onBridged: () => void }) {
  const { user, profile } = useAuth();
  const [circles, setCircles] = useState<any[]>([]);
  const [connections, setConnections] = useState<{chatId: string, userId: string, name: string, photoURL?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [bridgingId, setBridgingId] = useState<string | null>(null);

  interface BridgeTarget {
    type: 'CONNECTION' | 'CIRCLE';
    targetId: string;
    targetName: string;
    friendId?: string;
  }
  const [bridgeTarget, setBridgeTarget] = useState<BridgeTarget | null>(null);
  const [bridgeMessage, setBridgeMessage] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    
    // Load circles using the joinedCircles array in profile
    let unsubCircles = () => {};
    if (profile?.joinedCircles && profile.joinedCircles.length > 0) {
      const fetchJoinedCircles = async () => {
        const fetchedCircles: any[] = [];
        for (const cid of (profile.joinedCircles || []).slice(0, 30)) {
          try {
            const circleSnap = await getDoc(doc(db, 'circles', cid));
            if (circleSnap.exists()) {
              fetchedCircles.push({ id: circleSnap.id, ...circleSnap.data() });
            }
          } catch (err) {
            console.error(`Error fetching joined circle ${cid}:`, err);
          }
        }
        setCircles(fetchedCircles);
      };
      
      fetchJoinedCircles();
    } else {
      setCircles([]);
    }

    // Load recent connections (chats)
    const qChats = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    const unsubChats = onSnapshot(qChats, async (snapshot) => {
      const connPromises = snapshot.docs.map(async (docSnap) => {
        const chatData = docSnap.data();
        const otherUserId = chatData.participants.find((id: string) => id !== user.uid);
        if (!otherUserId) return null;
        
        try {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            return {
              chatId: docSnap.id,
              userId: otherUserId,
              name: userDoc.data().displayName || 'Neighbor',
              photoURL: userDoc.data().photoURL
            };
          }
        } catch (e) {
          console.error('Error fetching user for connection', e);
        }
        return null;
      });
      
      const resolvedConns = (await Promise.all(connPromises)).filter(Boolean) as typeof connections;
      setConnections(resolvedConns);
      setLoading(false);
    });

    return () => {
      unsubCircles();
      unsubChats();
    };
  }, [user, profile?.joinedCircles]);

  const handleBridgeToCircle = (circleId: string, circleName: string) => {
    setBridgeTarget({
      type: 'CIRCLE',
      targetId: circleId,
      targetName: circleName
    });
    setBridgeMessage(`I'm bridging this ${item.type.toLowerCase()} to the circle!`);
  };

  const handleBridgeToConnection = (chatId: string, friendId: string, friendName: string) => {
    setBridgeTarget({
      type: 'CONNECTION',
      targetId: chatId,
      targetName: friendName,
      friendId: friendId
    });
    setBridgeMessage(`Thought this might be relevant to you: ${item.title}`);
  };

  const executeBridge = async () => {
    if (!user || !bridgeTarget) return;
    setBridgingId(bridgeTarget.targetId);
    
    try {
      if (bridgeTarget.type === 'CIRCLE') {
        const chatId = `${bridgeTarget.targetId}_general`; // Default to general channel
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          chatId: chatId,
          senderId: user.uid,
          senderName: user.displayName || 'Neighbor',
          text: bridgeMessage,
          type: 'TEXT',
          attachment: {
            type: 'ITEM_BRIDGE',
            itemId: item.id,
            title: item.title,
            image: item.images?.[0] || null
          },
          createdAt: serverTimestamp(),
          chatType: 'CHANNEL',
          circleId: bridgeTarget.targetId,
          participants: []
        });

        await addDoc(collection(db, 'notifications'), {
          userId: item.ownerId,
          type: 'ITEM_BRIDGED',
          content: `Your ${item.type.toLowerCase()} was bridged to circle "${bridgeTarget.targetName}"!`,
          isRead: false,
          link: `/circles/${bridgeTarget.targetId}`,
          createdAt: serverTimestamp()
        });
      } else {
        const chatId = bridgeTarget.targetId;
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          chatId: chatId,
          senderId: user.uid,
          text: bridgeMessage,
          type: 'TEXT',
          attachment: {
            type: 'ITEM_BRIDGE',
            itemId: item.id,
            title: item.title,
            image: item.images?.[0] || null
          },
          createdAt: serverTimestamp(),
          chatType: 'DIRECT',
          participants: [user.uid, bridgeTarget.targetId]
        });
        
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: `Bridged an item: ${item.title}`,
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'notifications'), {
          userId: item.ownerId,
          type: 'ITEM_BRIDGED',
          content: `Your ${item.type.toLowerCase()} was bridged to ${bridgeTarget.targetName}!`,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }

      onBridged();
      setBridgeTarget(null);
    } catch (err) {
      console.error(`Failed to bridge to ${bridgeTarget.type.toLowerCase()}:`, err);
      alert('Failed to send bridge: ' + (err as Error).message);
    } finally {
      setBridgingId(null);
    }
  };

  const handleExternalShare = async () => {
    const shareData = {
      title: item.title,
      text: `Check out this ${item.type.toLowerCase()} on KULA: ${item.title}\n\n"${item.description}"`,
      url: window.location.origin + `/discovery?item=${item.id}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Copy failed', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-4 sm:pb-20">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-6 sm:p-8 border-b border-stone-100 flex items-center justify-between flex-none">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="serif text-xl sm:text-2xl font-bold text-stone-900 leading-none">Bridge It</h3>
              <p className="text-stone-400 text-[10px] sm:text-xs mt-1 font-medium uppercase tracking-widest">Connect neighbors & needs</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400">Bridging</span>
            <div className="flex items-center gap-3 mt-2">
              {item.images?.[0] ? (
                <img src={item.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-10 h-10 bg-stone-200 rounded-lg flex items-center justify-center">
                  <Tag size={16} className="text-stone-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-900 truncate text-sm sm:text-base">{item.title}</p>
                <p className="text-[9px] sm:text-[10px] text-stone-500">By {item.ownerName || 'Neighbor'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 size={24} className="animate-spin text-stone-300" />
              </div>
            ) : (
              <>
                {/* External Share Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-900">External Share</h4>
                  </div>
                  <button
                    onClick={handleExternalShare}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Share2 size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-indigo-900 text-sm">Share outside KULA</p>
                      <p className="text-[9px] sm:text-[10px] text-indigo-400 font-medium">Text a friend, WhatsApp, or Link</p>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-indigo-100 flex items-center justify-center text-indigo-300">
                      <Copy size={14} />
                    </div>
                  </button>
                </div>

                {/* Connections Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-900">Forward to Connection</h4>
                  </div>
                  
                  {connections.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-4 flex-nowrap snap-x snap-mandatory min-h-[120px] no-scrollbar">
                      {connections.map(conn => (
                        <button
                          key={conn.chatId}
                          disabled={!!bridgingId}
                          onClick={() => handleBridgeToConnection(conn.chatId, conn.userId, conn.name)}
                          className="flex flex-col items-center gap-2 p-3 min-w-[90px] rounded-2xl border border-stone-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group shrink-0 snap-start"
                        >
                          <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 overflow-hidden relative">
                            {conn.photoURL ? (
                              <img src={conn.photoURL} alt={conn.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold text-sm">
                                {conn.name.charAt(0)}
                              </div>
                            )}
                            {bridgingId === conn.chatId ? (
                              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin text-indigo-500" />
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center">
                                <Send size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-stone-600 truncate w-full text-center">{conn.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-stone-50 rounded-2xl border border-stone-100">
                      <p className="text-xs text-stone-500 italic">No active connections yet. Start swiping to meet neighbors!</p>
                    </div>
                  )}
                </div>

                {/* Circles Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-900">Forward to Circle</h4>
                  </div>
                  
                  {circles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {circles.map(circle => (
                        <button
                          key={circle.id}
                          disabled={!!bridgingId}
                          onClick={() => handleBridgeToCircle(circle.id, circle.name)}
                          className="flex items-center gap-4 p-3 sm:p-4 rounded-2xl border border-stone-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group"
                        >
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            <Users size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-stone-900 text-sm">{circle.name}</p>
                            <p className="text-[9px] sm:text-[10px] text-stone-400 font-medium mt-0.5">{circle.memberCount || 0} Members</p>
                          </div>
                          {bridgingId === circle.id ? (
                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                          ) : (
                            <Send size={16} className="text-stone-300 group-hover:text-indigo-500 transition-colors" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <p className="text-xs text-stone-500 italic">You aren't in any circles yet. Join one to bridge needs!</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-100 mt-auto">
          <p className="text-[9px] sm:text-[10px] text-stone-400 text-center font-medium leading-relaxed italic">
            "Bridging connects the right people to the right help."
          </p>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {bridgeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] overflow-hidden w-full max-w-md shadow-2xl relative"
            >
              <button onClick={() => setBridgeTarget(null)} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors z-10">
                 <X size={16} />
              </button>
              
              <div className="p-6 pb-2 mt-2">
                 <h3 className="text-xl font-bold font-display text-stone-900 mb-1">Send to {bridgeTarget.targetName}</h3>
                 <p className="text-sm text-stone-500">Add a personal message before sharing this {item.type.toLowerCase()}</p>
              </div>
              
              <div className="p-6 space-y-4">
                 <div className="flex gap-3 p-3 bg-stone-50 border border-stone-100 rounded-2xl items-center">
                   {item.images?.[0] ? (
                     <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                       <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                     </div>
                   ) : (
                     <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center shrink-0">
                       <Tag size={16} className="text-stone-400" />
                     </div>
                   )}
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-stone-900 truncate text-sm">{item.title}</p>
                     <p className="text-[10px] text-stone-500 truncate">{item.description}</p>
                   </div>
                 </div>

                 <textarea
                   value={bridgeMessage}
                   onChange={(e) => setBridgeMessage(e.target.value)}
                   className="w-full rounded-2xl border border-stone-200 p-4 min-h-[100px] text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                   placeholder="Add a message..."
                 />
              </div>

              <div className="p-6 pt-0 flex gap-3">
                 <button onClick={() => setBridgeTarget(null)} className="flex-1 py-3 px-4 bg-stone-100 text-stone-700 font-bold rounded-2xl hover:bg-stone-200 transition-colors">Cancel</button>
                 <button 
                   onClick={executeBridge}
                   disabled={!!bridgingId}
                   className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {bridgingId ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                   Confirm Send
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
