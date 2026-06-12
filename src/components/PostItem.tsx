/**
 * FILE: PostItem.tsx
 * ROLE IN KULA: The "Content Creator" — form for posting items to the community.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   This component WRITES to the `items` collection in Firestore.
 *   Items created here flow into:
 *     - Discovery.tsx (swipe cards)
 *     - Feed.tsx (list view)
 *     - MapView.tsx (map pins, if location is shared)
 * 
 * ITEM TYPES:
 *   - SHARE ("Giving"): "I have something to offer" — tools, food, skills
 *   - ASK ("Asking"): "I need something" — requests for help or items
 *   - JOIN ("Gathering"): Casual meetups and events
 *   - IMECE: Collaborative tasks needing many hands (with participant counter)
 *   - MISSION: Organization-only tasks for volunteers (gated by isOrganization)
 * 
 * REACH SYSTEM ("Scope of Resonance"):
 *   Users choose WHO can see their post:
 *   - VICINITY: All neighbors within distance
 *   - SPECIFIC_CIRCLES: Only members of selected circles
 *   - Both: Neighborhood + specific circles
 *   Default reach comes from UserProfile.defaultReach (set in Profile.tsx settings).
 * 
 * MEDIA:
 *   Images and videos are captured via camera/gallery and stored as data URLs.
 *   FileReader.readAsDataURL() converts files to base64 strings stored in Firestore.
 *   NOTE: For production, this should migrate to Cloud Storage with proper URLs.
 * 
 * LOCATION:
 *   The "Pin to Map" toggle controls whether GPS coordinates are saved.
 *   If VICINITY is in reachTypes, location is MANDATORY (the toggle is locked on).
 *   Location comes from useGeolocation.ts via the `location` prop.
 * 
 * POST TOUR (Joyride):
 *   First-time posters get an interactive tour explaining each item type.
 *   Controlled by hasCompletedPostTour in the user profile.
 * 
 * CALLED BY: App.tsx (the 'post' tab), Circles.tsx (post within circle)
 */
import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { showToast } from '../lib/dialogs';
import { collection, addDoc, serverTimestamp, query, getDocs, where, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../hooks/useAuth';
import { Send, Image as ImageIcon, MapPin, X, Users, Globe, Shield, Target, Settings, HeartHandshake, Camera, Video, Trash2, Plus, Home, Navigation, Coffee, Calendar, Clock, Sparkles } from 'lucide-react';
import { Circle, KulaReachType, ItemType, SavedLocation, TrustPrivacyLevel, SharingMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Joyride, Step, EventData, STATUS } from 'react-joyride';
import { updateDoc } from 'firebase/firestore';
import { logEvent } from '../lib/analytics';
import { hapticSuccess } from '../lib/haptics';

// Location source mode for post creation
type LocationMode = 'NEIGHBORHOOD' | 'CURRENT_GPS' | 'VENUE' | 'SAVED_LOCATION';

const CATEGORIES = [
  { value: 'Food', label: 'Food & Drinks', emoji: '🍞' },
  { value: 'Equipment', label: 'Tools & Equipment', emoji: '🔨' },
  { value: 'Electronics', label: 'Electronics', emoji: '🔌' },
  { value: 'Furniture', label: 'Furniture', emoji: '🪑' },
  { value: 'Clothing', label: 'Clothing & Wearables', emoji: '👕' },
  { value: 'Plants', label: 'Plants & Garden', emoji: '🌱' },
  { value: 'Books', label: 'Books & Learning', emoji: '📚' },
  { value: 'Mobility', label: 'Bikes & Mobility', emoji: '🚲' },
  { value: 'Art', label: 'Art & Crafts', emoji: '🎨' },
  { value: 'Music', label: 'Music & Instruments', emoji: '🎸' },
  { value: 'Service', label: 'Services & Skills', emoji: '🤝' },
  { value: 'Home', label: 'Home & Cozy', emoji: '🏠' },
  { value: 'Environment', label: 'Environment & Nature', emoji: '🌳' },
  { value: 'Events', label: 'Events & Meetups', emoji: '🎉' },
  { value: 'Support', label: 'Support & Care', emoji: '❤️' },
  { value: 'Digital', label: 'Digital & Software', emoji: '💻' },
  { value: 'Q&A', label: 'Q&A & Advice', emoji: '💡' },
  { value: 'Community', label: 'Community & Other', emoji: '🏡' },
];

interface PostItemProps {
  location: { lat: number; lng: number } | null;
  onSuccess: () => void;
  onCancel?: () => void;
  initialCircleId?: string;
  initialType?: ItemType;
}

export default function PostItem({ location, onSuccess, onCancel, initialCircleId, initialType }: PostItemProps) {
  const { user, profile } = useAuth();
  const [type, setType] = useState<ItemType>(initialType || 'SHARE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Community');
  const [neededParticipants, setNeededParticipants] = useState(3);
  const [reachTypes, setReachTypes] = useState<KulaReachType[]>(initialCircleId ? ['SPECIFIC_CIRCLES'] : ['VICINITY']);
  const [targetCircles, setTargetCircles] = useState<string[]>(initialCircleId ? [initialCircleId] : []);
  const [media, setMedia] = useState<{ url: string; path: string; type: 'image' | 'video' }[]>([]);
  const [shareLocation, setShareLocation] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [availableFrom, setAvailableFrom] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [visibilityReach, setVisibilityReach] = useState<TrustPrivacyLevel>('PUBLIC');
  const [sharingMode, setSharingMode] = useState<SharingMode | undefined>(undefined);

  // ── Location Source Mode ──
  // Controls WHERE the post is pinned on the map:
  //   NEIGHBORHOOD = user's home coordinates (from profile)
  //   CURRENT_GPS  = device's current GPS position
  //   VENUE        = custom venue name (for JOINs, defaults to home coords)
  const [locationMode, setLocationMode] = useState<LocationMode>(
    (initialType || 'SHARE') === 'JOIN' ? 'VENUE'
    : (profile?.savedLocations?.length ?? 0) > 0 ? 'SAVED_LOCATION'
    : 'NEIGHBORHOOD'
  );
  const [venueName, setVenueName] = useState('');
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState<string | null>(null);

  // Derive saved locations from the user's profile
  const savedLocations: SavedLocation[] = profile?.savedLocations || [];

  // Auto-switch locationMode when item type changes
  useEffect(() => {
    if (type === 'JOIN') {
      setLocationMode('VENUE');
    } else if (savedLocations.length > 0) {
      setLocationMode('SAVED_LOCATION');
      // Auto-select the default or first saved location
      if (!selectedSavedLocationId) {
        const def = savedLocations.find(s => s.isDefault) || savedLocations[0];
        setSelectedSavedLocationId(def.id);
      }
    } else {
      setLocationMode('NEIGHBORHOOD');
    }
  }, [type]);

  // Reset sharingMode when type changes (since ASK and SHARE have different modes)
  useEffect(() => {
    setSharingMode(undefined);
  }, [type]);

  useEffect(() => {
    // [ALPHA] Post tour disabled for closed alpha — clean UX without overlays.
    // TODO: Re-enable post-launch with updated steps for Feed-first flow.
    // if (profile?.hasCompletedOnboarding && !profile?.hasCompletedPostTour) {
    //   const timer = setTimeout(() => { setRunTour(true); }, 500);
    //   return () => clearTimeout(timer);
    // }
  }, [profile]);

  const handleJoyrideCallback = async (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      try {
        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            hasCompletedPostTour: true
          });
        }
      } catch (e) {
        console.error('Error updating tour status:', e);
      }
    }
  };

  const tourSteps: Step[] = [
    {
      target: '#tour-post-share',
      content: '"Giving" is for when you want to share something you have with your neighbors – like free lemons from your tree, a book you finished, or an hour of your time to help someone practice a language.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-post-ask',
      content: '"Asking" is for when you need something – a drill for the afternoon, a cup of sugar, or recommendations for a good local plumber.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-post-join',
      content: '"Join" is for casual meetups and activities – "Going for a run at 6 PM", "Coffee at the local cafe", or "Playing chess in the park".',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-post-imece',
      content: '"İmece" represents a community working together. Use this when many hands make light work – like cleaning a park, moving heavy furniture, or organizing a block party.',
      skipBeacon: true,
      skipScroll: true,
    }
  ];

  if (profile?.isOrganization) {
    tourSteps.push({
      target: '#tour-post-mission',
      content: '"Mission" is exclusively for organizations to seek volunteers for specific tasks or events.',
      skipBeacon: true,
      skipScroll: true,
    });
  }

  const isLocationMandatory = reachTypes.includes('VICINITY');

  useEffect(() => {
    if (isLocationMandatory) {
      setShareLocation(true);
    }
  }, [isLocationMandatory]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      let dataToUpload: Blob | File = file;
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        console.log('[KULA STORAGE] Image detected. Stripping EXIF metadata client-side...');
        dataToUpload = await new Promise<Blob>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(file);
                return;
              }
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(
                (blob) => resolve(blob || file),
                file.type || 'image/jpeg',
                0.85
              );
            };
            img.onerror = () => resolve(file);
            img.src = event.target?.result as string;
          };
          reader.onerror = () => resolve(file);
          reader.readAsDataURL(file);
        });
      }

      const extension = file.name.split('.').pop() || 'jpg';
      const storagePath = `items/uploads/${user.uid}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const storageRef = ref(storage, storagePath);

      console.log(`[KULA STORAGE] Uploading file to path: ${storagePath}...`);
      await uploadBytes(storageRef, dataToUpload);
      const downloadUrl = await getDownloadURL(storageRef);

      setMedia(prev => [...prev, {
        url: downloadUrl,
        path: storagePath,
        type: file.type.startsWith('video') ? 'video' : 'image'
      }]);
      console.log(`[KULA STORAGE] Upload complete. Download URL: ${downloadUrl}`);
    } catch (err) {
      console.error('[KULA STORAGE] Upload failed:', err);
      showToast('Failed to upload image. Please try again.', 'warning');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (index: number) => {
    const mediaItem = media[index];
    if (!mediaItem) return;

    // Remove from state immediately for responsive UI
    setMedia(prev => prev.filter((_, i) => i !== index));

    try {
      console.log(`[KULA STORAGE] Deleting file from storage: ${mediaItem.path}`);
      const storageRef = ref(storage, mediaItem.path);
      await deleteObject(storageRef);
      console.log(`[KULA STORAGE] File deleted successfully.`);
    } catch (err) {
      // Log error but don't disrupt user flow (the cleanup script will get it anyway)
      console.warn('[KULA STORAGE] Failed to delete removed file from storage:', err);
    }
  };

  useEffect(() => {
    if (profile?.defaultReach && !initialCircleId) {
      const normalizedReach = Array.isArray(profile.defaultReach) 
        ? profile.defaultReach 
        : [profile.defaultReach as unknown as KulaReachType];
      setReachTypes(normalizedReach);
    }
  }, [profile?.defaultReach, initialCircleId]);
  const [showReachOptions, setShowReachOptions] = useState(false);
  const [circles, setCircles] = useState<Circle[]>([]);

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        // Fetch public/private circles
        const q = query(collection(db, 'circles'), where('privacy', '!=', 'HIDDEN'));
        const snap = await getDocs(q);
        const accessibleCircles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Circle[];
        
        // Also fetch joined circles explicitly (in case any are HIDDEN)
        const joinedCircleIds = (profile?.joinedCircles || []).filter(id => !accessibleCircles.some(c => c.id === id));
        const joinedCircles: Circle[] = [];
        
        for (const cid of joinedCircleIds.slice(0, 20)) {
          try {
            const cSnap = await getDoc(doc(db, 'circles', cid));
            if (cSnap.exists()) {
              joinedCircles.push({ id: cSnap.id, ...cSnap.data() } as Circle);
            }
          } catch (e) {
             console.error('Error fetching joined circle in PostItem:', e);
          }
        }
        
        setCircles([...accessibleCircles, ...joinedCircles]);
      } catch (err) {
        console.error('Error fetching circles in PostItem:', err);
      }
    };
    fetchCircles();
  }, [profile?.joinedCircles]);

  // Resolve location coordinates based on the selected locationMode
  const resolveLocation = (): { lat: number; lng: number } | null => {
    if (!shareLocation) return null;
    switch (locationMode) {
      case 'NEIGHBORHOOD':
        // Use the user's neighborhood center (privacy-offset) or fallback to profile.location
        return profile?.neighborhoodCenter || profile?.location || location || null;
      case 'SAVED_LOCATION': {
        // Use the selected saved location's privacy-offset center
        const saved = savedLocations.find(s => s.id === selectedSavedLocationId);
        if (saved) return saved.neighborhoodCenter;
        // Fallback to default saved location or profile neighborhood
        const defaultLoc = savedLocations.find(s => s.isDefault);
        if (defaultLoc) return defaultLoc.neighborhoodCenter;
        return profile?.neighborhoodCenter || profile?.location || location || null;
      }
      case 'CURRENT_GPS':
        return location; // real-time device GPS
      case 'VENUE':
        // For venues, use neighborhood center as fallback coordinates
        // (In future, this could be geocoded from the venue name)
        return profile?.neighborhoodCenter || profile?.location || location || null;
      default:
        return location;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = type === 'FLOW' ? (description.slice(0, 60) || 'Flow Update') : title;
    if (!user || !description || (type !== 'FLOW' && !title) || uploading) return;

    setSubmitting(true);
    try {
      const resolvedLocation = resolveLocation();

      await addDoc(collection(db, 'items'), {
        ownerId: user.uid,
        ownerName: profile.displayName,
        ownerIsOrganization: profile.isOrganization || false,
        ownerPhoto: profile.photoURL,
        title: finalTitle,
        description,
        type,
        sharingMode: (type === 'SHARE' || type === 'ASK') && sharingMode ? sharingMode : null,
        category: type === 'FLOW' ? 'Community' : category,
        status: 'ACTIVE',
        circleId: initialCircleId || null,
        location: resolvedLocation,
        isFeatured: false,
        reachTypes,
        visibilityReach,
        targetCircles: reachTypes.includes('SPECIFIC_CIRCLES') ? targetCircles : [],
        participants: [],
        neededParticipants: 0,
        images: media.filter(m => m.type === 'image').map(m => m.url),
        videos: media.filter(m => m.type === 'video').map(m => m.url),
        createdAt: serverTimestamp(),
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        expiresAt: ['ASK', 'SHARE'].includes(type) && expiresAt ? new Date(expiresAt) : null,
        eventTime: type === 'JOIN' && eventTime ? new Date(eventTime) : null,
        eventEndTime: type === 'JOIN' && eventEndTime ? new Date(eventEndTime) : null,
        venueName: type === 'JOIN' && venueName ? venueName : null,
      });

      logEvent('item_created', {
        type,
        category: type === 'FLOW' ? 'Community' : category,
        sharingMode: (type === 'SHARE' || type === 'ASK') && sharingMode ? sharingMode : null,
        has_images: media.some(m => m.type === 'image'),
        has_videos: media.some(m => m.type === 'video'),
        visibility_reach: visibilityReach,
        reach_types_count: reachTypes.length,
        circle_id: initialCircleId || null
      });

      hapticSuccess();
      onSuccess();
    } catch (err) {
      console.error('Error posting item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // --- VISIBLE UI STARTS HERE ---
  // The code below draws the form layout: the tour guide, the title, and all the input fields.
  return (
    <div className="h-full flex flex-col pt-4 px-6 relative overflow-y-auto no-scrollbar">
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        locale={{ last: 'Done' }}
        onEvent={handleJoyrideCallback}
        options={{
          showProgress: false,
          buttons: ['back', 'skip', 'primary'],
          arrowColor: '#f5f5f4', // stone-100
          backgroundColor: '#f5f5f4',
          overlayColor: 'rgba(28, 25, 23, 0.7)', // stone-900 / 0.7
          primaryColor: '#c1a077',
          textColor: '#292524', // stone-800
          zIndex: 1000,
        }}
        styles={{
          floater: {
            textAlign: 'left',
            borderRadius: '1rem',
            padding: '1rem',
          },
          buttonPrimary: {
            backgroundColor: '#292524',
            borderRadius: '1rem',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '10px',
            padding: '12px 20px',
            color: '#ffffff',
          },
          buttonBack: {
            marginRight: 10,
            color: '#292524',
            fontFamily: 'sans-serif',
            fontSize: '12px',
          },
          buttonSkip: {
            color: '#78716c',
            fontFamily: 'sans-serif',
            fontSize: '12px',
          }
        }}
      />
      <div className="flex justify-between items-center mb-8">

        <h2 className="serif text-3xl font-bold text-brand">Create Entry</h2>
        <button 
          onClick={() => onCancel ? onCancel() : onSuccess()}
          className="text-stone-500 hover:text-stone-700 p-2 rounded-full hover:bg-stone-50 transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-8 pb-20">
        {/* Media Preview */}
        {media.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar px-2">
            {media.map((item, index) => (
              <div key={index} className="relative flex-shrink-0 w-32 h-32 rounded-3xl overflow-hidden border-2 border-stone-100 shadow-sm">
                {item.type === 'image' ? (
                  <img referrerPolicy="no-referrer" src={item.url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <video src={item.url} className="w-full h-full object-cover" />
                )}
                <button 
                  type="button"
                  onClick={() => removeMedia(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-md"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(['SHARE', 'ASK', 'JOIN', 'FLOW'] as const)
            .map(t => (
            <button
              key={t}
              id={`tour-post-${t.toLowerCase()}`}
              type="button"
              onClick={() => setType(t)}
              className={`flex-shrink-0 px-6 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 flex items-center gap-2 ${
                type === t 
                  ? t === 'JOIN'
                    ? 'bg-teal-900 text-white border-teal-900 shadow-lg scale-105'
                    : t === 'FLOW'
                      ? 'bg-[#C86A51] text-white border-[#C86A51] shadow-lg scale-105'
                      : 'bg-stone-900 text-white border-stone-900 shadow-lg scale-105' 
                  : 'bg-white text-stone-400 border-stone-100'
              }`}
            >
              {t === 'SHARE' && 'Giving'}
              {t === 'ASK' && 'Asking'}
              {t === 'JOIN' && 'Join'}
              {t === 'FLOW' && 'Flow'}
              {t === 'JOIN' && <Users size={14} className="text-teal-400" />}
              {t === 'FLOW' && <Sparkles size={14} className="text-amber-350" />}
            </button>
          ))}
        </div>

        {/* Sharing Modality Selector (Optional) */}
        {(type === 'SHARE' || type === 'ASK') && (
          <div className="space-y-3 bg-stone-50/50 p-4 rounded-[2rem] border border-stone-100/80 animate-in fade-in duration-300">
            <div className="flex flex-col gap-1 px-1 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Sharing Expectation (Optional)
              </label>
              <p className="text-[9px] text-stone-400 italic">
                Choose how you want to share or receive this item
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {type === 'SHARE' ? (
                <>
                  {[
                    { value: 'GIFT', label: 'Giveaway', emoji: '🎁', colorClass: 'border-emerald-100 text-emerald-700 bg-emerald-50/50 hover:border-emerald-300' },
                    { value: 'LEND', label: 'Lend', emoji: '🛠️', colorClass: 'border-amber-100 text-amber-700 bg-amber-50/50 hover:border-amber-300' },
                    { value: 'SKILL', label: 'Skill Share', emoji: '🤝', colorClass: 'border-indigo-100 text-indigo-700 bg-indigo-50/50 hover:border-indigo-300' }
                  ].map(opt => {
                    const isSelected = sharingMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSharingMode(isSelected ? undefined : opt.value as any)}
                        className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-stone-900 border-stone-900 text-white shadow-md scale-[1.02]'
                            : `${opt.colorClass} border-stone-100 bg-white text-stone-500`
                        }`}
                      >
                        <span className="text-xs">{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  {[
                    { value: 'GIFT', label: 'Keep', emoji: '🎁', colorClass: 'border-emerald-100 text-emerald-700 bg-emerald-50/50 hover:border-emerald-300' },
                    { value: 'BORROW', label: 'Borrow', emoji: '🔍', colorClass: 'border-amber-100 text-amber-700 bg-amber-50/50 hover:border-amber-300' },
                    { value: 'FAVOR', label: 'Favor', emoji: '❤️', colorClass: 'border-rose-100 text-rose-700 bg-rose-50/50 hover:border-rose-300' }
                  ].map(opt => {
                    const isSelected = sharingMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSharingMode(isSelected ? undefined : opt.value as any)}
                        className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-stone-900 border-stone-900 text-white shadow-md scale-[1.02]'
                            : `${opt.colorClass} border-stone-100 bg-white text-stone-500`
                        }`}
                      >
                        <span className="text-xs">{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {type === 'JOIN' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-5 bg-teal-50 rounded-[2rem] border-2 border-teal-100 space-y-4"
          >
            <div className="flex items-center gap-2 text-teal-900">
              <Users size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Gathering & Event</span>
            </div>
            <p className="text-[10px] text-teal-600 italic">"Join" is for casual meetups, events, or activities (like 'Going for a run' or 'Coffee chat') where anyone can participate.</p>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-teal-700 ml-2">Meeting Place / Venue</label>
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-teal-100 rounded-xl text-teal-700">
                  <Coffee size={16} />
                </div>
                <input 
                  type="text" 
                  placeholder="e.g. Mauerpark, Cafe Kranzler, Tempelhofer Feld..."
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="flex-1 bg-white border-b-2 border-teal-200 px-3 py-3 text-sm text-stone-800 focus:border-teal-500 outline-none transition-colors rounded-xl placeholder:text-stone-300"
                />
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-6">
          {type !== 'FLOW' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">What is it?</label>
              <input 
                type="text"
                placeholder="e.g. Garden tools, Fresh cake, Math tutoring..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="w-full bg-white border-b-2 border-stone-200 px-2 py-4 text-xl serif focus:border-brand outline-none transition-colors"
                required
              />
            </div>
          )}

          {type !== 'FLOW' && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Category</label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar bg-stone-50/50 p-3 rounded-[2rem] border border-stone-100">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-2 text-left ${
                      category === cat.value
                        ? 'bg-stone-900 border-stone-900 text-white shadow-md scale-[1.02]'
                        : 'bg-white text-stone-500 border-stone-100/80 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-sm">{cat.emoji}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">
              {type === 'FLOW' ? 'Status / Update' : 'Tell more'}
            </label>
            <textarea 
              placeholder={type === 'FLOW' ? "What's happening in the neighborhood? Share ideas, materials, or updates..." : "Describe the item or your need in detail..."}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-white border-b-2 border-stone-200 px-2 py-4 text-stone-600 focus:border-brand outline-none transition-colors overflow-hidden"
              required
            />
          </div>

          {/* ── Availability Window — shown for ALL entry types EXCEPT FLOW ── */}
          {type !== 'FLOW' && (
            <div className="space-y-3 bg-stone-50 p-4 rounded-3xl border border-stone-100">
              <div className="flex items-center gap-2 px-1">
                <Calendar size={14} className="text-stone-400" />
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Availability Window (Optional)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1 flex items-center gap-1">
                    <Clock size={10} /> From
                  </label>
                  <input
                    type="datetime-local"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                    className="w-full bg-white rounded-2xl px-3 py-3 text-sm text-stone-700 border border-stone-200 focus:ring-2 focus:ring-brand outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400 ml-1 flex items-center gap-1">
                    <Clock size={10} /> Until
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full bg-white rounded-2xl px-3 py-3 text-sm text-stone-700 border border-stone-200 focus:ring-2 focus:ring-brand outline-none transition-all"
                  />
                </div>
              </div>
              {(availableFrom || expiresAt) ? (
                <p className="text-[9px] text-stone-400 italic px-1">
                  {availableFrom && !expiresAt && `Available from ${new Date(availableFrom).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} (expires 30 days after creation by default)`}
                  {!availableFrom && expiresAt && `Available until ${new Date(expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`}
                  {availableFrom && expiresAt && `Available ${new Date(availableFrom).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(expiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`}
                </p>
              ) : (
                <p className="text-[9px] text-stone-400 italic px-1">
                  Note: Posts automatically expire 30 days after creation unless a specific date is set.
                </p>
              )}
            </div>
          )}

          {/* ── JOIN-specific event time window ── */}
          {type === 'JOIN' && (
            <div className="space-y-4 bg-teal-50 p-4 rounded-3xl border border-teal-100">
              <div className="flex items-center gap-2 px-1">
                <Clock size={14} className="text-teal-500" />
                <label className="text-[10px] font-black uppercase tracking-widest text-teal-600">Event Time (Optional)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-teal-500 ml-1">Starts</label>
                  <input
                    type="datetime-local"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full bg-white rounded-2xl px-3 py-3 text-sm text-stone-700 border border-teal-200 focus:ring-2 focus:ring-teal-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-teal-500 ml-1">Ends</label>
                  <input
                    type="datetime-local"
                    value={eventEndTime}
                    onChange={(e) => setEventEndTime(e.target.value)}
                    className="w-full bg-white rounded-2xl px-3 py-3 text-sm text-stone-700 border border-teal-200 focus:ring-2 focus:ring-teal-400 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Post Scope</label>
            </div>
            
            <button
              type="button"
              onClick={() => setShowReachOptions(true)}
              className="w-full p-4 bg-stone-50 border-2 border-stone-200 rounded-[2rem] flex items-center gap-4 transition-all hover:border-stone-900 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-stone-900 shadow-sm border border-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-all">
                {reachTypes.includes('VICINITY') && reachTypes.length === 1 && <Globe size={24} />}
                {reachTypes.includes('ALL_CIRCLES') && reachTypes.length === 1 && <Shield size={24} />}
                {reachTypes.includes('SPECIFIC_CIRCLES') && reachTypes.length === 1 && <Target size={24} />}
                {reachTypes.length > 1 && <Users size={24} />}
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-bold text-stone-900 leading-tight">
                  {reachTypes.includes('VICINITY') && reachTypes.includes('SPECIFIC_CIRCLES') ? 'Neighborhood & Circles' :
                   reachTypes.includes('VICINITY') ? 'Your Neighborhood' :
                   reachTypes.includes('SPECIFIC_CIRCLES') ? 'Your Circles' : 'Select Scope'}
                </h4>
                <p className="text-[10px] text-stone-400 font-medium">
                  Visible to {Array.isArray(reachTypes) && reachTypes.includes('VICINITY') ? 'neighbors' : ''} 
                  {Array.isArray(reachTypes) && reachTypes.includes('VICINITY') && reachTypes.some(t => t !== 'VICINITY') ? ' & ' : ''}
                  {Array.isArray(reachTypes) && reachTypes.includes('SPECIFIC_CIRCLES') ? `${targetCircles.length} community circles` : ''}
                </p>
                {initialCircleId && reachTypes.length === 1 && reachTypes[0] === 'SPECIFIC_CIRCLES' && (
                  <p className="text-[9px] text-stone-300 italic mt-1 group-hover:text-stone-500">Only visible within this circle. Tap to adjust scope.</p>
                )}
              </div>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Trust Network Reach</label>
            </div>
            
            <div className="w-full p-4 bg-stone-50 border border-stone-200/80 rounded-[2rem] flex flex-col gap-4">
              <p className="text-[10px] text-stone-400 font-medium px-2 leading-tight">
                Controls the maximum degree of connection distance users must have from you to see this post.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'PRIVATE', title: 'Private', desc: 'Only visible to you' },
                  { id: 'DEGREE_1', title: '1st Connection', desc: 'Only direct vouched friends & family' },
                  { id: 'DEGREE_2', title: '2nd Connection', desc: 'Friends of friends' },
                  { id: 'DEGREE_3', title: '3rd Connection', desc: 'Up to 3 separation steps' },
                  { id: 'DEGREE_4', title: '4th Connection', desc: 'Max trust graph separation (4 steps)' },
                  { id: 'PUBLIC', title: 'Public (Anyone)', desc: 'Visible to everyone' }
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVisibilityReach(option.id as TrustPrivacyLevel)}
                    className={`p-3 rounded-2xl border-2 flex flex-col transition-all text-left ${
                      visibilityReach === option.id
                        ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                        : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{option.title}</span>
                    <span className={`text-[9px] font-medium leading-tight ${
                      visibilityReach === option.id ? 'text-stone-300' : 'text-stone-400'
                    }`}>
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showReachOptions && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-950/40 backdrop-blur-sm"
              onClick={() => setShowReachOptions(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto no-scrollbar"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-8">
                  <h3 className="serif text-2xl font-bold text-stone-900 mb-2">Scope of Resonance</h3>
                  <p className="text-xs text-stone-400 font-medium">How far should your energy travel?</p>
                </div>

                <div className="space-y-3">
                  {[
                    { id: 'VICINITY', title: 'Your Neighborhood', icon: Globe, desc: 'Visible to neighbors' },
                    { id: 'SPECIFIC_CIRCLES', title: 'Your Circles', icon: Target, desc: 'Targeted groups' }
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setReachTypes(prev => {
                          const isAlreadySelected = prev.includes(option.id as KulaReachType);
                          
                          if (option.id === 'VICINITY') {
                            if (isAlreadySelected) {
                              // Only allow deselecting vicinity if at least one circle option is selected
                              return prev.length > 1 ? prev.filter(t => t !== 'VICINITY') : prev;
                            } else {
                              return [...prev, 'VICINITY'];
                            }
                          } else {
                            // Community options are mutually exclusive for now (either ALL or SPECIFIC)
                            const base = prev.filter(t => t === 'VICINITY');
                            if (isAlreadySelected) {
                              // Deselecting community option
                              return base.length > 0 ? base : ['VICINITY'];
                            } else {
                              return [...base, option.id as KulaReachType];
                            }
                          }
                        });
                      }}
                      className={`w-full p-4 rounded-3xl border-2 flex items-center gap-4 transition-all ${
                        reachTypes.includes(option.id as KulaReachType) 
                          ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                          : 'border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      <option.icon size={20} />
                      <div className="text-left">
                        <div className="text-sm font-bold">{option.title}</div>
                        <div className={`text-[10px] ${reachTypes.includes(option.id as KulaReachType) ? 'text-stone-300' : 'text-stone-400'}`}>
                          {option.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {reachTypes.includes('SPECIFIC_CIRCLES') && (
                  <div className="mt-6 space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {circles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (targetCircles.length === circles.length) {
                            setTargetCircles([]);
                          } else {
                            setTargetCircles(circles.map(c => c.id));
                          }
                        }}
                        className={`w-full p-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] border-2 transition-all flex items-center justify-between group/btn ${
                          targetCircles.length === circles.length
                            ? 'bg-stone-900 text-white border-stone-900 shadow-lg'
                            : 'bg-white text-stone-500 border-stone-100 hover:border-stone-300'
                        }`}
                      >
                        <span>Select All</span>
                        {targetCircles.length === circles.length && <Plus size={14} className="rotate-45" />}
                      </button>
                    )}
                    {circles.map(circle => (
                      <button
                        key={circle.id}
                        type="button"
                        onClick={() => {
                          setTargetCircles(prev => 
                            prev.includes(circle.id) 
                              ? prev.filter(id => id !== circle.id) 
                              : [...prev, circle.id]
                          );
                        }}
                        className={`w-full p-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] border-2 transition-all flex items-center justify-between group/btn ${
                          targetCircles.includes(circle.id)
                            ? 'bg-stone-900 text-white border-stone-900 shadow-lg'
                            : 'bg-white text-stone-500 border-stone-100 hover:border-stone-300'
                        }`}
                      >
                        <span>{circle.name}</span>
                        {targetCircles.includes(circle.id) && <Plus size={14} className="rotate-45" />}
                      </button>
                    ))}
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => setShowReachOptions(false)}
                  className="w-full mt-8 py-4 bg-stone-100 rounded-[2rem] text-stone-900 font-bold text-xs uppercase tracking-widest hover:bg-stone-200 transition-all"
                >
                  Confirm Reach
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-stone-100 rounded-3xl text-stone-500 font-bold text-xs uppercase tracking-widest transition-all hover:bg-stone-200 cursor-pointer">
              <Camera size={24} />
              <span>Photo</span>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={handleMediaUpload}
              />
            </label>
            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-stone-100 rounded-3xl text-stone-500 font-bold text-xs uppercase tracking-widest transition-all hover:bg-stone-200 cursor-pointer">
              <Video size={24} />
              <span>Video</span>
              <input 
                type="file" 
                accept="video/*" 
                capture="environment" 
                className="hidden" 
                onChange={handleMediaUpload}
              />
            </label>
            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-6 bg-stone-100 rounded-3xl text-stone-500 font-bold text-xs uppercase tracking-widest transition-all hover:bg-stone-200 cursor-pointer">
              <ImageIcon size={24} />
              <span>Gallery</span>
              <input 
                type="file" 
                accept="image/*,video/*" 
                multiple
                className="hidden" 
                onChange={handleMediaUpload}
              />
            </label>
          </div>
          
          <div className="space-y-3">
            {/* Location Source Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Location Source</label>
              <div className="space-y-2">
                {/* Option 1: My Neighborhood (only if no saved locations) */}
                {savedLocations.length === 0 && (
                  <button
                    type="button"
                    onClick={() => { setLocationMode('NEIGHBORHOOD'); setShareLocation(true); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      locationMode === 'NEIGHBORHOOD'
                        ? 'border-brand bg-white shadow-sm'
                        : 'border-stone-100 bg-stone-50 hover:border-stone-200'
                    }`}
                  >
                    <div className={`p-2 rounded-xl transition-all ${
                      locationMode === 'NEIGHBORHOOD' ? 'bg-brand text-white' : 'bg-stone-200 text-stone-400'
                    }`}>
                      <Home size={16} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-bold text-stone-900">My Neighborhood</div>
                      <div className="text-[9px] text-stone-400 font-medium">Pins to your home area (privacy-protected)</div>
                    </div>
                    {locationMode === 'NEIGHBORHOOD' && (
                      <div className="w-2 h-2 bg-brand rounded-full" />
                    )}
                  </button>
                )}

                {/* Option 1b: Saved Location picker (when user has address book entries) */}
                {savedLocations.length > 0 && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLocationMode('SAVED_LOCATION');
                        setShareLocation(true);
                        // Auto-select the default or first saved location
                        if (!selectedSavedLocationId) {
                          const def = savedLocations.find(s => s.isDefault) || savedLocations[0];
                          setSelectedSavedLocationId(def.id);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                        locationMode === 'SAVED_LOCATION'
                          ? 'border-brand bg-white shadow-sm'
                          : 'border-stone-100 bg-stone-50 hover:border-stone-200'
                      }`}
                    >
                      <div className={`p-2 rounded-xl transition-all ${
                        locationMode === 'SAVED_LOCATION' ? 'bg-brand text-white' : 'bg-stone-200 text-stone-400'
                      }`}>
                        <MapPin size={16} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-xs font-bold text-stone-900">Saved Location</div>
                        <div className="text-[9px] text-stone-400 font-medium">Pick from your address book</div>
                      </div>
                      {locationMode === 'SAVED_LOCATION' && (
                        <div className="w-2 h-2 bg-brand rounded-full" />
                      )}
                    </button>

                    {/* Sub-options: individual saved locations */}
                    {locationMode === 'SAVED_LOCATION' && (
                      <div className="ml-8 space-y-1">
                        {savedLocations.map(loc => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => setSelectedSavedLocationId(loc.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${
                              selectedSavedLocationId === loc.id
                                ? 'border-brand bg-brand/5 shadow-sm'
                                : 'border-stone-100 bg-stone-50/50 hover:border-stone-200'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${
                              selectedSavedLocationId === loc.id
                                ? 'bg-brand text-white'
                                : 'bg-stone-200 text-stone-400'
                            }`}>
                              {loc.label.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-bold text-stone-800 truncate">{loc.label}</div>
                              <div className="text-[8px] text-stone-400 font-medium">
                                {loc.neighborhoodRadius >= 1000
                                  ? `${loc.neighborhoodRadius / 1000}km privacy zone`
                                  : `${loc.neighborhoodRadius}m privacy zone`
                                }
                                {loc.isDefault && ' · default'}
                              </div>
                            </div>
                            {selectedSavedLocationId === loc.id && (
                              <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Option 2: Current GPS */}
                <button
                  type="button"
                  onClick={() => { setLocationMode('CURRENT_GPS'); setShareLocation(true); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                    locationMode === 'CURRENT_GPS'
                      ? 'border-brand bg-white shadow-sm'
                      : 'border-stone-100 bg-stone-50 hover:border-stone-200'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all ${
                    locationMode === 'CURRENT_GPS' ? 'bg-brand text-white' : 'bg-stone-200 text-stone-400'
                  }`}>
                    <Navigation size={16} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-bold text-stone-900">Exact Current Location</div>
                    <div className="text-[9px] text-stone-400 font-medium">
                      {location ? 'Uses your real-time GPS coordinates' : 'GPS not available'}
                    </div>
                  </div>
                  {locationMode === 'CURRENT_GPS' && (
                    <div className="w-2 h-2 bg-brand rounded-full" />
                  )}
                </button>

                {/* Option 3: Specific Venue (default for JOIN) */}
                <button
                  type="button"
                  onClick={() => { setLocationMode('VENUE'); setShareLocation(true); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                    locationMode === 'VENUE'
                      ? 'border-teal-500 bg-teal-50 shadow-sm'
                      : 'border-stone-100 bg-stone-50 hover:border-stone-200'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all ${
                    locationMode === 'VENUE' ? 'bg-teal-600 text-white' : 'bg-stone-200 text-stone-400'
                  }`}>
                    <Coffee size={16} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-bold text-stone-900">Specific Venue</div>
                    <div className="text-[9px] text-stone-400 font-medium">Event/meetup location (e.g. a cafe or park)</div>
                  </div>
                  {locationMode === 'VENUE' && (
                    <div className="w-2 h-2 bg-teal-500 rounded-full" />
                  )}
                </button>
              </div>
            </div>

            {/* Venue name input (shown when VENUE mode or JOIN type) */}
            {locationMode === 'VENUE' && type !== 'JOIN' && (
              <div className="px-2">
                <input 
                  type="text" 
                  placeholder="Venue name (e.g. Mauerpark, Cafe Kranzler...)"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full bg-white border-b-2 border-teal-200 px-3 py-3 text-sm text-stone-800 focus:border-teal-500 outline-none transition-colors placeholder:text-stone-300"
                />
              </div>
            )}

            {/* Location status indicator */}
            <div className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] transition-all border ${
              locationMode === 'CURRENT_GPS'
                ? location
                  ? 'bg-green-50 text-green-600 border-green-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
                : locationMode === 'VENUE'
                  ? 'bg-teal-50 text-teal-600 border-teal-100'
                  : 'bg-stone-50 text-stone-500 border-stone-100'
            }`}>
              {locationMode === 'NEIGHBORHOOD' && (
                <>
                  <Home size={10} />
                  Pinned to Your Neighborhood
                </>
              )}
              {locationMode === 'SAVED_LOCATION' && (
                <>
                  <MapPin size={10} />
                  {(() => {
                    const sel = savedLocations.find(s => s.id === selectedSavedLocationId);
                    return sel ? `📍 ${sel.label}` : 'Select a saved location';
                  })()}
                </>
              )}
              {locationMode === 'CURRENT_GPS' && (
                location ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    Live GPS Active
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                    Acquiring Signal...
                  </>
                )
              )}
              {locationMode === 'VENUE' && (
                <>
                  <Coffee size={10} />
                  {venueName ? `Venue: ${venueName}` : 'Enter a venue name above'}
                </>
              )}
            </div>

            {/* Privacy disclosure: Live GPS shares precise coordinates, unlike
                the blurred neighborhood modes. Required for App Store privacy
                accuracy (matches NSLocationWhenInUseUsageDescription). */}
            {locationMode === 'CURRENT_GPS' && (
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center leading-relaxed">
                Live GPS shares your <span className="font-bold">precise current location</span> with
                everyone who can see this post. Switch to Neighborhood mode to share only a blurred area.
              </p>
            )}
          </div>
        </div>

        <button 
          type="submit"
          disabled={submitting || uploading || (type !== 'FLOW' && !title) || !description || (isLocationMandatory && !location)}
          className="w-full py-6 bg-stone-900 text-white rounded-[2rem] font-bold text-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {submitting ? 'Sharing...' : uploading ? 'Uploading media...' : initialCircleId ? 'Share with Circle & More' : 'Share with Community'}
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
