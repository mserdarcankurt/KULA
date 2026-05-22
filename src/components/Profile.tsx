/**
 * FILE: Profile.tsx
 * ROLE IN KULA: The "Personal Dashboard" — the user's own profile, settings, and items.
 * 
 * THIS IS THE MOST COMPLEX COMPONENT. It contains:
 * 
 * 1. IDENTITY SECTION:
 *    - Avatar, name, invite code (for sharing with new users)
 *    - TrustMosaic component (growth stage visualization)
 *    - Instagram link-in-bio integration
 * 
 * 2. MY ITEMS (live queries):
 *    - Items I posted (filtered by type: SHARE/ASK/JOIN/IMECE/MISSION)
 *    - İmece I joined (items where my UID is in participants array)
 *    - Each item can be deleted (status → DELETED via updateDoc)
 * 
 * 3. HOST SYSTEM (Lineage):
 *    - Shows who invited me (hostProfile)
 *    - Shows who I invited (myGuests — queried by hostId == my UID)
 *    - Can approve pending guests (sets hostStatus → APPROVED)
 *    - Can change host via invite code lookup
 * 
 * 4. VOUCH SYSTEM:
 *    - Shows pending vouch requests (received)
 *    - Can accept or decline vouches
 *    - Accepted vouches create edges in the trust graph (trustGraph.ts)
 * 
 * 5. SETTINGS MODAL (showSettings):
 *    - Public Name editing
 *    - Instagram handle
 *    - Programmable Radar (lookout/standby rules)
 *    - Language preference (for AI translation target)
 *    - Default Reach (VICINITY vs SPECIFIC_CIRCLES)
 *    - Network Privacy (PUBLIC → DEGREE_1, controls visibility via trustGraph.ts)
 *    - Organization toggle (switches profile type)
 *    - Seed Data button (dev tools)
 *    - Restart Tour button
 *    - Guardian Dashboard link (dev mode)
 * 
 * ALL STATE MUTATIONS: Every setting change calls updateDoc on users/{uid}
 * directly. useAuth.tsx's onSnapshot listener picks up changes instantly.
 * 
 * CALLED BY: App.tsx (the 'profile' tab)
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Star, Award, MapPin, Heart, Settings, Tag, Clock, CheckCircle2, Globe, Shield, Target, Sparkles, Languages, X, Users, Instagram, Home, Plus, Trash2, User, Network, EyeOff } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, writeBatch, serverTimestamp, doc, updateDoc, setDoc, getDocs, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import PublicProfile from './PublicProfile';
import { Item, SavedLocation, UserPrivacySettings, TrustPrivacyLevel } from '../types';
import SeedData from './SeedData';
import TrustMosaicComponent from './TrustMosaic';
import { getFallbackImage } from '../lib/artDirection';
import { clearTrustGraphCache } from '../lib/trustGraph';
import { generateRandomizedCenter, NEIGHBORHOOD_RADIUS_OPTIONS, DEFAULT_NEIGHBORHOOD_RADIUS } from '../lib/neighborhoodPrivacy';
import AddressAutocomplete from './AddressAutocomplete';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';

// Helper component for drawing a circle on the Google Map preview
function MapCircle({ center, radius, strokeColor = '#c1a077', fillColor = '#c1a077', opacity = 0.15 }: {
  center: { lat: number; lng: number };
  radius: number;
  strokeColor?: string;
  fillColor?: string;
  opacity?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const googleObj = (window as any).google;
    if (!googleObj || !googleObj.maps) return;

    const circle = new googleObj.maps.Circle({
      map,
      center,
      radius,
      strokeColor,
      strokeOpacity: 0.8,
      strokeWeight: 1.5,
      fillColor,
      fillOpacity: opacity,
    });

    return () => {
      circle.setMap(null);
    };
  }, [map, center, radius, strokeColor, fillColor, opacity]);

  return null;
}

// Helper component for drawing a dashed path between exact home and offset center
function MapPolyline({ path, strokeColor = '#c1a077' }: {
  path: { lat: number; lng: number }[];
  strokeColor?: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || path.length < 2) return;

    const googleObj = (window as any).google;
    if (!googleObj || !googleObj.maps) return;

    const lineSymbol = {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1,
      scale: 1.5
    };

    const polyline = new googleObj.maps.Polyline({
      map,
      path,
      geodesic: true,
      strokeColor,
      strokeOpacity: 0,
      icons: [{
        icon: lineSymbol,
        offset: '0',
        repeat: '10px'
      }],
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, path, strokeColor]);

  return null;
}


interface ItemRowProps {
  item: Item;
  isParticipation?: boolean;
  key?: any;
}

function ItemRow({ item, isParticipation }: ItemRowProps) {
  return (
    <div className={`p-4 border rounded-2xl flex items-center gap-4 group hover:shadow-md transition-all ${
      item.type === 'JOIN' ? 'bg-teal-50/30 border-teal-100' : 'bg-white border-stone-100'
    }`}>
      <div className="w-16 h-16 bg-stone-50 rounded-xl flex-shrink-0 relative overflow-hidden">
        {item.images?.[0] ? (
          <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <img src={getFallbackImage(item.category)} alt={item.category || item.type} className="w-full h-full object-cover opacity-80" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-sm truncate ${
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
      {!isParticipation && item.status !== 'COMPLETED' && (
        <button 
          onClick={async (e) => {
            e.stopPropagation();
            if (window.confirm("Remove this item?")) {
              await updateDoc(doc(db, 'items', item.id), { status: 'DELETED' });
            }
          }}
          className="p-2 text-stone-300 hover:text-red-500 transition-colors"
          title="Delete Item"
        >
          <X size={16} />
        </button>
      )}
      <div className={`${isParticipation || item.status === 'COMPLETED' ? 'text-green-500' : 'text-stone-300'} group-hover:text-brand transition-colors`}>
        <CheckCircle2 size={20} />
      </div>
    </div>
  );
}
export default function Profile({ 
  onRestartOnboarding,
  onSeedComplete,
  onNavigateToGuardian,
  onNavigateToChat
}: { 
  onRestartOnboarding?: () => void,
  onSeedComplete?: () => void,
  onNavigateToGuardian?: () => void,
  onNavigateToChat?: (chatId: string) => void
}) {
  const { user, profile, logout, isGuardian, updateProfile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [filter, setFilter] = useState<'SHARE' | 'ASK' | 'JOIN'>('SHARE');
  const [joinedImece, setJoinedImece] = useState<Item[]>([]);
  const [loadingJoined, setLoadingJoined] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [updatingReach, setUpdatingReach] = useState(false);
  const [updatingOrg, setUpdatingOrg] = useState(false);
  const [updatingLang, setUpdatingLang] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
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
  const [pendingVouches, setPendingVouches] = useState<any[]>([]);
  const [acceptingVouchId, setAcceptingVouchId] = useState<string | null>(null);
  const [selectedVouchProfile, setSelectedVouchProfile] = useState<string | null>(null);

  // ── Address Book State ──
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(profile.savedLocations || []);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocLabel, setNewLocLabel] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocRadius, setNewLocRadius] = useState<number>(DEFAULT_NEIGHBORHOOD_RADIUS);
  const [savingLocation, setSavingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewCenter, setPreviewCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Edit address state variables
  const [editingLocLabel, setEditingLocLabel] = useState('');
  const [editingLocLat, setEditingLocLat] = useState('');
  const [editingLocLng, setEditingLocLng] = useState('');
  const [editingLocRadius, setEditingLocRadius] = useState<number>(DEFAULT_NEIGHBORHOOD_RADIUS);
  const [editingPreviewCenter, setEditingPreviewCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Synchronize editing offset center for settings map preview
  useEffect(() => {
    if (!editingLocationId || !editingLocLat || !editingLocLng) {
      return;
    }
    
    // Find the original location to see if coordinates or radius actually changed.
    // If they DID NOT change, keep the original neighborhood center so we don't regenerate on every character change or trivial rerender.
    const original = savedLocations.find(l => l.id === editingLocationId);
    const latNum = parseFloat(editingLocLat);
    const lngNum = parseFloat(editingLocLng);
    
    if (isNaN(latNum) || isNaN(lngNum)) return;
    
    if (original && 
        Math.abs(original.exactLocation.lat - latNum) < 1e-7 && 
        Math.abs(original.exactLocation.lng - lngNum) < 1e-7 && 
        original.neighborhoodRadius === editingLocRadius) {
      setEditingPreviewCenter(original.neighborhoodCenter);
      return;
    }

    const exactCoords = { lat: latNum, lng: lngNum };
    const center = generateRandomizedCenter(exactCoords, editingLocRadius);
    setEditingPreviewCenter(center);
  }, [editingLocLat, editingLocLng, editingLocRadius, editingLocationId, savedLocations]);


  // Synchronize preview offset center for settings map preview
  useEffect(() => {
    if (!newLocLat || !newLocLng) {
      setPreviewCenter(null);
      return;
    }
    const exactCoords = { lat: parseFloat(newLocLat), lng: parseFloat(newLocLng) };
    if (!isNaN(exactCoords.lat) && !isNaN(exactCoords.lng)) {
      const center = generateRandomizedCenter(exactCoords, newLocRadius);
      setPreviewCenter(center);
    }
  }, [newLocLat, newLocLng, newLocRadius]);

  // Keep local state in sync with profile changes
  useEffect(() => {
    setSavedLocations(profile.savedLocations || []);
  }, [profile.savedLocations]);

  const addSavedLocation = async () => {
    if (!user || !newLocLabel.trim() || !newLocLat || !newLocLng) return;
    setSavingLocation(true);
    try {
      const exactCoords = { lat: parseFloat(newLocLat), lng: parseFloat(newLocLng) };
      if (isNaN(exactCoords.lat) || isNaN(exactCoords.lng)) {
        alert('Please enter valid latitude and longitude values.');
        setSavingLocation(false);
        return;
      }
      const center = previewCenter || generateRandomizedCenter(exactCoords, newLocRadius);
      const newLoc: SavedLocation = {
        id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label: newLocLabel.trim(),
        exactLocation: exactCoords,
        neighborhoodCenter: center,
        neighborhoodRadius: newLocRadius,
        isDefault: savedLocations.length === 0, // First one is auto-default
      };
      const updated = [...savedLocations, newLoc];
      // Save private data to users_private
      await setDoc(doc(db, 'users_private', user.uid), {
        savedLocations: updated,
        ...(newLoc.isDefault ? {
          exactHomeLocation: exactCoords,
        } : {}),
      }, { merge: true });

      // Save public data to users
      await updateDoc(doc(db, 'users', user.uid), {
        ...(newLoc.isDefault ? {
          neighborhoodCenter: center,
          neighborhoodRadius: newLocRadius,
        } : {}),
      });

      setSavedLocations(updated);
      setNewLocLabel('');
      setNewLocLat('');
      setNewLocLng('');
      setPreviewCenter(null);
      setNewLocRadius(DEFAULT_NEIGHBORHOOD_RADIUS);
      setShowAddLocation(false);
    } catch (err) {
      console.error('Failed to add location:', err);
    } finally {
      setSavingLocation(false);
    }
  };

  const removeSavedLocation = async (locId: string) => {
    if (!user) return;
    const updated = savedLocations.filter(l => l.id !== locId);
    // If we removed the default, promote the first remaining
    if (updated.length > 0 && !updated.some(l => l.isDefault)) {
      updated[0].isDefault = true;
    }
    try {
      const defaultLoc = updated.find(l => l.isDefault);
      // Save private data to users_private
      await setDoc(doc(db, 'users_private', user.uid), {
        savedLocations: updated,
        exactHomeLocation: defaultLoc ? defaultLoc.exactLocation : null,
      }, { merge: true });

      // Save public data to users
      await updateDoc(doc(db, 'users', user.uid), {
        neighborhoodCenter: defaultLoc ? defaultLoc.neighborhoodCenter : null,
        neighborhoodRadius: defaultLoc ? defaultLoc.neighborhoodRadius : DEFAULT_NEIGHBORHOOD_RADIUS,
      });

      setSavedLocations(updated);
    } catch (err) {
      console.error('Failed to remove location:', err);
    }
  };

  const setDefaultLocation = async (locId: string) => {
    if (!user) return;
    const updated = savedLocations.map(l => ({ ...l, isDefault: l.id === locId }));
    const defaultLoc = updated.find(l => l.isDefault);
    try {
      if (defaultLoc) {
        // Save private data to users_private
        await setDoc(doc(db, 'users_private', user.uid), {
          savedLocations: updated,
          exactHomeLocation: defaultLoc.exactLocation,
        }, { merge: true });

        // Save public data to users
        await updateDoc(doc(db, 'users', user.uid), {
          neighborhoodCenter: defaultLoc.neighborhoodCenter,
          neighborhoodRadius: defaultLoc.neighborhoodRadius,
        });
      }
      setSavedLocations(updated);
    } catch (err) {
      console.error('Failed to set default location:', err);
    }
  };

  const saveEditedLocation = async (locId: string) => {
    if (!user || !editingLocLabel.trim() || !editingLocLat || !editingLocLng) return;
    const latNum = parseFloat(editingLocLat);
    const lngNum = parseFloat(editingLocLng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('Please enter valid coordinates.');
      return;
    }

    const updated = savedLocations.map(l => {
      if (l.id !== locId) return l;
      return {
        ...l,
        label: editingLocLabel.trim(),
        exactLocation: { lat: latNum, lng: lngNum },
        neighborhoodCenter: editingPreviewCenter || generateRandomizedCenter({ lat: latNum, lng: lngNum }, editingLocRadius),
        neighborhoodRadius: editingLocRadius,
      };
    });

    const defaultLoc = updated.find(l => l.isDefault);
    try {
      // Save private data to users_private
      await setDoc(doc(db, 'users_private', user.uid), {
        savedLocations: updated,
        ...(defaultLoc && defaultLoc.id === locId ? {
          exactHomeLocation: defaultLoc.exactLocation,
        } : {}),
      }, { merge: true });

      // Save public data to users
      await updateDoc(doc(db, 'users', user.uid), {
        ...(defaultLoc && defaultLoc.id === locId ? {
          neighborhoodCenter: defaultLoc.neighborhoodCenter,
          neighborhoodRadius: defaultLoc.neighborhoodRadius,
        } : {}),
      });

      setSavedLocations(updated);
      setEditingLocationId(null);
    } catch (err) {
      console.error('Failed to save edited location:', err);
    }
  };


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
      await updateProfile({
        hasCompletedOnboarding: false,
        onboardingStep: 'PHILOSOPHY',
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

  const updatePrivacySetting = async (field: keyof UserPrivacySettings, value: TrustPrivacyLevel) => {
    if (!user) return;
    setUpdatingVisibility(true);
    try {
      const currentSettings = profile.privacySettings || {
        profileVisibility: (profile.visibilityPreference || 'PUBLIC') as TrustPrivacyLevel,
        neighborhoodVisibility: 'PUBLIC',
        historyVisibility: 'PUBLIC',
        lineageVisibility: 'PUBLIC'
      };
      const updatedSettings = {
        ...currentSettings,
        [field]: value
      };
      
      const extraUpdates = field === 'profileVisibility' ? { 
        visibilityPreference: value === 'PRIVATE' ? 'DEGREE_1' : (value === 'PUBLIC' ? 'PUBLIC' : value)
      } : {};

      await updateDoc(doc(db, 'users', user.uid), {
        privacySettings: updatedSettings,
        ...extraUpdates
      });
    } catch (err) {
      console.error(`Failed to update privacy setting ${field}:`, err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const updateHideAsConnector = async (value: boolean) => {
    if (!user) return;
    setUpdatingVisibility(true);
    try {
      const currentSettings = profile.privacySettings || {
        profileVisibility: (profile.visibilityPreference || 'PUBLIC') as TrustPrivacyLevel,
        neighborhoodVisibility: 'PUBLIC',
        historyVisibility: 'PUBLIC',
        lineageVisibility: 'PUBLIC'
      };
      const updatedSettings = {
        ...currentSettings,
        hideAsConnector: value
      };
      
      await updateDoc(doc(db, 'users', user.uid), {
        privacySettings: updatedSettings
      });
    } catch (err) {
      console.error(`Failed to update hideAsConnector:`, err);
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const updateVisibilityPreference = async (pref: any) => {
    if (!user) return;
    setUpdatingVisibility(true);
    try {
      const currentSettings = profile.privacySettings || {
        profileVisibility: 'PUBLIC',
        neighborhoodVisibility: 'PUBLIC',
        historyVisibility: 'PUBLIC',
        lineageVisibility: 'PUBLIC'
      };
      await updateDoc(doc(db, 'users', user.uid), {
        visibilityPreference: pref,
        privacySettings: {
          ...currentSettings,
          profileVisibility: pref === 'NETWORK' ? 'DEGREE_4' : pref
        }
      });
    } catch (err) {
      console.error('Failed to update visibility:', err);
    } finally {
      setUpdatingVisibility(false);
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
      // [ALPHA] Filter out shelved types — IMECE and MISSION are distinct from JOIN
      const SHELVED_TYPES = ['IMECE', 'MISSION'];
      const activeJoined = fetched.filter(item => !SHELVED_TYPES.includes(item.type));
      activeJoined.sort((a, b) => {
         const timeA = a.createdAt?.toMillis?.() || 0;
         const timeB = b.createdAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setJoinedImece(activeJoined);
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

  // Fetch pending vouch requests (received)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'vouches'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'PENDING')
    );
    const unsub = onSnapshot(q, async (snap) => {
      const vouches: any[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        // Fetch the sender's profile
        const senderSnap = await getDoc(doc(db, 'users', data.fromUserId));
        const senderData = senderSnap.exists() ? senderSnap.data() : null;
        vouches.push({
          id: d.id,
          ...data,
          senderName: senderData?.displayName || 'A neighbor',
          senderPhoto: senderData?.photoURL || null,
        });
      }
      setPendingVouches(vouches);
    });
    return () => unsub();
  }, [user]);

  const handleAcceptVouch = async (vouchId: string, fromUserId: string) => {
    if (acceptingVouchId) return;
    setAcceptingVouchId(vouchId);
    try {
      await updateDoc(doc(db, 'vouches', vouchId), { status: 'ACCEPTED' });
      clearTrustGraphCache();
      // Notify sender
      await addDoc(collection(db, 'notifications'), {
        userId: fromUserId,
        type: 'VOUCH_ACCEPTED',
        content: `${profile.displayName} accepted your vouch! You are now connected neighbors.`,
        isRead: false,
        link: '',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to accept vouch:', err);
    } finally {
      setAcceptingVouchId(null);
    }
  };

  const handleDeclineVouch = async (vouchId: string) => {
    if (acceptingVouchId) return;
    setAcceptingVouchId(vouchId);
    try {
      await deleteDoc(doc(db, 'vouches', vouchId));
    } catch (err) {
      console.error('Failed to decline vouch:', err);
    } finally {
      setAcceptingVouchId(null);
    }
  };

  if (!profile) return null;

  const filteredItems = items.filter(item => item.type === filter);

  // --- VISIBLE UI STARTS HERE ---
  // The code below draws the profile layout: the avatar, settings gear, and the tabs for Posts/Activity.
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

                {/* ── Address Book ── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-stone-800">
                      <MapPin size={18} className="text-stone-400" />
                      <h4 className="font-bold text-sm uppercase tracking-widest">Address Book</h4>
                    </div>
                    <button
                      onClick={() => setShowAddLocation(!showAddLocation)}
                      className={`p-2 rounded-xl transition-all ${
                        showAddLocation
                          ? 'bg-stone-900 text-white rotate-45'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 font-medium leading-relaxed">
                    Save locations to quickly pin posts. Each location gets its own randomized privacy circle.
                  </p>

                  {/* Existing saved locations */}
                  {savedLocations.length > 0 ? (
                    <div className="space-y-2">
                      {savedLocations.map(loc => (
                        <div
                          key={loc.id}
                          className={`p-3 rounded-2xl border-2 transition-all ${
                            loc.isDefault
                              ? 'border-brand/30 bg-brand/5'
                              : 'border-stone-100 bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                              loc.isDefault
                                ? 'bg-brand text-white'
                                : 'bg-stone-200 text-stone-500'
                            }`}>
                              {loc.label.startsWith('Home') ? '🏠' : loc.label === 'Work' ? '💼' : loc.label.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                                {loc.label}
                                {loc.isDefault && (
                                  <span className="text-[7px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-black uppercase">Default</span>
                                )}
                              </div>
                              <div className="text-[9px] text-stone-400 font-medium">
                                {loc.neighborhoodRadius >= 1000
                                  ? `${loc.neighborhoodRadius / 1000}km privacy zone`
                                  : `${loc.neighborhoodRadius}m privacy zone`
                                }
                              </div>
                              {loc.label.startsWith('Home (') && loc.label.endsWith(')') && (
                                <div className="mt-1 text-[8px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md w-fit font-bold flex items-center gap-1">
                                  <MapPin size={10} className="text-amber-600" />
                                  <span>General area — Edit to specify address</span>
                                </div>
                              )}
                            </div>
                            {confirmDeleteId === loc.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSavedLocation(loc.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 bg-red-500 hover:bg-red-650 text-white text-[8px] font-black rounded-lg uppercase tracking-wider transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 bg-stone-150 hover:bg-stone-200 text-stone-600 text-[8px] font-black rounded-lg uppercase tracking-wider transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {!loc.isDefault && (
                                  <button
                                    onClick={() => setDefaultLocation(loc.id)}
                                    className="p-1.5 text-stone-300 hover:text-brand transition-colors" title="Set as default"
                                  >
                                    <Home size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (editingLocationId === loc.id) {
                                      setEditingLocationId(null);
                                    } else {
                                      setEditingLocationId(loc.id);
                                      setEditingLocLabel(loc.label);
                                      setEditingLocLat(loc.exactLocation.lat.toString());
                                      setEditingLocLng(loc.exactLocation.lng.toString());
                                      setEditingLocRadius(loc.neighborhoodRadius);
                                      setEditingPreviewCenter(loc.neighborhoodCenter);
                                    }
                                  }}
                                  className="p-1.5 text-stone-300 hover:text-stone-600 transition-colors" title="Edit Location"
                                >
                                  <Settings size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(loc.id);
                                  }}
                                  className="p-1.5 text-stone-300 hover:text-red-500 transition-colors" title="Remove"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Expandable address/radius editor */}
                          {editingLocationId === loc.id && (
                            <div className="mt-3 pt-3 border-t border-stone-100 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="space-y-1 text-left">
                                <label className="text-[8px] font-bold text-stone-400 uppercase">Label</label>
                                <input
                                  type="text"
                                  value={editingLocLabel}
                                  onChange={e => setEditingLocLabel(e.target.value)}
                                  placeholder="e.g. Home, Work, Parents..."
                                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-xl px-3 py-2 text-sm focus:border-stone-900 outline-none transition-all"
                                />
                              </div>

                              <div className="space-y-1 text-left">
                                <label className="text-[8px] font-bold text-stone-400 uppercase font-black">Search Address</label>
                                <AddressAutocomplete
                                  placeholder="Search a new address..."
                                  onSelect={(coords, address) => {
                                    setEditingLocLat(coords.lat.toFixed(6));
                                    setEditingLocLng(coords.lng.toFixed(6));
                                    // Prefill label if empty
                                    if (!editingLocLabel.trim()) {
                                      const shortPart = address.split(',')[0].trim();
                                      setEditingLocLabel(shortPart);
                                    }
                                  }}
                                />
                              </div>

                              <div className="text-[9px] font-bold text-stone-400 uppercase tracking-widest text-left">Privacy Radius</div>
                              <div className="flex gap-1.5">
                                {NEIGHBORHOOD_RADIUS_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setEditingLocRadius(opt.value)}
                                    className={`flex-1 py-2 px-1 rounded-xl text-center border transition-all ${
                                      editingLocRadius === opt.value
                                        ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                        : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                                    }`}
                                  >
                                    <div className="text-[10px] font-bold">{opt.label}</div>
                                  </button>
                                ))}
                              </div>

                              {/* Privacy Map Preview for Editing */}
                              {editingLocLat && editingLocLng && editingPreviewCenter && (
                                <div className="w-full h-40 rounded-2xl overflow-hidden border border-stone-200 shadow-sm relative bg-stone-50">
                                  {API_KEY ? (
                                    <Map
                                      defaultCenter={editingPreviewCenter}
                                      center={editingPreviewCenter}
                                      defaultZoom={14}
                                      gestureHandling={'cooperative'}
                                      disableDefaultUI={true}
                                      mapId={`profile_location_edit_${loc.id}`}
                                      style={{ width: '100%', height: '100%' }}
                                    >
                                      {/* Exact address (Private) */}
                                      <AdvancedMarker position={{ lat: parseFloat(editingLocLat), lng: parseFloat(editingLocLng) }}>
                                        <div className="flex flex-col items-center">
                                          <div className="bg-stone-900 text-white p-1 rounded-full shadow-md border border-white flex items-center justify-center">
                                            <Home size={10} className="text-white" />
                                          </div>
                                          <div className="text-[7px] bg-stone-900 text-stone-100 font-bold px-1 py-0.5 rounded mt-0.5 shadow-sm border border-stone-800 whitespace-nowrap">
                                            Exact Address (Private)
                                          </div>
                                        </div>
                                      </AdvancedMarker>

                                      {/* Neighborhood center (Public) */}
                                      <AdvancedMarker position={editingPreviewCenter}>
                                        <div className="flex flex-col items-center">
                                          <div className="bg-amber-500 text-white p-1 rounded-full shadow-md border border-white flex items-center justify-center">
                                            <MapPin size={10} className="text-white" />
                                          </div>
                                          <div className="text-[7px] bg-amber-500 text-white font-bold px-1 py-0.5 rounded mt-0.5 shadow-sm border border-amber-600 whitespace-nowrap">
                                            Neighborhood Center (Public)
                                          </div>
                                        </div>
                                      </AdvancedMarker>

                                      {/* Connection Line */}
                                      <MapPolyline
                                        path={[
                                          { lat: parseFloat(editingLocLat), lng: parseFloat(editingLocLng) },
                                          editingPreviewCenter
                                        ]}
                                        strokeColor="#f59e0b"
                                      />

                                      {/* Privacy Circle */}
                                      <MapCircle
                                        center={editingPreviewCenter}
                                        radius={editingLocRadius}
                                        strokeColor="#f59e0b"
                                        fillColor="#f59e0b"
                                        opacity={0.15}
                                      />
                                    </Map>
                                  ) : (
                                    <div className="flex items-center justify-center h-full p-4 text-center">
                                      <p className="text-[10px] text-stone-400 font-medium">Map Key Missing.</p>
                                    </div>
                                  )}
                                  <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-stone-200 text-[8px] text-stone-500 font-bold shadow-sm pointer-events-none">
                                    {editingLocRadius >= 1000 ? `${editingLocRadius / 1000} km radius` : `${editingLocRadius}m radius`}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingLocationId(null)}
                                  className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditedLocation(loc.id)}
                                  disabled={!editingLocLabel.trim() || !editingLocLat || !editingLocLng}
                                  className="flex-1 py-2 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-colors"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-stone-50 rounded-2xl p-4 border border-dashed border-stone-200 text-center">
                      <Home size={20} className="mx-auto text-stone-300 mb-2" />
                      <p className="text-[10px] text-stone-400 font-medium">
                        No saved locations yet. Add your home or other places to pin posts from anywhere.
                      </p>
                    </div>
                  )}

                      {/* Add new location form */}
                      {showAddLocation && (
                        <div className="bg-white rounded-2xl p-4 border-2 border-stone-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="text-[9px] font-black text-stone-400 uppercase tracking-widest">New Location</div>
                          
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-stone-400 uppercase">Label</label>
                            <input
                              type="text"
                              value={newLocLabel}
                              onChange={e => setNewLocLabel(e.target.value)}
                              placeholder="e.g. Home, Work, Parents..."
                              className="w-full bg-stone-50 border-2 border-stone-100 rounded-xl px-3 py-2.5 text-sm focus:border-stone-900 outline-none transition-all"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-stone-400 uppercase font-black">Search Address</label>
                            <AddressAutocomplete
                              placeholder="Search address (e.g. Tempelhofer Feld)..."
                              onSelect={(coords, address) => {
                                setNewLocLat(coords.lat.toFixed(6));
                                setNewLocLng(coords.lng.toFixed(6));
                                // Prefill label if it's empty, using the main part of the address (before first comma)
                                if (!newLocLabel.trim()) {
                                  const shortPart = address.split(',')[0].trim();
                                  setNewLocLabel(shortPart);
                                }
                              }}
                            />
                          </div>

                      <div className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Privacy Radius</div>
                      <div className="flex gap-1.5">
                        {NEIGHBORHOOD_RADIUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNewLocRadius(opt.value)}
                            className={`flex-1 py-2 px-1 rounded-xl text-center border transition-all ${
                              newLocRadius === opt.value
                                ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <div className="text-[10px] font-bold">{opt.label}</div>
                          </button>
                        ))}
                      </div>

                      {/* Privacy Map Preview */}
                      {newLocLat && newLocLng && previewCenter ? (
                        <div className="w-full h-44 rounded-2xl overflow-hidden border border-stone-200 shadow-sm relative bg-stone-50">
                          {API_KEY ? (
                            <Map
                              defaultCenter={previewCenter}
                              defaultZoom={14}
                              gestureHandling={'cooperative'}
                              disableDefaultUI={true}
                              mapId="profile_location_preview"
                              style={{ width: '100%', height: '100%' }}
                            >
                              {/* Exact address (Private) */}
                              <AdvancedMarker position={{ lat: parseFloat(newLocLat), lng: parseFloat(newLocLng) }}>
                                <div className="flex flex-col items-center">
                                  <div className="bg-stone-900 text-white p-1 rounded-full shadow-md border border-white flex items-center justify-center">
                                    <Home size={10} className="text-white" />
                                  </div>
                                  <div className="text-[7px] bg-stone-900 text-stone-100 font-bold px-1 py-0.5 rounded mt-0.5 shadow-sm border border-stone-800 whitespace-nowrap">
                                    Exact Address (Private)
                                  </div>
                                </div>
                              </AdvancedMarker>

                              {/* Neighborhood center (Public) */}
                              <AdvancedMarker position={previewCenter}>
                                <div className="flex flex-col items-center">
                                  <div className="bg-amber-500 text-white p-1 rounded-full shadow-md border border-white flex items-center justify-center">
                                    <MapPin size={10} className="text-white" />
                                  </div>
                                  <div className="text-[7px] bg-amber-500 text-white font-bold px-1 py-0.5 rounded mt-0.5 shadow-sm border border-amber-600 whitespace-nowrap">
                                    Neighborhood Center (Public)
                                  </div>
                                </div>
                              </AdvancedMarker>

                              {/* Connection Line */}
                              <MapPolyline
                                path={[
                                  { lat: parseFloat(newLocLat), lng: parseFloat(newLocLng) },
                                  previewCenter
                                ]}
                                strokeColor="#f59e0b"
                              />

                              {/* Privacy Circle */}
                              <MapCircle
                                center={previewCenter}
                                radius={newLocRadius}
                                strokeColor="#f59e0b"
                                fillColor="#f59e0b"
                                opacity={0.15}
                              />
                            </Map>
                          ) : (
                            <div className="flex items-center justify-center h-full p-4 text-center">
                              <p className="text-[10px] text-stone-400 font-medium">Map Key Missing. Preview Unavailable.</p>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-stone-200 text-[8px] text-stone-500 font-bold shadow-sm pointer-events-none">
                            {newLocRadius >= 1000 ? `${newLocRadius / 1000} km radius` : `${newLocRadius}m radius`}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100 flex flex-col items-center justify-center text-center">
                          <MapPin size={20} className="text-stone-300 mb-2 animate-bounce" />
                          <p className="text-[9px] text-stone-400 font-black uppercase tracking-widest">
                            Search for an address to preview map
                          </p>
                          <p className="text-[8px] text-stone-400 mt-1 max-w-[190px] leading-relaxed">
                            Your address will be offset randomly within this privacy boundary.
                          </p>
                        </div>
                      )}


                      <button
                        onClick={addSavedLocation}
                        disabled={savingLocation || !newLocLabel.trim() || !newLocLat || !newLocLng}
                        className="w-full py-3 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all"
                      >
                        {savingLocation ? 'Saving...' : 'Save Location'}
                      </button>
                    </div>
                  )}
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

                <div className="space-y-6 bg-stone-50 border border-stone-200/80 p-5 rounded-[2rem]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 text-[#C25E3B] border border-amber-100">
                      <Shield size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm uppercase tracking-widest text-stone-800 leading-none mb-1">Privacy Center</h4>
                      <p className="text-[10px] text-stone-400 font-medium">Fine-tune your trust-network boundaries.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {[
                      {
                        key: 'profileVisibility',
                        title: 'Profile Visibility',
                        desc: 'Who can see your bio, contact handles, and active trust mosaic.',
                        icon: User
                      },
                      {
                        key: 'neighborhoodVisibility',
                        title: 'Neighborhood Map',
                        desc: 'Who can see your neighborhood center pin and distance indicators.',
                        icon: MapPin
                      },
                      {
                        key: 'historyVisibility',
                        title: 'Gratitude & History',
                        desc: 'Who can see your past exchanges, reviews, and vouch footprint.',
                        icon: Heart
                      },
                      {
                        key: 'lineageVisibility',
                        title: 'Lineage Tree',
                        desc: 'Who can trace your invitations upwards or downwards in the chain.',
                        icon: Network
                      }
                    ].map(setting => {
                      const currentVal = (profile.privacySettings?.[setting.key as keyof UserPrivacySettings] || 
                        (setting.key === 'profileVisibility' ? (profile.visibilityPreference || 'PUBLIC') : 'PUBLIC')) as string;
                      
                      return (
                        <div key={setting.key} className="bg-white p-4 rounded-2xl border border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex gap-3 items-start sm:items-center">
                            <div className="p-2 rounded-xl bg-stone-50 text-stone-600 border border-stone-100 mt-1 sm:mt-0">
                              <setting.icon size={18} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-stone-800 uppercase tracking-widest leading-none mb-1">{setting.title}</span>
                              <span className="text-[10px] text-stone-400 font-medium leading-tight max-w-[280px]">{setting.desc}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <select
                              value={currentVal}
                              onChange={(e) => updatePrivacySetting(setting.key as any, e.target.value as any)}
                              disabled={updatingVisibility}
                              className="px-3 py-2 bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-[10px] font-bold uppercase tracking-wider outline-none focus:border-stone-900 focus:bg-white transition-all cursor-pointer"
                            >
                              <option value="PRIVATE">Private</option>
                              <option value="DEGREE_1">1st Connection</option>
                              <option value="DEGREE_2">2nd Connection</option>
                              <option value="DEGREE_3">3rd Connection</option>
                              <option value="DEGREE_4">4th Connection</option>
                              <option value="PUBLIC">Public</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    <div className="bg-white p-4 rounded-2xl border border-stone-100 flex items-center justify-between gap-4">
                      <div className="flex gap-3 items-center">
                        <div className="p-2 rounded-xl bg-stone-50 text-stone-600 border border-stone-100">
                          <EyeOff size={18} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-stone-800 uppercase tracking-widest leading-none mb-1">Hide as Connector</span>
                          <span className="text-[10px] text-stone-400 font-medium leading-tight max-w-[280px]">
                            Hide your name in connection paths between 3rd+ degree neighbors. You will show as "Hidden".
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={!!profile.privacySettings?.hideAsConnector}
                          onChange={(e) => updateHideAsConnector(e.target.checked)}
                          disabled={updatingVisibility}
                          className="w-4 h-4 text-stone-900 border-stone-300 rounded focus:ring-stone-900 cursor-pointer accent-stone-900"
                        />
                      </div>
                    </div>
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

                  {isGuardian && onNavigateToGuardian && (
                    <button 
                      onClick={() => {
                        setShowSettings(false);
                        onNavigateToGuardian();
                      }}
                      className="w-full py-4 border-2 border-emerald-100 bg-emerald-50 text-emerald-700 rounded-[1.5rem] font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 mt-2"
                    >
                      <Shield size={16} />
                      Guardian Dashboard
                    </button>
                  )}

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
                <MapPin size={12} className="text-brand" />
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

        {/* ── Pending Vouches Inbox ───────────────────── */}
        {pendingVouches.length > 0 && (
          <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100/50 space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800">
              <Sparkles size={16} /> Pending Vouches ({pendingVouches.length})
            </h4>
            <p className="text-[10px] text-emerald-600/70 font-medium">
              These neighbors want to vouch for you. Accepting connects you in the trust network.
            </p>
            <div className="space-y-3">
              {pendingVouches.map(v => (
                <div key={v.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-emerald-100">
                  <button
                    onClick={() => setSelectedVouchProfile(v.fromUserId)}
                    className="w-12 h-12 rounded-2xl bg-stone-100 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-emerald-300 transition-all"
                  >
                    {v.senderPhoto ? (
                      <img src={v.senderPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold text-lg">
                        {v.senderName.charAt(0)}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setSelectedVouchProfile(v.fromUserId)}
                      className="font-bold text-sm text-stone-900 hover:text-emerald-700 transition-colors truncate block text-left"
                    >
                      {v.senderName}
                    </button>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Wants to vouch for you</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeclineVouch(v.id)}
                      disabled={acceptingVouchId === v.id}
                      className="p-2 bg-stone-100 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
                    >
                      <X size={16} />
                    </button>
                    <button
                      onClick={() => handleAcceptVouch(v.id, v.fromUserId)}
                      disabled={acceptingVouchId === v.id}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                    >
                      {acceptingVouchId === v.id ? '...' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedVouchProfile && (
          <PublicProfile
            userId={selectedVouchProfile}
            onClose={() => setSelectedVouchProfile(null)}
            onNavigateToChat={onNavigateToChat}
          />
        )}

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
                No {filter === 'SHARE' ? 'giveaways' : filter === 'ASK' ? 'needs' : 'joins'} created yet.
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
          Log Out
        </button>
      </div>
    </div>
  );
}
