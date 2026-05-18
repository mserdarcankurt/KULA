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
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, getDocs, where, getDoc, doc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Send, Image as ImageIcon, MapPin, X, Users, Globe, Shield, Target, Settings, HeartHandshake, Camera, Video, Trash2, Plus } from 'lucide-react';
import { Circle, KulaReachType, ItemType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Joyride, Step, EventData, STATUS } from 'react-joyride';
import { updateDoc } from 'firebase/firestore';

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
  const [category, setCategory] = useState('');
  const [neededParticipants, setNeededParticipants] = useState(3);
  const [reachTypes, setReachTypes] = useState<KulaReachType[]>(initialCircleId ? ['SPECIFIC_CIRCLES'] : ['VICINITY']);
  const [targetCircles, setTargetCircles] = useState<string[]>(initialCircleId ? [initialCircleId] : []);
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [shareLocation, setShareLocation] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.hasCompletedOnboarding && !profile?.hasCompletedPostTour) {
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
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

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setMedia(prev => [...prev, { url, type: file.type.startsWith('video') ? 'video' : 'image' }]);
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !description) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'items'), {
        ownerId: user.uid,
        ownerName: profile.displayName,
        ownerIsOrganization: profile.isOrganization || false,
        ownerPhoto: profile.photoURL,
        title,
        description,
        type,
        category,
        status: 'ACTIVE',
        circleId: initialCircleId || null,
        location: shareLocation ? location : null,
        isFeatured: false,
        reachTypes,
        targetCircles: reachTypes.includes('SPECIFIC_CIRCLES') ? targetCircles : [],
        participants: [],
        neededParticipants: type === 'IMECE' ? neededParticipants : 0,
        images: media.filter(m => m.type === 'image').map(m => m.url),
        videos: media.filter(m => m.type === 'video').map(m => m.url),
        createdAt: serverTimestamp(),
        expiresAt: ['ASK', 'SHARE'].includes(type) && expiresAt ? new Date(expiresAt) : null,
        eventTime: ['JOIN', 'IMECE', 'MISSION'].includes(type) && eventTime ? new Date(eventTime) : null,
        eventEndTime: ['JOIN', 'IMECE', 'MISSION'].includes(type) && eventEndTime ? new Date(eventEndTime) : null
      });
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

        <h2 className="serif text-3xl font-bold text-[--color-brand]">Create Entry</h2>
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
          {(['SHARE', 'ASK', 'JOIN', 'IMECE', 'MISSION'] as const)
            .filter(t => t !== 'MISSION' || profile?.isOrganization)
            .map(t => (
            <button
              key={t}
              id={`tour-post-${t.toLowerCase()}`}
              type="button"
              onClick={() => setType(t)}
              className={`flex-shrink-0 px-6 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 flex items-center gap-2 ${
                type === t 
                  ? t === 'MISSION' 
                    ? 'bg-indigo-900 text-white border-indigo-900 shadow-lg scale-105'
                    : t === 'JOIN'
                    ? 'bg-teal-900 text-white border-teal-900 shadow-lg scale-105'
                    : 'bg-stone-900 text-white border-stone-900 shadow-lg scale-105' 
                  : 'bg-white text-stone-400 border-stone-100'
              }`}
            >
              {t === 'SHARE' && 'Giving'}
              {t === 'ASK' && 'Asking'}
              {t === 'IMECE' && 'İmece'}
              {t === 'MISSION' && 'Mission'}
              {t === 'JOIN' && 'Join'}
              {t === 'IMECE' && <HeartHandshake size={14} />}
              {t === 'MISSION' && <Shield size={14} className="text-indigo-400" />}
              {t === 'JOIN' && <Users size={14} className="text-teal-400" />}
            </button>
          ))}
        </div>

        {type === 'JOIN' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-5 bg-teal-50 rounded-[2rem] border-2 border-teal-100 space-y-2"
          >
            <div className="flex items-center gap-2 text-teal-900">
              <Users size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Gathering & Event</span>
            </div>
            <p className="text-[10px] text-teal-600 italic">"Join" is for casual meetups, events, or activities (like 'Going for a run' or 'Coffee chat') where anyone can participate.</p>
          </motion.div>
        )}

        {type === 'MISSION' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-5 bg-indigo-50 rounded-[2rem] border-2 border-indigo-100 space-y-2"
          >
            <div className="flex items-center gap-2 text-indigo-900">
              <Shield size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Organization Mission</span>
            </div>
            <p className="text-[10px] text-indigo-600 italic">"Missions" are for organizations seeking volunteers, cleanup help, or specific community actions.</p>
          </motion.div>
        )}

        {type === 'IMECE' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-5 bg-amber-50 rounded-[2rem] border-2 border-amber-100 space-y-3"
          >
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Neighbors needed</span>
              <span className="text-xl serif font-bold text-amber-900">{neededParticipants} hands</span>
            </div>
            <input 
              type="range" 
              min="2" 
              max="20" 
              value={neededParticipants}
              onChange={(e) => setNeededParticipants(parseInt(e.target.value))}
              className="w-full accent-amber-600 h-2 bg-amber-200 rounded-full appearance-none outline-none"
            />
            <p className="text-[10px] text-amber-600 italic">"İmece" is for collaborative tasks where many hands make light work.</p>
          </motion.div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">What is it?</label>
            <input 
              type="text" 
              placeholder="e.g. Garden tools, Fresh cake, Math tutoring..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border-b-2 border-stone-200 px-2 py-4 text-xl serif focus:border-[--color-brand] outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Tell more</label>
            <textarea 
              placeholder="Describe the item or your need in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-white border-b-2 border-stone-200 px-2 py-4 text-stone-600 focus:border-[--color-brand] outline-none transition-colors overflow-hidden"
              required
            />
          </div>

          {['ASK', 'SHARE'].includes(type) && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Available Until (Optional)</label>
              <input 
                type="date" 
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-stone-50 rounded-2xl px-4 py-4 text-stone-600 focus:ring-2 focus:ring-[--color-brand] outline-none transition-all"
              />
            </div>
          )}

          {['JOIN', 'IMECE', 'MISSION'].includes(type) && (
            <div className="space-y-4 bg-stone-50 p-4 rounded-3xl">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">When does it start? (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full bg-white rounded-2xl px-4 py-3 text-stone-600 border border-stone-200 focus:ring-2 focus:ring-[--color-brand] outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">When does it end? (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                  className="w-full bg-white rounded-2xl px-4 py-3 text-stone-600 border border-stone-200 focus:ring-2 focus:ring-[--color-brand] outline-none transition-all"
                />
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
            <div className={`flex items-center justify-between px-4 py-4 rounded-3xl border transition-all ${
              shareLocation 
                ? 'bg-white border-[--color-brand] shadow-sm' 
                : 'bg-stone-50 border-stone-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-all ${
                  shareLocation ? 'bg-[--color-brand] text-white' : 'bg-stone-200 text-stone-400'
                }`}>
                  <MapPin size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest text-stone-900">Pin to Map</span>
                  <span className="text-[9px] text-stone-400 font-bold uppercase tracking-tight">
                    {isLocationMandatory 
                      ? 'Required for Local Resonance' 
                      : shareLocation 
                        ? 'Discovery Map Enabled' 
                        : 'Feed Only (Privacy Mode)'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isLocationMandatory}
                onClick={() => setShareLocation(!shareLocation)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  shareLocation ? 'bg-[--color-brand]' : 'bg-stone-300'
                } ${isLocationMandatory ? 'opacity-50' : ''}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
                  shareLocation ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>

            <div className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] transition-all border ${
              shareLocation 
                ? location 
                  ? 'bg-green-50 text-green-600 border-green-100' 
                  : 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-stone-100 text-stone-400 border-stone-100'
            }`}>
              {shareLocation ? (
                location ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    Precise Discovery Active
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                    Acquiring Signal...
                  </>
                )
              ) : (
                <>
                  <Shield size={10} />
                  Location Shielded
                </>
              )}
            </div>

            {!shareLocation && !isLocationMandatory && (
              <p className="text-[9px] text-stone-400 px-4 text-center leading-relaxed font-medium">
                Your post will appear in Circle feeds but will be <span className="text-stone-600 font-bold">invisible</span> on the neighborhood radar and discovery maps.
              </p>
            )}
          </div>
        </div>

        <button 
          type="submit"
          disabled={submitting || !title || !description || (isLocationMandatory && !location)}
          className="w-full py-6 bg-stone-900 text-white rounded-[2rem] font-bold text-lg shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {submitting ? 'Sharing...' : initialCircleId ? 'Share with Circle & More' : 'Share with Community'}
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
