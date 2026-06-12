/**
 * FILE: Explore.tsx
 * ROLE IN KULA: The "Home Hub" — the main tab that users spend most time on.
 * 
 * Redesigned for Berlin Analog aesthetic:
 *   - Tactile Segment Controller tabs (Board vs. Flow switcher)
 *   - Flow Composer for text status updates and 35mm base64 photo sharing
 *   - Buzz Feed displaying live neighborhood comment activity with index safety fallbacks
 *   - Dynamic Feed Scope & Circle filtering
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Feed from './Feed';
import { useItems } from '../hooks/useItems';
import { useAuth } from '../hooks/useAuth';
import { ChevronDown, Sliders, MessageCircle, Heart, Camera, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ART_DIRECTION } from '../lib/artDirection';
import { db, storage } from '../lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, query, orderBy, limit, collectionGroup, onSnapshot, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Circle, Item } from '../types';
import { ItemDetailsSheet } from './ItemDetailsSheet';
import PublicProfile from './PublicProfile';
import { OwnerAvatar } from './OwnerAvatar';
import { OwnerName } from './OwnerName';
import { formatDistanceToNow } from 'date-fns';
import { logEvent } from '../lib/analytics';

// Helper to compress images client-side. The base64 result is used for the
// instant local preview; on submit it's converted to a Blob and uploaded to
// Cloud Storage (only the download URL is stored in Firestore).
const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

/* ── Trust Reach Picker Constants ── */
const TRUST_LEVELS = [
  { value: 1, label: 'Direct trust', short: '1st Degree', desc: 'Only your direct connections' },
  { value: 2, label: 'Friends of friends', short: '2nd Degree', desc: '2 handshakes away' },
  { value: 3, label: 'Extended network', short: '3rd Degree', desc: '3 handshakes away' },
  { value: 4, label: 'Community reach', short: '4th Degree', desc: '4 handshakes away' },
  { value: 5, label: 'Wide neighborhood', short: '5th Degree', desc: '5 handshakes away' },
  { value: 6, label: 'Whole world', short: 'All', desc: 'No connection filter' },
];

/* ── Filter Popover Component ── */
function FilterPopover({
  selectedFilterScope,
  setSelectedFilterScope,
  joinedCirclesList,
  typeFilter,
  setTypeFilter,
  categoryFilter,
  setCategoryFilter,
  onReset
}: {
  selectedFilterScope: string;
  setSelectedFilterScope: (v: string) => void;
  joinedCirclesList: Circle[];
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-[#FDFBF4] rounded-2xl border border-[#D9D0C0] shadow-xl w-72 p-4 space-y-4 text-left">
      {/* Header */}
      <div className="border-b border-[#E8E0D0] pb-2 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9B8E78]">
          Feed Filters
        </span>
        {(selectedFilterScope !== 'trust_6' || typeFilter !== 'ALL' || categoryFilter !== 'ALL') && (
          <button
            onClick={onReset}
            className="text-[9px] font-black uppercase tracking-wider text-[#C86A51] hover:underline"
          >
            Reset All
          </button>
        )}
      </div>

      {/* 1. Feed Scope */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-brand block">
          Feed Scope
        </label>
        <select
          value={selectedFilterScope}
          onChange={(e) => setSelectedFilterScope(e.target.value)}
          className="w-full text-[11px] font-bold bg-[#F6F4EE] border border-[#D9D0C0] rounded-xl px-3 py-2 text-stone-700 focus:outline-none focus:border-brand cursor-pointer"
        >
          <optgroup label="Connection Levels">
            <option value="trust_6">Whole World (All)</option>
            {TRUST_LEVELS.filter(l => l.value < 6).map(level => (
              <option key={level.value} value={`trust_${level.value}`}>
                {`${level.short} (${level.label})`}
              </option>
            ))}
          </optgroup>
          {joinedCirclesList.length > 0 && (
            <optgroup label="Your Circles">
              {joinedCirclesList.map(circle => (
                <option key={circle.id} value={`circle_${circle.id}`}>
                  {circle.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* 2. Post Type */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-brand block">
          Post Type
        </label>
        <div className="grid grid-cols-4 gap-1">
          {['ALL', 'ASK', 'SHARE', 'JOIN'].map((t) => {
            const isActive = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all border ${
                  isActive
                    ? 'bg-brand text-white border-brand shadow-sm'
                    : 'bg-[#F6F4EE] text-stone-600 border-[#D9D0C0] hover:bg-[#EADFC9]'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'ASK' ? 'Ask' : t === 'SHARE' ? 'Share' : 'Join'}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Category */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-brand block">
          Category
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full text-[11px] font-bold bg-[#F6F4EE] border border-[#D9D0C0] rounded-xl px-3 py-2 text-stone-700 focus:outline-none focus:border-brand cursor-pointer"
        >
          <option value="ALL">All Categories</option>
          {Object.keys(ART_DIRECTION.fallbacks)
            .filter(cat => cat !== 'CircleInvite' && cat !== 'Default')
            .map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

/* ── FlowPostCard Helper Component ── */
interface FlowPostCardProps {
  item: Item & { likes?: string[] };
  onLike: () => void;
  onComment: () => void;
  onViewProfile: (uid: string) => void;
  currentUserId?: string;
}

function FlowPostCard({ item, onLike, onComment, onViewProfile, currentUserId }: FlowPostCardProps) {
  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Just now';
    }
  };

  const isLiked = item.likes?.includes(currentUserId || '') || false;

  return (
    <div className="bg-[#FDFBF9] border border-stone-200/80 rounded-[2rem] p-5 shadow-sm flex flex-col gap-3.5 transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OwnerAvatar 
            ownerId={item.ownerId} 
            initialPhotoURL={item.ownerPhoto} 
            initialName={item.ownerName}
            className="w-10 h-10 cursor-pointer"
            onClick={() => onViewProfile(item.ownerId)}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <OwnerName 
                ownerId={item.ownerId} 
                initialName={item.ownerName} 
                className="text-stone-900 font-bold text-sm"
                onClick={() => onViewProfile(item.ownerId)}
              />
              {item.degrees !== undefined && item.degrees > 0 && (
                <span className="text-[9px] text-brand font-bold bg-brand/5 px-2 py-0.5 rounded-full border border-brand/15">
                  {item.degrees === 1 ? '1st' : item.degrees === 2 ? '2nd' : item.degrees === 3 ? '3rd' : `${item.degrees}th`} degree
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-stone-500 font-medium">
              <span>{formatTime(item.createdAt)}</span>
              {item.distance !== undefined && (
                <>
                  <span>•</span>
                  <span>{item.distance < 1 ? 'Under 1 km' : `${Math.round(item.distance)} km`} away</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-stone-700 text-sm whitespace-pre-wrap leading-relaxed">
        {item.description}
      </p>

      {/* Image */}
      {item.images && item.images.length > 0 && (
        <div className="relative rounded-[1.5rem] overflow-hidden border border-stone-250/50 shadow-sm max-h-72">
          <img 
            src={item.images[0]} 
            alt="Flow update" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 border-[6px] border-stone-900/5 pointer-events-none rounded-[1.5rem]" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-dotted border-stone-200">
        <button 
          onClick={onLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            isLiked
              ? 'bg-[#C86A51]/10 text-[#C86A51]'
              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
          }`}
        >
          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{item.likes?.length || 0}</span>
        </button>

        <button 
          onClick={onComment}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-brand hover:bg-brand/5 transition-all"
        >
          <MessageCircle size={14} />
          <span>Discuss</span>
        </button>
      </div>
    </div>
  );
}

/* ── BuzzCommentCard Helper Component ── */
interface BuzzCommentCardProps {
  comment: {
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: any;
    itemId: string;
    itemTitle: string;
    itemOwnerName: string;
    itemOwnerPhoto: string;
    itemOwnerId: string;
    itemType: string;
  };
  onViewItem: (itemId: string) => void;
  onViewProfile: (uid: string) => void;
}

function BuzzCommentCard({ comment, onViewItem, onViewProfile }: BuzzCommentCardProps) {
  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Just now';
    }
  };

  const parentTypeLabel = comment.itemType === 'FLOW' ? 'update' : comment.itemType?.toLowerCase() || 'post';

  return (
    <div 
      onClick={() => onViewItem(comment.itemId)}
      className="bg-[#FAF8F2] border border-[#E8E0D0]/80 rounded-[2rem] p-5 shadow-sm hover:shadow-md hover:border-[#D9D0C0] transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden"
    >
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#9B8E78] bg-[#F3F1EB] px-2.5 py-1 rounded-full border border-[#D9D0C0]/50">
          💬 Discussion Buzz
        </span>
        <span className="text-[10px] text-stone-500 font-medium">
          {formatTime(comment.createdAt)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <OwnerAvatar 
          ownerId={comment.userId} 
          initialName={comment.userName}
          className="w-7 h-7"
          onClick={() => onViewProfile(comment.userId)}
        />
        <div className="flex flex-col">
          <span 
            className="text-xs font-bold text-stone-850 leading-tight hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile(comment.userId);
            }}
          >
            {comment.userName ? comment.userName.split(' ')[0] : 'A neighbor'}
          </span>
          <span className="text-[9px] text-stone-500 font-medium">
            commented on {comment.itemOwnerName ? `${comment.itemOwnerName.split(' ')[0]}'s` : 'a'} {parentTypeLabel}
          </span>
        </div>
      </div>

      <div className="bg-white/60 border border-stone-200/50 rounded-2xl p-3 text-xs italic text-stone-750 leading-relaxed">
        "{comment.text}"
      </div>

      <div className="flex items-center justify-between text-[10px] text-brand font-bold mt-1 gap-2">
        <span className="truncate max-w-[65%]">
          → {comment.itemTitle}
        </span>
        <span className="text-[9px] font-black uppercase tracking-wider text-[#C86A51] shrink-0">
          Join the Discussion →
        </span>
      </div>
    </div>
  );
}

/* ── Main Explore Screen Component ── */
export default function Explore({ 
  location, 
  onNavigateToChat,
  onNavigateToCircle,
  onNavigateToTab
}: { 
  location: { lat: number; lng: number } | null;
  onNavigateToChat?: (chatId: string) => void;
  onNavigateToCircle?: (circleId: string) => void;
  onNavigateToTab?: (tab: string) => void;
}) {
  const { user, profile } = useAuth();
  const [feedMode, setFeedMode] = useState<'BOARD' | 'FLOW'>('BOARD');
  const [flowFilter, setFlowFilter] = useState<'ALL' | 'UPDATES' | 'BUZZ'>('ALL');
  
  // Filters State
  const [selectedFilterScope, setSelectedFilterScope] = useState<string>('trust_6');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [joinedCirclesList, setJoinedCirclesList] = useState<Circle[]>([]);

  // Composer State
  const [composerContent, setComposerContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Buzz Comments State
  const [buzzComments, setBuzzComments] = useState<any[]>([]);
  const [loadingBuzz, setLoadingBuzz] = useState(false);

  // Detail sheets and profiles
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const { items: allItems, loading: loadingItems, loadMore, hasMore } = useItems(location, profile);

  useEffect(() => {
    if (profile?.joinedCircles && profile.joinedCircles.length > 0) {
      const fetchJoinedCircles = async () => {
        try {
          const promises = profile.joinedCircles.map(async (cid) => {
            const docRef = doc(db, 'circles', cid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              return { id: docSnap.id, ...docSnap.data() } as Circle;
            }
            return null;
          });
          const results = await Promise.all(promises);
          const validCircles = results.filter((c): c is Circle => c !== null);
          setJoinedCirclesList(validCircles);
        } catch (err) {
          console.error('Error fetching joined circles for Explore:', err);
        }
      };
      fetchJoinedCircles();
    } else {
      setJoinedCirclesList([]);
    }
  }, [profile?.joinedCircles]);

  // Derive filters from selectedFilterScope
  let trustFilter = 6;
  let circleFilter = 'ALL';
  if (selectedFilterScope.startsWith('trust_')) {
    trustFilter = parseInt(selectedFilterScope.replace('trust_', ''), 10);
  } else if (selectedFilterScope.startsWith('circle_')) {
    circleFilter = selectedFilterScope.replace('circle_', '');
  }

  const activeFilterCount = 
    (trustFilter !== 6 ? 1 : 0) + 
    (circleFilter !== 'ALL' ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0) + 
    (categoryFilter !== 'ALL' ? 1 : 0);

  // 1. Filter FLOW items matching the selected trust & circle scope
  const flowItems = useMemo(() => {
    return allItems.filter(item => {
      if (item.type !== 'FLOW') return false;

      // Trust Filter
      if (trustFilter < 6) {
        if (item.degrees === undefined || item.degrees > trustFilter) return false;
      }

      // Circle Filter
      if (circleFilter && circleFilter !== 'ALL') {
        if (item.circleId !== circleFilter && !item.targetCircles?.includes(circleFilter)) return false;
      }

      return true;
    });
  }, [allItems, trustFilter, circleFilter]);

  // 2. Filter ALL items to find parent items currently allowed to be visible
  const visibleItems = useMemo(() => {
    return allItems.filter(item => {
      // Trust Filter
      if (trustFilter < 6) {
        if (item.degrees === undefined || item.degrees > trustFilter) return false;
      }

      // Circle Filter
      if (circleFilter && circleFilter !== 'ALL') {
        if (item.circleId !== circleFilter && !item.targetCircles?.includes(circleFilter)) return false;
      }

      // Type filter
      if (typeFilter !== 'ALL') {
        if (item.type !== typeFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        if (item.category !== categoryFilter) return false;
      }

      return true;
    });
  }, [allItems, trustFilter, circleFilter, typeFilter, categoryFilter]);

  // Create lookup of allowed items to securely filter comments
  const visibleItemIds = useMemo(() => new Set(visibleItems.map(i => i.id)), [visibleItems]);
  const visibleIdsKey = useMemo(() => Array.from(visibleItemIds).sort().join(','), [visibleItemIds]);

  // Fetch Buzz comments with fallbacks if collectionGroup query fails (missing index)
  useEffect(() => {
    if (feedMode !== 'FLOW') return;
    if (visibleItemIds.size === 0) {
      setBuzzComments([]);
      setLoadingBuzz(false);
      return;
    }

    setLoadingBuzz(true);

    const q = query(
      collectionGroup(db, 'comments'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => {
        const data = doc.data();
        const itemId = doc.ref.parent.parent?.id || '';
        return {
          id: doc.id,
          itemId,
          ...data
        };
      });

      const filtered = fetched
        .filter(c => visibleItemIds.has(c.itemId))
        .map(c => {
          const item = visibleItems.find(i => i.id === c.itemId);
          return {
            ...c,
            itemTitle: item?.title || '',
            itemOwnerName: item?.ownerName || '',
            itemOwnerPhoto: item?.ownerPhoto || '',
            itemOwnerId: item?.ownerId || '',
            itemType: item?.type || '',
          };
        });

      setBuzzComments(filtered);
      setLoadingBuzz(false);
    }, async (error: any) => {
      console.warn('[Explore] collectionGroup failed, utilizing top 15 fallback queries:', error);
      
      const fetchFallback = async () => {
        const top15 = visibleItems.slice(0, 15);
        const promises = top15.map(async (item) => {
          try {
            const commentsQ = query(
              collection(db, 'items', item.id, 'comments'),
              orderBy('createdAt', 'desc'),
              limit(10)
            );
            const snap = await getDocs(commentsQ);
            return snap.docs.map(doc => ({
              id: doc.id,
              itemId: item.id,
              itemTitle: item.title,
              itemOwnerName: item.ownerName,
              itemOwnerPhoto: item.ownerPhoto,
              itemOwnerId: item.ownerId,
              itemType: item.type,
              ...(doc.data() as any)
            }));
          } catch (e) {
            console.error('Error fetching fallback comments for item', item.id, e);
            return [];
          }
        });
        const results = await Promise.all(promises);
        const flat = results.flat().sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        setBuzzComments(flat);
        setLoadingBuzz(false);
      };

      fetchFallback();
    });

    return () => unsubscribe();
  }, [feedMode, visibleIdsKey]);

  // Combined Flow Items + Buzz Comments feed sorted by createdAt desc
  const mergedFeed = useMemo(() => {
    const list = [];
    if (flowFilter === 'ALL' || flowFilter === 'UPDATES') {
      list.push(
        ...flowItems.map(item => ({
          id: item.id,
          type: 'FLOW_POST',
          createdAt: item.createdAt,
          data: item
        }))
      );
    }
    if (flowFilter === 'ALL' || flowFilter === 'BUZZ') {
      list.push(
        ...buzzComments.map(comment => ({
          id: comment.id,
          type: 'BUZZ_COMMENT',
          createdAt: comment.createdAt,
          data: comment
        }))
      );
    }
    return list.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
  }, [flowItems, buzzComments, flowFilter]);

  // File Picker Conversion
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        setMediaPreview(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Flow Post
  const handlePostFlow = async () => {
    if (!composerContent.trim() || !user || !profile) return;
    setPosting(true);
    try {
      const resolvedLocation = profile?.neighborhoodCenter || profile?.location || location || null;

      // Upload the (already client-compressed) photo to Cloud Storage and
      // store only the download URL. Base64 data-URIs in Firestore documents
      // bloat every read and risk the 1MB doc limit; mediaPreview stays
      // base64 only for the instant local preview.
      let imageUrls: string[] = [];
      if (mediaPreview) {
        const blob = await (await fetch(mediaPreview)).blob();
        const path = `items/uploads/${user.uid}/${Date.now()}_flow.jpg`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
        imageUrls = [await getDownloadURL(fileRef)];
      }

      await addDoc(collection(db, 'items'), {
        ownerId: user.uid,
        ownerName: profile.displayName || 'Neighbor',
        ownerIsOrganization: profile.isOrganization || false,
        ownerPhoto: profile.photoURL || null,
        title: composerContent.trim().slice(0, 60) || 'Flow Update',
        description: composerContent.trim(),
        type: 'FLOW',
        sharingMode: null,
        category: 'Community',
        status: 'ACTIVE',
        circleId: null,
        location: resolvedLocation,
        isFeatured: false,
        reachTypes: ['VICINITY'],
        visibilityReach: 'PUBLIC',
        targetCircles: [],
        participants: [],
        neededParticipants: 0,
        images: imageUrls,
        videos: [],
        createdAt: serverTimestamp(),
      });

      logEvent('item_created', {
        type: 'FLOW',
        category: 'Community',
        sharingMode: null,
        has_images: imageUrls.length > 0,
        has_videos: false,
        visibility_reach: 'PUBLIC',
        reach_types_count: 1,
        circle_id: null
      });

      setComposerContent('');
      setMediaFile(null);
      setMediaPreview(null);
    } catch (err) {
      console.error('Error posting flow update:', err);
    } finally {
      setPosting(false);
    }
  };

  // Like/Appreciate Flow post
  const handleLikePost = async (itemId: string, currentLikes: string[] = []) => {
    if (!user) return;
    const itemRef = doc(db, 'items', itemId);
    const isLiked = currentLikes?.includes(user.uid) || false;
    const updatedLikes = isLiked 
      ? currentLikes.filter(uid => uid !== user.uid)
      : [...(currentLikes || []), user.uid];
    try {
      await updateDoc(itemRef, { likes: updatedLikes });
    } catch (err) {
      console.error('Error updating likes:', err);
    }
  };

  const isFlowLoading = loadingItems || (loadingBuzz && mergedFeed.length === 0);

  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0 h-full w-full">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-[#FDFBF9]/95 backdrop-blur-md sticky top-0 z-30 border-b border-dotted border-stone-300">
        <div className="flex flex-col">
          <h2 className="serif text-xl font-bold text-stone-900 leading-tight">
            Your Neighborhood
          </h2>
        </div>
        
        {/* Switcher & Filter container */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Segment Switcher: Board vs. Hopescrolling */}
          <div id="tour-explore-views" className="grid grid-cols-2 flex-1 sm:flex sm:w-auto bg-[#F3F1EB] p-1 rounded-2xl border border-stone-350 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)]">
            {[
              { id: 'BOARD', label: 'Board' },
              { id: 'FLOW', label: 'Hopescrolling' }
            ].map(({ id, label }) => {
              const isActive = feedMode === id;
              return (
                <button
                  key={id}
                  onClick={() => setFeedMode(id as 'BOARD' | 'FLOW')}
                  className={`py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider relative ${
                    isActive 
                      ? 'bg-brand text-white shadow-sm font-black' 
                      : 'text-stone-500 hover:text-stone-850'
                  } sm:px-4`}
                >
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Minimal Filters Button */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-2xl transition-all border shadow-sm flex items-center justify-center gap-1.5 relative ${
                activeFilterCount > 0
                  ? 'bg-brand text-white border-brand hover:bg-brand-deep'
                  : 'bg-[#F6F4EE] text-stone-700 border-stone-350 hover:bg-[#EADFC9]'
              }`}
              title="Filters"
            >
              <Sliders size={16} className={activeFilterCount > 0 ? 'text-white' : 'text-stone-500'} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C86A51] text-white rounded-full flex items-center justify-center text-[8px] font-black border border-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filters Popover */}
            {showFilters && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowFilters(false)}
                />
                <div className="absolute top-full right-0 mt-1 z-50">
                  <FilterPopover 
                    selectedFilterScope={selectedFilterScope}
                    setSelectedFilterScope={setSelectedFilterScope}
                    joinedCirclesList={joinedCirclesList}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    onReset={() => {
                      setSelectedFilterScope('trust_6');
                      setTypeFilter('ALL');
                      setCategoryFilter('ALL');
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab contents */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative z-10">
        <AnimatePresence mode="wait">
          {feedMode === 'BOARD' ? (
            <motion.div
              key="board"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              <Feed 
                location={location} 
                onNavigateToChat={onNavigateToChat} 
                trustFilter={trustFilter} 
                circleFilter={circleFilter}
                typeFilter={typeFilter}
                categoryFilter={categoryFilter}
                onNavigateToTab={onNavigateToTab}
              />
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              {isFlowLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-stone-50">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-850"></div>
                  <p className="text-stone-400 text-xs font-medium mt-3 italic">Loading neighborhood flow...</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 h-full overflow-y-auto no-scrollbar pt-4">
                  {/* Flow Composer Card */}
                  <div className="px-6 mb-4">
                    <div className="bg-[#FDFBF9] border border-stone-200/80 rounded-[2rem] p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex gap-3">
                        <OwnerAvatar 
                          ownerId={user?.uid || ''} 
                          initialPhotoURL={profile?.photoURL || undefined}
                          initialName={profile?.displayName}
                          className="w-9 h-9"
                        />
                        <textarea
                          value={composerContent}
                          onChange={(e) => setComposerContent(e.target.value)}
                          placeholder="What's happening in the neighborhood? Share ideas, materials, or updates..."
                          className="flex-1 bg-[#FDFBF9] border-none text-stone-800 placeholder-stone-400 text-sm focus:outline-none resize-none h-16 pt-1 text-left"
                        />
                      </div>

                      {/* Image Preview */}
                      {mediaPreview && (
                        <div className="relative w-full rounded-2xl overflow-hidden mt-1 border border-stone-200 shadow-sm max-h-48 flex justify-center bg-stone-150">
                          <img src={mediaPreview} alt="Upload preview" className="object-cover w-full h-full" />
                          <button
                            onClick={() => {
                              setMediaPreview(null);
                              setMediaFile(null);
                            }}
                            className="absolute top-2 right-2 bg-stone-900/60 hover:bg-stone-900/80 text-white rounded-full p-1 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* Composer Footer */}
                      <div className="flex items-center justify-between border-t border-stone-200/60 pt-3 mt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer text-stone-500 hover:text-stone-700 transition-colors">
                          <ImageIcon size={16} className="text-brand" />
                          <span className="text-[11px] font-bold uppercase tracking-wider select-none">Add Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        
                        <button
                          onClick={handlePostFlow}
                          disabled={posting || !composerContent.trim()}
                          className={`px-5 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 ${
                            composerContent.trim() 
                              ? 'bg-brand hover:bg-brand-deep text-white shadow-sm'
                              : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                          }`}
                        >
                          {posting ? 'Posting...' : 'Post'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Flow Sub-Filter Segment Switcher */}
                  <div className="px-6 mb-4 flex justify-start">
                    <div className="flex bg-[#F3F1EB] p-1 rounded-2xl border border-stone-300 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)]">
                      {[
                        { id: 'ALL', label: 'Everything' },
                        { id: 'UPDATES', label: 'Updates' },
                        { id: 'BUZZ', label: 'Buzz' }
                      ].map(({ id, label }) => {
                        const isActive = flowFilter === id;
                        return (
                          <button
                            key={id}
                            onClick={() => setFlowFilter(id as 'ALL' | 'UPDATES' | 'BUZZ')}
                            className={`py-1 rounded-xl transition-all flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider relative px-4 ${
                              isActive 
                                ? 'bg-brand text-white shadow-sm font-black' 
                                : 'text-stone-500 hover:text-stone-850'
                            }`}
                          >
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Combined Feed List */}
                  {mergedFeed.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#FDFBF9] border border-dashed border-stone-300 rounded-[2rem] mx-6 mb-6">
                      <p className="serif text-stone-600 font-bold text-base mb-1">
                        {flowFilter === 'ALL'
                          ? 'Quiet day in the neighborhood'
                          : flowFilter === 'UPDATES'
                          ? 'No updates posted yet'
                          : 'No discussions active yet'}
                      </p>
                      <p className="text-stone-400 text-xs max-w-xs leading-normal">
                        {flowFilter === 'ALL'
                          ? 'Be the first to share an update, photo, or thought in the community flow.'
                          : flowFilter === 'UPDATES'
                          ? 'Share a status update or photo with your neighbors using the form above.'
                          : 'Check back later for recent discussion comments on board items.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 px-6 pb-24">
                      {mergedFeed.map(feedItem => {
                        if (feedItem.type === 'FLOW_POST') {
                          return (
                            <FlowPostCard
                              key={feedItem.id}
                              item={feedItem.data}
                              onLike={() => handleLikePost(feedItem.data.id, feedItem.data.likes)}
                              onComment={() => setDetailItem(feedItem.data)}
                              onViewProfile={(uid) => setSelectedProfileId(uid)}
                              currentUserId={user?.uid}
                            />
                          );
                        } else {
                          return (
                            <BuzzCommentCard
                              key={feedItem.id}
                              comment={feedItem.data}
                              onViewItem={(itemId) => {
                                const parent = allItems.find(i => i.id === itemId);
                                if (parent) setDetailItem(parent);
                              }}
                              onViewProfile={(uid) => setSelectedProfileId(uid)}
                            />
                          );
                        }
                      })}
                      
                      {hasMore && (
                        <div className="flex justify-center py-4">
                          <button
                            onClick={loadMore}
                            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full text-xs font-bold transition-colors"
                          >
                            Load More
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Modals / Sheets */}
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

      {selectedProfileId && (
        <PublicProfile 
          userId={selectedProfileId} 
          onClose={() => setSelectedProfileId(null)} 
          onNavigateToChat={onNavigateToChat}
        />
      )}
    </div>
  );
}
