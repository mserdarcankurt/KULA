import React, { useState, useEffect } from 'react';
import { useItems } from '../hooks/useItems';
import { db } from '../lib/firebase';
import { query, collection, getDocs, updateDoc, doc, arrayUnion, arrayRemove, setDoc, serverTimestamp, getDoc, addDoc, where } from 'firebase/firestore';
import { Search, MapPin, Tag, Users, Globe, Shield, Target, HeartHandshake, Plus, MessageSquare, Clock, Languages, Loader2, Calendar } from 'lucide-react';
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

interface FeedProps {
  location: { lat: number; lng: number } | null;
  circleId?: string;
  onNavigateToChat?: (chatId: string) => void;
}

export default function Feed({ location, circleId, onNavigateToChat }: FeedProps) {
  const { profile } = useAuth();
  const { items, loading } = useItems(location, profile, circleId);
  const [filter, setFilter] = useState<'ALL' | 'ASK' | 'SHARE' | 'JOIN' | 'IMECE' | 'MISSION'>('ALL');
  const [scope, setScope] = useState<'ALL' | 'LOCAL' | 'CIRCLES' | 'ORGS'>('ALL');
  const [isLocalOnly, setIsLocalOnly] = useState(true);
  const [localRadius, setLocalRadius] = useState(10);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [search, setSearch] = useState('');
  const [circles, setCircles] = useState<Record<string, Circle>>({});

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

  const featuredItems = items.filter(item => {
    if (item.status !== 'ACTIVE' || !item.isFeatured) return false;
    if (isLocalOnly && item.distance !== undefined && item.distance > localRadius) return false;
    return true;
  });
  const filteredItems = items.filter(item => {
    // Local/Global Filter
    if (isLocalOnly && item.distance !== undefined && item.distance > localRadius) return false;

    // Type Filter
    const matchesFilter = filter === 'ALL' || item.type === filter;
    
    // Search Filter
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.description.toLowerCase().includes(search.toLowerCase());
    
    // Scope Filter
    let matchesScope = true;
    if (scope === 'LOCAL') {
      matchesScope = item.reachTypes?.includes('VICINITY');
    } else if (scope === 'CIRCLES') {
      matchesScope = !!item.circleId || item.reachTypes?.includes('ALL_CIRCLES') || item.reachTypes?.includes('SPECIFIC_CIRCLES');
    } else if (scope === 'ORGS') {
      matchesScope = !!item.ownerIsOrganization;
    }

    return matchesFilter && matchesSearch && matchesScope;
  });

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar relative h-full w-full pt-4">
      {!circleId && (
        <div className="px-6 space-y-4 mb-6">
          <div className="flex flex-col gap-3">
            <h2 className="serif text-2xl sm:text-3xl font-bold text-[--color-brand]">Neighborhood Feed</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2">
                <div className="flex-shrink-0 flex bg-stone-100 p-0.5 rounded-xl border border-stone-200">
                  <button 
                    onClick={() => setIsLocalOnly(true)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isLocalOnly ? 'bg-white shadow-md text-stone-900' : 'text-stone-400'}`}
                  >
                    Local
                  </button>
                  <button 
                    onClick={() => setIsLocalOnly(false)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${!isLocalOnly ? 'bg-white shadow-md text-stone-900' : 'text-stone-400'}`}
                  >
                    Global
                  </button>
                </div>
                
                {isLocalOnly && (
                  <div className="flex-shrink-0 flex items-center gap-3 bg-stone-50 px-4 py-1.5 rounded-xl border border-stone-100 shadow-inner">
                    <div className="flex flex-col min-w-[40px]">
                      <span className="text-[7px] font-black uppercase tracking-widest text-stone-400">Radius</span>
                      <span className="text-[9px] font-black text-stone-900">{localRadius}km</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={localRadius} 
                      onChange={(e) => setLocalRadius(Number(e.target.value))}
                      className="w-20 accent-stone-900 h-1 rounded-lg appearance-none cursor-pointer bg-stone-200"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div id="tour-feed-search" className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Search items..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-stone-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[--color-brand] transition-all"
            />
          </div>

          <div className="flex gap-2 bg-stone-100 p-1 rounded-2xl">
            {(['ALL', 'LOCAL', 'CIRCLES', 'ORGS'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  scope === s 
                    ? 'bg-white text-stone-900 shadow-sm' 
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'LOCAL' ? 'Nearby' : s === 'CIRCLES' ? 'Circles' : 'Orgs'}
              </button>
            ))}
          </div>

          {featuredItems.length > 0 && search === '' && filter === 'ALL' && (
            <div className="space-y-3 pb-2 transition-all animate-in fade-in slide-in-from-top-2 duration-700">
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
                        <div className="flex items-center gap-2">
                          <MapPin size={12} />
                          <span>{item.distance?.toFixed(1)} km away</span>
                        </div>
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

          <div id="tour-feed-filters" className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {(['ALL', 'SHARE', 'ASK', 'JOIN', 'IMECE', 'MISSION'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === t 
                    ? 'bg-stone-900 text-white shadow-md' 
                    : 'bg-white border-2 border-stone-200 text-stone-500 hover:border-stone-300 transition-colors'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'SHARE' ? 'Gives' : t === 'ASK' ? 'Asks' : t === 'JOIN' ? 'Joins' : t === 'IMECE' ? 'İmece' : 'Missions'}
              </button>
            ))}
          </div>
        </div>
      )}

      {circleId && (
        <div className="px-6 mb-6 mt-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {(['ALL', 'SHARE', 'ASK', 'JOIN', 'IMECE', 'MISSION'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === t 
                    ? 'bg-stone-900 text-white shadow-md' 
                    : 'bg-white border-2 border-stone-200 text-stone-500 hover:border-stone-300 transition-colors'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'SHARE' ? 'Gives' : t === 'ASK' ? 'Asks' : t === 'JOIN' ? 'Joins' : t === 'IMECE' ? 'İmece' : 'Missions'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 space-y-6 pb-20">
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
                onClick={() => setDetailItem(item)}
              />
            </div>
          ))
        ) : (
          <div className="text-center py-20 space-y-4">
            <p className="text-stone-400 italic font-serif">No items found matching your filters.</p>
            <button 
              onClick={() => {
                setFilter('ALL');
                setScope('ALL');
                setSearch('');
              }}
              className="text-[--color-brand] font-black uppercase tracking-[0.2em] text-[10px] hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {selectedProfileId && (
        <PublicProfile userId={selectedProfileId} onClose={() => setSelectedProfileId(null)} />
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
    </div>
  );
}

export interface ItemCardProps {
  item: Item;
  circle?: Circle;
  onNavigateToChat?: (chatId: string) => void;
  onViewProfile?: (userId: string) => void;
  onClick?: () => void;
}

export function ItemCard({ item, circle, onNavigateToChat, onViewProfile, onClick }: ItemCardProps) {
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
      className={`bg-white border rounded-3xl p-4 shadow-sm hover:shadow-md transition-all group overflow-hidden relative cursor-pointer ${
        item.type === 'IMECE' ? 'border-amber-100 bg-amber-50/20' : 
        item.type === 'MISSION' ? 'border-indigo-100 bg-indigo-50/20' : 
        item.type === 'JOIN' ? 'border-teal-100 bg-teal-50/20' : 'border-stone-100'
      }`}
    >
      <div className="flex gap-4">
        <div className="w-24 h-24 bg-stone-50 rounded-2xl flex-shrink-0 relative overflow-hidden">
          {item.images?.[0] ? (
            <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <img src={getFallbackImage(item.category)} alt={item.category || item.type} className="w-full h-full object-cover opacity-80" />
          )}
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase ${
            item.type === 'SHARE' ? 'bg-green-500 text-white' : 
            item.type === 'ASK' ? 'bg-blue-500 text-white' : 
            item.type === 'MISSION' ? 'bg-indigo-600 text-white' : 
            item.type === 'JOIN' ? 'bg-teal-600 text-white' : 'bg-amber-600 text-white italic'
          }`}>
            {item.type === 'IMECE' ? 'İMECE' : item.type}
          </div>
        </div>

        <div className="flex-1 pt-1">
          <div className="flex justify-between items-start gap-3">
            <h4 className={`serif font-bold text-lg leading-tight transition-colors line-clamp-2 flex-1 ${
              item.type === 'IMECE' ? 'text-amber-900 group-hover:text-amber-700' : 
              item.type === 'MISSION' ? 'text-indigo-900 group-hover:text-indigo-700' : 
              item.type === 'JOIN' ? 'text-teal-900 group-hover:text-teal-700' : 
              'text-stone-900 group-hover:text-[--color-brand]'
            }`}>
              <div className="flex items-center gap-2">
                {item.title}
                {(item as any).ownerIsOrganization && (
                  <Shield size={14} className="text-indigo-500 fill-indigo-50" />
                )}
              </div>
            </h4>
            {item.isFeatured && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
          </div>
          
          <div className="mt-1 flex items-center justify-between min-h-[20px]">
            {circle ? (
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#d4af37] bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                <Users size={10} />
                <span>{circle.name} Circle</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(item.reachTypes) ? item.reachTypes : [item.reachTypes || 'VICINITY']).map(rt => (
                  <div key={rt} className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit ${
                    item.type === 'IMECE' ? 'text-amber-500 bg-amber-100/50' : 
                    item.type === 'JOIN' ? 'text-teal-500 bg-teal-100/50' :
                    'text-stone-400 bg-stone-50'
                  }`}>
                    {rt === 'VICINITY' && <Globe size={10} />}
                    {rt === 'ALL_CIRCLES' && <Shield size={10} />}
                    {rt === 'SPECIFIC_CIRCLES' && <Target size={10} />}
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
               <div className="text-[9px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1">
                 <Shield size={10} />
                 <span>Verified Org</span>
               </div>
            )}
          </div>

          {item.type === 'IMECE' && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">Collective Progress</span>
                <span className="text-[10px] font-bold text-amber-900">{participantCount}/{targetParticipants} hands</span>
              </div>
              <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="relative group/desc">
            <p className="text-xs text-stone-600 line-clamp-2 italic mb-3 mt-1.5 leading-relaxed">
              "{showOriginal ? item.description : translatedDescription}"
            </p>
            <button 
              onClick={handleTranslate}
              className="absolute -right-2 -top-1 opacity-0 group-hover/desc:opacity-100 transition-opacity p-1 bg-white/80 rounded-full shadow-sm text-stone-400 hover:text-[--color-brand]"
              title={`Translate to ${targetLanguage}`}
            >
              {isTranslating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
            </button>
            {!showOriginal && translatedDescription && (
              <div className="text-[9px] text-stone-400 -mt-2 mb-2 flex items-center gap-1">
                <Languages size={10} /> Translated to {targetLanguage} · <button onClick={(e) => { e.stopPropagation(); setShowOriginal(true); }} className="hover:underline">Original</button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-auto gap-2 sm:gap-0">
            <div className="flex flex-col gap-1">
              {item.distance !== undefined && item.distance < 100 && (
                <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                  <MapPin size={11} className={item.type === 'IMECE' ? "text-amber-500" : item.type === 'JOIN' ? "text-teal-500" : "text-[--color-brand]"} />
                  <span>{item.distance.toFixed(1)} km away</span>
                </div>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile?.(item.ownerId);
                }}
                className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider hover:text-[--color-brand] transition-colors group/name"
              >
                <Users size={11} className="group-hover/name:scale-110 transition-transform" />
                <span className="group-hover/name:underline decoration-2 underline-offset-2">
                  <OwnerName ownerId={item.ownerId} initialName={item.ownerName} />
                </span>
              </button>
              <ConnectionBadge targetUserId={item.ownerId} className="mt-0.5" />
              {item.createdAt && (
                <div className="flex items-center gap-1.5 text-stone-400 text-[11px] font-bold uppercase tracking-tighter bg-stone-50 px-2 py-0.5 rounded-full w-fit sm:bg-transparent sm:p-0">
                  <Clock size={11} />
                  <span>{formatDistanceToNow(item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt), { addSuffix: true })}</span>
                </div>
              )}
              {item.expiresAt && (
                <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-bold tracking-tighter bg-amber-50 px-2 py-0.5 rounded-full w-fit sm:bg-transparent sm:p-0 mt-1">
                  <Calendar size={11} />
                  <span>Until {new Date(item.expiresAt.toDate ? item.expiresAt.toDate() : item.expiresAt).toLocaleDateString()}</span>
                </div>
              )}
              {item.eventTime && (
                <div className="flex items-center gap-1.5 text-indigo-600 text-[11px] font-bold tracking-tighter bg-indigo-50 px-2 py-0.5 rounded-full w-fit sm:bg-transparent sm:p-0 mt-1">
                  <Calendar size={11} />
                  <span>{new Date(item.eventTime.toDate ? item.eventTime.toDate() : item.eventTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
            
            {item.type === 'IMECE' ? (
              <button 
                onClick={handleJoinImece}
                disabled={isJoining}
                className={`px-4 py-1.5 rounded-full text-[10px] uppercase font-black tracking-widest transition-all ${
                  isUserParticipating 
                    ? 'bg-amber-100 text-amber-700 border-2 border-amber-200' 
                    : 'bg-amber-600 text-white shadow-md hover:bg-amber-700'
                }`}
              >
                {isJoining ? 'Wait...' : isUserParticipating ? 'I\'m in!' : 'Join İmece'}
              </button>
            ) : item.type === 'JOIN' ? (
              <button 
                onClick={handleInterest}
                disabled={isJoining}
                className="px-4 py-1.5 bg-teal-600 shadow-md text-white rounded-full text-[10px] uppercase font-black tracking-widest hover:bg-teal-700 transition-all flex items-center gap-1.5"
              >
                {isJoining ? 'Wait...' : (
                  <>
                    <Users size={12} />
                    <span>Join & RSVP</span>
                  </>
                )}
              </button>
            ) : item.ownerIsOrganization ? (
              <button 
                onClick={handleInterest}
                disabled={isJoining}
                className="px-4 py-1.5 bg-indigo-600 shadow-md text-white rounded-full text-[10px] uppercase font-black tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-1.5"
              >
                {isJoining ? 'Wait...' : (
                  <>
                    <MessageSquare size={12} />
                    <span>Contact Org</span>
                  </>
                )}
              </button>
            ) : (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile?.(item.ownerId);
                }}
                className="text-[10px] uppercase font-bold text-[--color-brand] hover:underline transition-all"
              >
                View Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
