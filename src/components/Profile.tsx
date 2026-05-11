import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Star, Award, MapPin, Heart, Settings, Tag, Clock, CheckCircle2, Globe, Shield, Target, Sparkles, Languages, X, Users, Instagram } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, writeBatch, serverTimestamp, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { Item } from '../types';
import SeedData from './SeedData';
import TrustMosaicComponent from './TrustMosaic';

const userNames = [
  "Alice Chen", "Bob Miller", "Chloe Smith", "David Park", "Elena Rodriguez",
  "Frank Wilson", "Grace Lee", "Henry Taylor", "Isabella White", "Jack Thompson"
];

const sharedItems = ["Hammer", "Lawn Mower", "Drill", "Ladder", "Pressure Washer", "Stand Mixer", "Camping Tent"];
const needsResources = ["Sugar for baking", "Help moving a sofa", "recommendation for a plumber", "Plant watering"];
const bios = ["Art teacher who loves gardening.", "Software engineer with tools.", "Retiree who enjoys baking."];

const berlinLocations = [
  { lat: 52.5316, lng: 13.3817 }, // Mitte
  { lat: 52.5158, lng: 13.4540 }, // Friedrichshain-Kreuzberg
  { lat: 52.5669, lng: 13.4244 }, // Pankow
  { lat: 52.4988, lng: 13.2843 }, // Charlottenburg-Wilmersdorf
  { lat: 52.5348, lng: 13.1975 }, // Spandau
  { lat: 52.4292, lng: 13.2289 }, // Steglitz-Zehlendorf
  { lat: 52.4844, lng: 13.3444 }, // Tempelhof-Schöneberg
  { lat: 52.4811, lng: 13.4350 }, // Neukölln
  { lat: 52.4418, lng: 13.5786 }, // Treptow-Köpenick
  { lat: 52.5398, lng: 13.5606 }, // Marzahn-Hellersdorf
  { lat: 52.5152, lng: 13.4975 }, // Lichtenberg
  { lat: 52.5857, lng: 13.3276 }  // Reinickendorf
];

interface ItemRowProps {
  item: Item;
  isParticipation?: boolean;
  key?: any;
}

function ItemRow({ item, isParticipation }: ItemRowProps) {
  return (
    <div className={`p-4 border rounded-2xl flex items-center gap-4 group hover:shadow-md transition-all ${
      item.type === 'IMECE' ? 'bg-amber-50/30 border-amber-100' : 
      item.type === 'MISSION' ? 'bg-indigo-50/30 border-indigo-100' : 
      item.type === 'JOIN' ? 'bg-teal-50/30 border-teal-100' : 'bg-white border-stone-100'
    }`}>
      <div className="w-16 h-16 bg-stone-50 rounded-xl flex-shrink-0 relative overflow-hidden">
        {item.images?.[0] ? (
          <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-200">
            {item.type === 'IMECE' ? <Heart size={20} className="text-amber-300" /> : 
             item.type === 'MISSION' ? <Shield size={20} className="text-indigo-300" /> : 
             item.type === 'JOIN' ? <Users size={20} className="text-teal-300" /> : <Tag size={20} />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-sm truncate ${
          item.type === 'IMECE' ? 'text-amber-900' : 
          item.type === 'MISSION' ? 'text-indigo-900' : 
          item.type === 'JOIN' ? 'text-teal-900' : 'text-stone-900'
        }`}>
          {item.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            item.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 
            item.status === 'MATCHED' ? 'bg-amber-100 text-amber-600' : 
            'bg-stone-100 text-stone-500'
          }`}>
            {item.status}
          </span>
          {isParticipation && (
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-stone-900 text-white">
              Joined
            </span>
          )}
        </div>
      </div>
      <div className={`${isParticipation || item.status === 'COMPLETED' ? 'text-green-500' : 'text-stone-300'} group-hover:text-[--color-brand] transition-colors`}>
        <CheckCircle2 size={20} />
      </div>
    </div>
  );
}
export default function Profile({ 
  onRestartOnboarding,
  onSeedComplete 
}: { 
  onRestartOnboarding?: () => void,
  onSeedComplete?: () => void
}) {
  const { user, profile, logout } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [filter, setFilter] = useState<'SHARE' | 'ASK' | 'IMECE' | 'MISSION' | 'JOIN'>('SHARE');
  const [joinedImece, setJoinedImece] = useState<Item[]>([]);
  const [loadingJoined, setLoadingJoined] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [updatingReach, setUpdatingReach] = useState(false);
  const [updatingOrg, setUpdatingOrg] = useState(false);
  const [updatingLang, setUpdatingLang] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const [newName, setNewName] = useState(profile.displayName || '');
  const [updatingInstagram, setUpdatingInstagram] = useState(false);
  const [newInstagram, setNewInstagram] = useState(profile.instagramHandle || '');
  const [newLookoutFor, setNewLookoutFor] = useState(profile.lookoutFor?.join(', ') || '');
  const [newThePersonFor, setNewThePersonFor] = useState(profile.thePersonFor?.join(', ') || '');
  
  const [updatingTags, setUpdatingTags] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  
  const [myGuests, setMyGuests] = useState<any[]>([]);
  const [hostCodeInput, setHostCodeInput] = useState('');
  const [updatingHost, setUpdatingHost] = useState(false);
  const [hostError, setHostError] = useState('');
  const [hostSuccess, setHostSuccess] = useState('');

  const updateProfileName = async () => {
    if (!user || !newName.trim()) return;
    setUpdatingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName.trim()
      });
    } catch (err) {
      console.error('Failed to update name:', err);
    } finally {
      setUpdatingName(false);
    }
  };

  const updateInstagramHandle = async () => {
    if (!user) return;
    setUpdatingInstagram(true);
    try {
      let handle = newInstagram.trim();
      if (handle.startsWith('@')) handle = handle.substring(1);
      
      await updateDoc(doc(db, 'users', user.uid), {
        instagramHandle: handle
      });
    } catch (err) {
      console.error('Failed to update Instagram handle:', err);
    } finally {
      setUpdatingInstagram(false);
    }
  };

  const updateTags = async () => {
    if (!user) return;
    setUpdatingTags(true);
    try {
      const parsedLookout = newLookoutFor.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 20);
      const parsedPersonFor = newThePersonFor.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 20);
      await updateDoc(doc(db, 'users', user.uid), {
        lookoutFor: parsedLookout,
        thePersonFor: parsedPersonFor
      });
    } catch (err) {
      console.error('Failed to update tags:', err);
    } finally {
      setUpdatingTags(false);
    }
  };

  const removeAdvancedRule = async (id: string, mode: 'lookout'|'standby') => {
    if (!user) return;
    try {
      const updates: any = {};
      if (mode === 'lookout' && profile.lookoutRules) {
        updates.lookoutRules = profile.lookoutRules.filter(r => r.id !== id);
      } else if (mode === 'standby' && profile.standbyRules) {
        updates.standbyRules = profile.standbyRules.filter(r => r.id !== id);
      }
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (err) {
      console.error('Failed to remove rule:', err);
    }
  };

  const updateLanguage = async (lang: string) => {
    if (!user) return;
    setUpdatingLang(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        preferredLanguage: lang
      });
    } catch (err) {
      console.error('Failed to update language:', err);
    } finally {
      setUpdatingLang(false);
    }
  };

  const toggleOrganization = async () => {
    if (!user || !profile) return;
    setUpdatingOrg(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isOrganization: !profile.isOrganization,
        orgType: !profile.isOrganization ? 'SHELTER' : null,
        isVerified: !profile.isOrganization // Auto-verify for prototype
      });
    } catch (err) {
      console.error('Failed to update org status:', err);
    } finally {
      setUpdatingOrg(false);
    }
  };

  const restartOnboarding = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hasCompletedOnboarding: false,
        hasCompletedInteractiveTour: false,
        hasCompletedSearchTour: false,
        hasCompletedPostTour: false
      });
      setShowSettings(false);
      if (onRestartOnboarding) {
        onRestartOnboarding();
      }
    } catch (err) {
      console.error('Failed to restart onboarding:', err);
    }
  };

  const updateDefaultReach = async (reach: any) => {
    if (!user) return;
    setUpdatingReach(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        defaultReach: [reach]
      });
    } catch (err) {
      console.error('Failed to update reach:', err);
    } finally {
      setUpdatingReach(false);
    }
  };

  const seedData = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          userDisplayName: profile?.displayName,
          userPhoto: profile?.photoURL,
          count: 5
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed via backend');
      }

      setSeedMessage('Data seeded via backend securely!');
      setTimeout(() => setSeedMessage(''), 3000);
    } catch (error) {
      console.error('Seeding failed:', error);
      setSeedMessage('Seeding failed. Check console.');
      setTimeout(() => setSeedMessage(''), 3000);
    } finally {
      setSeeding(false);
    }
  };

  const applyHostCode = async () => {
    if (!user || !hostCodeInput.trim()) return;
    setUpdatingHost(true);
    setHostError('');
    setHostSuccess('');
    try {
      const q = query(collection(db, 'users'), where('inviteCode', '==', hostCodeInput.trim().toUpperCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setHostError('Invite code not found.');
        setUpdatingHost(false);
        return;
      }
      
      const hostDoc = snap.docs[0];
      if (hostDoc.id === user.uid) {
        setHostError('You cannot be your own host.');
        setUpdatingHost(false);
        return;
      }

      await updateDoc(doc(db, 'users', user.uid), {
        hostId: hostDoc.id,
        hostStatus: 'PENDING'
      });
      setHostSuccess(`Host request sent to ${hostDoc.data().displayName}! Waiting for approval.`);
      setHostCodeInput('');
    } catch (err) {
      console.error('Failed to set host code:', err);
      setHostError('Failed to apply code.');
    } finally {
      setUpdatingHost(false);
    }
  };

  const approveGuest = async (guestUid: string) => {
    try {
      await updateDoc(doc(db, 'users', guestUid), {
        hostStatus: 'APPROVED'
      });
    } catch (err) {
      console.error('Failed to approve guest:', err);
    }
  };

  const removeHost = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hostId: null,
        hostStatus: 'NONE'
      });
    } catch (err) {
      console.error('Failed to remove host:', err);
    }
  };

  const [hostProfile, setHostProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch my guests
    const guestsQ = query(collection(db, 'users'), where('hostId', '==', user.uid));
    const unsubGuests = onSnapshot(guestsQ, (snapshot) => {
      setMyGuests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch my host profile if I have one
    if (profile?.hostId) {
      const unsubHost = onSnapshot(doc(db, 'users', profile.hostId), (docSnap) => {
        if (docSnap.exists()) {
          setHostProfile({ id: docSnap.id, ...docSnap.data() });
        } else {
          setHostProfile(null);
        }
      });
      return () => {
        unsubGuests();
        unsubHost();
      };
    }

    return () => unsubGuests();
  }, [user, profile?.hostId]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'items'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      fetchedItems.sort((a, b) => {
         const timeA = a.createdAt?.toMillis?.() || 0;
         const timeB = b.createdAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setItems(fetchedItems);
      setLoadingItems(false);
    });

    const joinedQ = query(
      collection(db, 'items'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribeJoined = onSnapshot(joinedQ, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      fetched.sort((a, b) => {
         const timeA = a.createdAt?.toMillis?.() || 0;
         const timeB = b.createdAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setJoinedImece(fetched);
      setLoadingJoined(false);
    }, (err) => {
      console.error('Error fetching joined imece:', err);
      // If error (missing index), fallback
      setLoadingJoined(false);
    });

    return () => {
      unsubscribe();
      unsubscribeJoined();
    };
  }, [user]);

  if (!profile) return null;

  const filteredItems = items.filter(item => item.type === filter);

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div className="w-24 h-24 bg-stone-100 rounded-3xl overflow-hidden border-2 border-stone-50 shadow-inner">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-bold">
                {profile.displayName.charAt(0)}
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-colors shadow-lg"
          >
            <Settings size={20} />
          </button>
        </div>

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh] animate-in fade-in slide-in-from-bottom-8 duration-300">
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-3 bg-stone-100 hover:bg-stone-200 rounded-2xl text-stone-600 transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="serif text-2xl font-bold text-stone-800">Settings</h3>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-800">
                    <CheckCircle2 size={18} className="text-stone-400" />
                    <h4 className="font-bold text-sm uppercase tracking-widest">Public Name</h4>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Your name or username..."
                      className="flex-1 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm focus:border-stone-900 outline-none transition-all"
                    />
                    <button 
                      onClick={updateProfileName}
                      disabled={updatingName || newName === profile.displayName}
                      className="px-6 py-3 bg-stone-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {updatingName ? '...' : 'Set'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-800">
                    <Target size={18} className="text-stone-400" />
                    <h4 className="font-bold text-sm uppercase tracking-widest">Programmable Radar</h4>
                  </div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">
                    Trigger alerts when your neighborhood needs/offers something
                  </p>
                  
                  <div className="space-y-4">
                    {/* List Existing Rules */}
                    <div className="flex flex-wrap gap-2">
                       {profile.lookoutFor?.map(tag => (
                          <span key={tag} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                            {tag} (Legacy lookout)
                          </span>
                       ))}
                       {profile.thePersonFor?.map(tag => (
                          <span key={tag} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-bold border border-purple-100 flex items-center gap-1">
                            {tag} (Legacy standby)
                          </span>
                       ))}
                       {profile.lookoutRules?.map(r => (
                          <span key={r.id} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                            {r.privacy === 'PRIVATE' && <Shield size={10} className="text-emerald-500" />}
                            Lookout: {r.type !== 'ALL' && <span className="bg-emerald-200 px-1 rounded">{r.type}</span>} {r.keyword} 
                            {r.reachTypes?.includes('VICINITY') ? ` (${r.radius}km)` : r.reachTypes?.includes('ALL_CIRCLES') ? ' (All Circles)' : ' (Spec. Circle)'}
                            <button onClick={() => removeAdvancedRule(r.id, 'lookout')} className="p-0.5 hover:bg-emerald-200 rounded-full"><X size={12}/></button>
                          </span>
                       ))}
                       {profile.standbyRules?.map(r => (
                          <span key={r.id} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-bold border border-purple-100 flex items-center gap-1">
                            {r.privacy === 'PRIVATE' && <Shield size={10} className="text-purple-500" />}
                            Standby: {r.keyword} 
                            {r.reachTypes?.includes('VICINITY') ? ` (${r.radius}km)` : r.reachTypes?.includes('ALL_CIRCLES') ? ' (All Circles)' : ' (Spec. Circle)'}
                            <button onClick={() => removeAdvancedRule(r.id, 'standby')} className="p-0.5 hover:bg-purple-200 rounded-full"><X size={12}/></button>
                          </span>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-800">
                    <Instagram size={18} className="text-stone-400" />
                    <h4 className="font-bold text-sm uppercase tracking-widest">Instagram Handle</h4>
                  </div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">
                    Let neighbors find you on Instagram (Link in Bio)
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newInstagram}
                      onChange={(e) => setNewInstagram(e.target.value)}
                      placeholder="@yourhandle"
                      className="flex-1 bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 text-sm focus:border-stone-900 outline-none transition-all"
                    />
                    <button 
                      onClick={updateInstagramHandle}
                      disabled={updatingInstagram || (newInstagram.replace('@', '') || '') === (profile.instagramHandle || '')}
                      className="px-6 py-3 bg-stone-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {updatingInstagram ? '...' : 'Set'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-800">
                    <Languages size={18} className="text-stone-400" />
                    <h4 className="font-bold text-sm uppercase tracking-widest">Language preference</h4>
                  </div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">
                    Translation will target this language
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'English', label: 'English' },
                      { id: 'Turkish', label: 'Türkçe' },
                      { id: 'Spanish', label: 'Español' },
                      { id: 'German', label: 'Deutsch' },
                      { id: 'French', label: 'Français' }
                    ].map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => updateLanguage(lang.id)}
                        disabled={updatingLang}
                        className={`px-4 py-3 rounded-2xl border-2 flex items-center gap-2 transition-all ${
                          profile.preferredLanguage === lang.id || (!profile.preferredLanguage && lang.id === 'English')
                            ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                            : 'border-stone-50 bg-stone-50 text-stone-400 hover:border-stone-200'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{lang.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-800">
                    <Target size={18} className="text-stone-400" />
                    <h4 className="font-bold text-sm uppercase tracking-widest">Reach Preferences</h4>
                  </div>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">
                    Default sharing scope for your posts
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'VICINITY', title: 'Your Neighborhood', desc: 'Visible to everyone in your neighborhood', icon: Globe },
                      { id: 'SPECIFIC_CIRCLES', title: 'Your Circles', desc: 'Manually select circles for each post', icon: Target }
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => updateDefaultReach(option.id)}
                        disabled={updatingReach}
                        className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${
                          (Array.isArray(profile.defaultReach) ? profile.defaultReach : [profile.defaultReach]).includes(option.id as any)
                            ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                            : 'border-stone-50 bg-stone-50 text-stone-400 hover:border-stone-200'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${
                          (Array.isArray(profile.defaultReach) ? profile.defaultReach : [profile.defaultReach]).includes(option.id as any)
                            ? 'bg-white/20 text-white'
                            : 'bg-stone-100 text-stone-400'
                        }`}>
                          <option.icon size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{option.title}</span>
                          <span className={`text-[9px] font-medium leading-tight ${
                            (Array.isArray(profile.defaultReach) ? profile.defaultReach : [profile.defaultReach]).includes(option.id as any)
                              ? 'text-white/60'
                              : 'text-stone-400'
                          }`}>
                            {option.desc}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={() => {
                      toggleOrganization();
                      setShowSettings(false);
                    }}
                    disabled={updatingOrg}
                    className={`w-full py-4 border-2 rounded-[1.5rem] font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${
                      profile.isOrganization 
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
                        : 'bg-stone-50 border-stone-100 text-stone-600'
                    }`}
                  >
                    <Shield size={16} />
                    {profile.isOrganization ? 'Switch to Individual Profile' : 'Register as Organization'}
                  </button>

                  <div className="flex flex-col gap-2">
                    <SeedData onComplete={onSeedComplete} />
                    {seedMessage && (
                      <div className={`text-center text-xs font-bold ${seedMessage.includes('failed') ? 'text-red-500' : 'text-green-500'}`}>
                        {seedMessage}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={restartOnboarding}
                    className="w-full py-4 border-2 rounded-[1.5rem] font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all bg-stone-50 border-stone-100 text-stone-600 hover:bg-stone-100"
                  >
                    <Sparkles size={16} />
                    Restart Welcome Tour
                  </button>

                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-5 bg-stone-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:bg-stone-800 transition-all mt-4"
                  >
                    Save & Back to Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="serif text-4xl font-bold text-stone-900 leading-none">{profile.displayName}</h2>
            {profile.isOrganization && (
              <Shield size={20} className="text-indigo-600 fill-indigo-50" />
            )}
          </div>
          <div className="flex items-center gap-2 text-stone-400 font-bold text-[10px] uppercase tracking-widest">
            {profile.isOrganization ? (
              <>
                <MapPin size={12} className="text-indigo-600" />
                <span className="text-indigo-600">Verified Organization • {profile.orgType}</span>
              </>
            ) : (
              <>
                <MapPin size={12} className="text-[--color-brand]" />
                <span>Local Neighbor</span>
              </>
            )}
          </div>
        </div>

        <p className="text-stone-500 italic leading-relaxed">
          {profile.bio || "Sharing resources, building community. Here to give what I can and ask for what I need."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 py-2">
          <button
            onClick={() => {
              const url = `${window.location.origin}/?u=${profile.instagramHandle || user.uid}`;
              navigator.clipboard.writeText(url);
              alert('Link copied to clipboard!\n\n' + url);
            }}
            className="flex-1 px-4 py-3 bg-stone-900 text-white rounded-2xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest shadow-md hover:bg-stone-800 transition-all"
          >
            <Globe size={16} />
            Copy "Link In Bio"
          </button>
          
          <button
            onClick={() => {
              window.open(`/?u=${profile.instagramHandle || user.uid}`, '_blank');
            }}
            className="flex-1 px-4 py-3 bg-stone-100 text-stone-900 rounded-2xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest hover:bg-stone-200 transition-all"
          >
            Preview Public Page
          </button>
        </div>

        {((profile.lookoutFor?.length || 0) > 0 || (profile.thePersonFor?.length || 0) > 0 || (profile.lookoutRules?.length || 0) > 0 || (profile.standbyRules?.length || 0) > 0) && (
          <div className="space-y-6 w-full text-left py-2">
            {((profile.lookoutFor?.length || 0) > 0 || (profile.lookoutRules?.length || 0) > 0) && (
              <div className="bg-emerald-50 rounded-[2rem] p-6 sm:p-8 border border-emerald-100/50">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800 mb-4">
                  <Target size={16} /> On the Lookout For...
                </h4>
                <div className="flex flex-wrap gap-3">
                  {profile.lookoutFor?.map((item, i) => (
                    <span key={i} className="px-5 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-full shadow-sm border border-emerald-100">
                      {item}
                    </span>
                  ))}
                  {profile.lookoutRules?.map(r => (
                    <span key={r.id} className="px-5 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-full shadow-sm border border-emerald-100 flex items-center gap-2">
                      {r.privacy === 'PRIVATE' && <Shield size={14} className="text-emerald-500" />}
                      {r.type !== 'ALL' && <span className="bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{r.type}</span>}
                      {r.keyword} <span className="text-emerald-400 font-medium text-xs">{r.reachTypes?.includes('VICINITY') ? `(${r.radius}km)` : r.reachTypes?.includes('ALL_CIRCLES') ? '(All Circles)' : '(Spec. Circle)'}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {((profile.thePersonFor?.length || 0) > 0 || (profile.standbyRules?.length || 0) > 0) && (
              <div className="bg-purple-50 rounded-[2rem] p-6 sm:p-8 border border-purple-100/50">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-800 mb-4">
                  <Sparkles size={16} /> I am the person for...
                </h4>
                <div className="flex flex-wrap gap-3">
                  {profile.thePersonFor?.map((item, i) => (
                    <span key={i} className="px-5 py-2.5 bg-white text-purple-700 font-bold text-sm rounded-full shadow-sm border border-purple-100">
                      {item}
                    </span>
                  ))}
                  {profile.standbyRules?.map(r => (
                    <span key={r.id} className="px-5 py-2.5 bg-white text-purple-700 font-bold text-sm rounded-full shadow-sm border border-purple-100 flex items-center gap-2">
                      {r.privacy === 'PRIVATE' && <Shield size={14} className="text-purple-500" />}
                      {r.keyword} <span className="text-purple-400 font-medium text-xs">{r.reachTypes?.includes('VICINITY') ? `(${r.radius}km)` : r.reachTypes?.includes('ALL_CIRCLES') ? '(All Circles)' : '(Spec. Circle)'}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <TrustMosaicComponent
          userId={user.uid}
          mosaic={profile.trustMosaic}
          memberSince={profile.createdAt}
        />

        {/* Invitation Network Section */}
        <div className="bg-stone-50 rounded-[2rem] p-6 border border-stone-100">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-stone-800 mb-4">
            <Users size={18} className="text-[#c1a077]" /> My Network
          </h3>
          
          <div className="space-y-6">
            {/* My Invite Code */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">My Invite Code</h4>
                <div className="text-xl font-mono font-bold tracking-widest text-stone-800">
                  {profile.inviteCode || 'N/A'}
                </div>
              </div>
              <button 
                onClick={() => {
                  if (profile.inviteCode) {
                    navigator.clipboard.writeText(profile.inviteCode);
                  }
                }}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-bold text-stone-600 transition-colors uppercase tracking-widest"
              >
                Copy
              </button>
            </div>

            {/* My Host */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Invited By (My Host)</h4>
              
              {!profile.hostId || profile.hostStatus === 'NONE' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={hostCodeInput}
                      onChange={(e) => setHostCodeInput(e.target.value)}
                      placeholder="Enter invite code..."
                      className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-stone-400 outline-none uppercase transition-all"
                    />
                    <button 
                      onClick={applyHostCode}
                      disabled={updatingHost || !hostCodeInput.trim()}
                      className="px-4 py-2 bg-[#c1a077] hover:bg-[#b08f65] text-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm disabled:opacity-50 transition-colors"
                    >
                      {updatingHost ? '...' : 'Apply'}
                    </button>
                  </div>
                  {hostError && <p className="text-xs text-red-500 font-medium">{hostError}</p>}
                  {hostSuccess && <p className="text-xs text-emerald-600 font-medium">{hostSuccess}</p>}
                </div>
              ) : (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-stone-100 rounded-full overflow-hidden flex-shrink-0">
                      {hostProfile?.photoURL ? (
                        <img src={hostProfile.photoURL} alt={hostProfile.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm font-bold">
                          {hostProfile?.displayName?.charAt(0) || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-stone-800">{hostProfile?.displayName || 'Loading...'}</div>
                      <div className={`text-[10px] font-black uppercase tracking-widest ${profile.hostStatus === 'APPROVED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {profile.hostStatus === 'APPROVED' ? 'Approved' : 'Pending Approval'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={removeHost}
                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove Host"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* My Guests */}
            {myGuests.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">People I Invited</h4>
                <div className="space-y-2">
                  {myGuests.map(guest => (
                    <div key={guest.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 rounded-full overflow-hidden flex-shrink-0">
                          {guest.photoURL ? (
                            <img src={guest.photoURL} alt={guest.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400 text-sm font-bold">
                              {guest.displayName?.charAt(0) || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-stone-800">{guest.displayName}</div>
                          <div className={`text-[10px] font-black uppercase tracking-widest ${guest.hostStatus === 'APPROVED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {guest.hostStatus === 'APPROVED' ? 'Approved' : 'Needs Approval'}
                          </div>
                        </div>
                      </div>
                      
                      {guest.hostStatus !== 'APPROVED' && (
                        <button 
                          onClick={() => approveGuest(guest.id)}
                          className="px-4 py-2 bg-stone-900 text-white hover:bg-stone-800 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="serif text-xl font-bold text-stone-800">Your Activity</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: 'SHARE', label: 'My Giveaways' },
              { id: 'ASK', label: 'My Needs' },
              { id: 'IMECE', label: 'My İmece' },
              { id: 'MISSION', label: 'My Missions' },
              { id: 'JOIN', label: 'My Joins' }
            ].map(opt => (
              <button 
                key={opt.id}
                onClick={() => setFilter(opt.id as any)}
                className={`flex-shrink-0 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  filter === opt.id ? 'bg-stone-900 text-white shadow-lg' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 pb-4">
            {loadingItems ? (
              <div className="py-10 text-center text-stone-300 italic text-sm">Loading your treasures...</div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map(item => (
                <ItemRow key={item.id} item={item} />
              ))
            ) : (
              <div className="py-10 text-center text-stone-400 font-serif italic text-sm border-2 border-dashed border-stone-100 rounded-[2rem]">
                No {filter === 'SHARE' ? 'giveaways' : filter === 'ASK' ? 'needs' : filter === 'IMECE' ? 'İmece posts' : filter === 'JOIN' ? 'joins' : 'missions'} created yet.
              </div>
            )}
          </div>

          {joinedImece.filter(item => item.type === filter).length > 0 && (
            <div className="space-y-4 pt-4 border-t-2 border-stone-100 mt-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Participating In</h4>
              <div className="space-y-3 pb-8">
                {joinedImece.filter(item => item.type === filter).map(item => (
                  <ItemRow key={item.id} item={item} isParticipation />
                ))}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={logout}
          className="w-full py-4 border-2 border-stone-200 rounded-3xl text-red-500 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-200 transition-all mb-20"
        >
          <LogOut size={16} />
          Leave the journey
        </button>
      </div>
    </div>
  );
}
