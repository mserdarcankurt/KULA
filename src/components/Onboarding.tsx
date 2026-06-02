/**
 * FILE: Onboarding.tsx
 * ROLE IN KULA: The "Storied Journey" — a guided narrative explaining KULA's philosophy, trust web, and usage.
 * 
 * CIRCUIT A (Sacred Space Gatekeeper):
 *   This is Step 4 of the onboarding cascade. App.tsx shows this when:
 *     - User IS logged in, has a hostId, but hasCompletedOnboarding is false / onboardingStep !== 'COMPLETE'.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Compass, Users, HeartHandshake, ArrowRight, Check, ChevronLeft, MapPin } from 'lucide-react';
import { ART_DIRECTION } from '../lib/artDirection';
import InviteGate from './InviteGate';
import WaitingRoom from './WaitingRoom';
import { SavedLocation } from '../types';
import { generateRandomizedCenter } from '../lib/neighborhoodPrivacy';
import { logEvent } from '../lib/analytics';

// Animated Trust Web SVG Visualization
function TrustWebAnimation() {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center bg-stone-900/60 backdrop-blur-md rounded-[2.5rem] border border-stone-800 shadow-inner">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Connection lines */}
        <motion.line
          x1="100"
          y1="100"
          x2="45"
          y2="65"
          stroke="#c1a077"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut", repeat: Infinity, repeatDelay: 2 }}
        />
        <motion.line
          x1="100"
          y1="100"
          x2="155"
          y2="75"
          stroke="#c1a077"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4, repeat: Infinity, repeatDelay: 2 }}
        />
        <motion.line
          x1="100"
          y1="100"
          x2="110"
          y2="155"
          stroke="#c1a077"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.8, repeat: Infinity, repeatDelay: 2 }}
        />
        
        {/* Center Node (You) */}
        <motion.circle
          cx="100"
          cy="100"
          r="16"
          fill="#A95C42"
          stroke="#f0e6d2"
          strokeWidth="2"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        />
        <text x="100" y="103.5" textAnchor="middle" fill="#f0e6d2" className="text-[9px] font-black uppercase tracking-wider select-none">You</text>
        
        {/* Neighbor Nodes */}
        <motion.circle
          cx="45"
          cy="65"
          r="10"
          fill="#4A6B53"
          stroke="#f0e6d2"
          strokeWidth="1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
        />
        <motion.circle
          cx="155"
          cy="75"
          r="10"
          fill="#4A6B53"
          stroke="#f0e6d2"
          strokeWidth="1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.2, type: "spring" }}
        />
        <motion.circle
          cx="110"
          cy="155"
          r="10"
          fill="#4A6B53"
          stroke="#f0e6d2"
          strokeWidth="1.5"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.6, type: "spring" }}
        />
      </svg>
    </div>
  );
}

// Concentric Circles Explainer SVG
function CirclesAnimation() {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <motion.circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="#c1a077"
          strokeWidth="1.5"
          strokeDasharray="6,6"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
        />
        <motion.circle
          cx="100"
          cy="100"
          r="55"
          fill="none"
          stroke="#4A6B53"
          strokeWidth="1.5"
          strokeDasharray="4,4"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        />
        <motion.circle
          cx="100"
          cy="100"
          r="30"
          fill="none"
          stroke="#A95C42"
          strokeWidth="2"
          animate={{ scale: [0.96, 1.04, 0.96] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        />
        <circle cx="100" cy="100" r="8" fill="#5A5A40" />
      </svg>
    </div>
  );
}

export default function Onboarding({ onComplete }: { onComplete: (action?: 'give' | 'ask' | 'explore') => void }) {
  const { user, profile, updateProfile } = useAuth();
  const [step, setStep] = useState<string>('INVITED');
  const [subSlide, setSubSlide] = useState<number>(0);
  const [hostName, setHostName] = useState<string>('Your host');

  // Profile setup states (Screen 6)
  const [displayName, setDisplayName] = useState<string>('');
  const [neighborhoodName, setNeighborhoodName] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [profileStep, setProfileStep] = useState<number>(0); // 0: Name, 1: Neighborhood, 2: Language
  const [loading, setLoading] = useState<boolean>(false);

  // Swipe gesture detection
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (totalSlides: number, onEndNextStep: () => void) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      if (subSlide < totalSlides - 1) {
        setSubSlide(prev => prev + 1);
      } else {
        onEndNextStep();
      }
    }
    if (isRightSwipe) {
      if (subSlide > 0) {
        setSubSlide(prev => prev - 1);
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Sync state machine with Firestore profile on load
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPreferredLanguage(profile.preferredLanguage || 'English');
      setNeighborhoodName(profile.neighborhoodName || '');

      if (profile.onboardingStep) {
        setStep(profile.onboardingStep);
      } else {
        if (profile.hostId) {
          setStep('PHILOSOPHY');
        } else {
          setStep('INVITED');
        }
      }
    }
  }, [profile]);

  // Fetch host displayName for Screen 3C (Invite Chain)
  useEffect(() => {
    if (profile?.hostId) {
      import('firebase/firestore').then(({ getDoc, doc }) => {
        getDoc(doc(db, 'users', profile.hostId!)).then((snap) => {
          if (snap.exists()) {
            setHostName(snap.data().displayName || 'Your host');
          }
        });
      });
    }
  }, [profile?.hostId]);

  const updateStep = async (nextStep: string) => {
    if (!user) return;
    try {
      await updateProfile({
        onboardingStep: nextStep as any
      });
      logEvent('onboarding_step_reached', { step: nextStep });
      setStep(nextStep);
      setSubSlide(0);
    } catch (e) {
      console.error('Error advancing onboarding step:', e);
    }
  };

  const geocodeDistrict = async (districtName: string): Promise<{ lat: number; lng: number }> => {
    try {
      const queryStr = `${districtName}, Berlin`;
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=1`);
      let data = await response.json();
      if (!data || data.length === 0) {
        const response2 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(districtName)}&format=json&limit=1`);
        data = await response2.json();
      }
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (error) {
      console.error('Geocoding failed, using Berlin center:', error);
    }
    return { lat: 52.5200, lng: 13.4050 };
  };

  const handleProfileSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const coords = await geocodeDistrict(neighborhoodName);
      const radiusMeters = 1000;
      const center = generateRandomizedCenter(coords, radiusMeters);

      const defaultLoc: SavedLocation = {
        id: `loc_default_${Date.now()}`,
        label: `Home (${neighborhoodName})`,
        exactLocation: coords,
        neighborhoodCenter: center,
        neighborhoodRadius: radiusMeters,
        isDefault: true,
      };

      const { setDoc, doc } = await import('firebase/firestore');

      await setDoc(doc(db, 'users_private', user.uid), {
        savedLocations: [defaultLoc],
        exactHomeLocation: coords,
      }, { merge: true });

      await updateProfile({
        displayName,
        neighborhoodName,
        preferredLanguage,
        neighborhoodCenter: center,
        neighborhoodRadius: radiusMeters,
        onboardingStep: 'FIRST_ACT'
      });
      logEvent('onboarding_step_reached', { step: 'FIRST_ACT' });
      setStep('FIRST_ACT');
    } catch (e) {
      console.error('Error updating profile presence:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileNext = () => {
    if (profileStep === 0) {
      if (displayName.trim()) setProfileStep(1);
    } else if (profileStep === 1) {
      if (neighborhoodName.trim()) setProfileStep(2);
    } else if (profileStep === 2) {
      handleProfileSubmit();
    }
  };

  const completeOnboarding = async (action: 'give' | 'ask' | 'explore') => {
    if (!user) return;
    try {
      await updateProfile({
        onboardingStep: 'COMPLETE',
        hasCompletedOnboarding: true,
        skippedFirstAct: action === 'explore'
      });
      logEvent('onboarding_step_reached', { step: 'COMPLETE', action });
      onComplete(action);
    } catch (e) {
      console.error('Error completing onboarding:', e);
    }
  };

  // Redirect to sub-gateways if needed
  if (step === 'INVITED') {
    return <InviteGate />;
  }

  if (step === 'PENDING') {
    return <WaitingRoom />;
  }

  // Get dynamic assets/info for content screens
  const getStepConfig = () => {
    switch (step) {
      case 'PHILOSOPHY':
        return {
          bg: ART_DIRECTION.fallbacks.Food,
          title: 'The Manifesto',
        };
      case 'HOWTO':
        return {
          bg: ART_DIRECTION.fallbacks.Equipment,
          title: 'How You\'ll Use It',
        };
      case 'CIRCLES':
        return {
          bg: ART_DIRECTION.fallbacks.CircleInvite,
          title: 'Your Circles',
        };
      default:
        return {
          bg: ART_DIRECTION.backgrounds.hero,
          title: 'Welcome',
        };
    }
  };

  const STEPS_PROGRESS = ['PHILOSOPHY', 'HOWTO', 'CIRCLES', 'PROFILE', 'FIRST_ACT'];
  const currentStepIdx = STEPS_PROGRESS.indexOf(step);
  const config = getStepConfig();

  return (
    <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col items-center justify-end p-6 pb-24 text-white h-[100dvh] max-w-md mx-auto relative overflow-hidden">
      {/* Background with blur crossfade */}
      <div className="absolute inset-0 z-0 h-[50vh]">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/10 via-stone-900/60 to-stone-900 z-10" />
        <img src={config.bg} alt="" className="w-full h-full object-cover opacity-60 filter blur-[0.5px]" />
      </div>

      {/* Top Progress Tracker */}
      {currentStepIdx >= 0 && (
        <div className="absolute top-6 left-6 right-6 z-30 flex items-center justify-between gap-1.5 bg-stone-950/60 backdrop-blur-md p-3 rounded-2xl border border-stone-800/40 animate-in fade-in slide-in-from-top-2 duration-300">
          {STEPS_PROGRESS.map((s, idx) => {
            const label = s === 'PHILOSOPHY' ? 'Manifesto' : s === 'HOWTO' ? 'Mechanics' : s === 'CIRCLES' ? 'Circles' : s === 'PROFILE' ? 'Presence' : 'Welcome';
            const isActive = idx === currentStepIdx;
            const isCompleted = idx < currentStepIdx;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1 w-full rounded-full transition-all duration-500 ${
                  isActive ? 'bg-[#c1a077]' : isCompleted ? 'bg-[#4A6B53]' : 'bg-stone-800/60'
                }`} />
                <span className={`text-[7px] font-black uppercase tracking-wider transition-colors ${
                  isActive ? 'text-[#c1a077]' : isCompleted ? 'text-[#4A6B53]' : 'text-stone-500'
                }`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Screen 3: The Manifesto */}
      {step === 'PHILOSOPHY' && (
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => handleTouchEnd(3, () => updateStep('HOWTO'))}
          className="w-full max-w-sm z-20 flex flex-col items-center text-center space-y-6 mb-4 select-none touch-pan-y"
        >
          <AnimatePresence mode="wait">
            {subSlide === 0 && (
              <motion.div
                key="phil-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="w-16 h-16 bg-stone-800/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-stone-700 mx-auto text-3xl">
                  🎁
                </div>
                <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80">
                  <h2 className="serif text-3xl font-bold tracking-tight text-[#f0e6d2]">No buying. No selling.</h2>
                  <p className="text-stone-300 text-sm leading-relaxed font-medium">
                    KULA runs entirely on neighborly goodwill. Give what you have. Ask for what you need. The only currency here is trust.
                  </p>
                </div>
              </motion.div>
            )}

            {subSlide === 1 && (
              <motion.div
                key="phil-1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                <TrustWebAnimation />
                <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80">
                  <h2 className="serif text-3xl font-bold tracking-tight text-[#f0e6d2]">The Trust Web</h2>
                  <p className="text-stone-300 text-sm leading-relaxed font-medium">
                    Every member was invited by someone they know. Your connections shape what you see: neighbors closer in the trust chain appear first.
                  </p>
                </div>
              </motion.div>
            )}

            {subSlide === 2 && (
              <motion.div
                key="phil-2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                {/* Horizontal Invite Chain Visual */}
                <div className="flex items-center justify-center gap-2 py-4 px-6 bg-stone-850/60 rounded-2xl border border-stone-700/40 w-fit mx-auto">
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-1 bg-[#4A6B53] rounded-full text-[10px] font-bold max-w-[80px] truncate">{hostName}</div>
                    <span className="text-[8px] text-stone-400 mt-1">Host</span>
                  </div>
                  <span className="text-[#c1a077] font-bold">➔</span>
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-1 bg-[#A95C42] rounded-full text-[10px] font-bold max-w-[80px] truncate">{displayName || 'You'}</div>
                    <span className="text-[8px] text-stone-400 mt-1">You</span>
                  </div>
                  <span className="text-stone-600 font-bold">➔</span>
                  <div className="flex flex-col items-center">
                    <div className="px-3 py-1 bg-stone-750 border border-dashed border-stone-500 rounded-full text-[10px] text-stone-400">Next guest</div>
                    <span className="text-[8px] text-stone-500 mt-1">Soon</span>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80">
                  <h2 className="serif text-3xl font-bold tracking-tight text-[#f0e6d2]">Carry it forward</h2>
                  <p className="text-stone-300 text-sm leading-relaxed font-medium">
                    When you're ready, you will get invite codes too. The neighbors you bring in become part of your lineage, growing KULA organically.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manifesto Stepper Button */}
          <div className="w-full flex flex-col items-center gap-4 mt-6">
            <button
              onClick={() => {
                if (subSlide < 2) {
                  setSubSlide(prev => prev + 1);
                } else {
                  updateStep('HOWTO');
                }
              }}
              className="w-full py-4 bg-[#c1a077] text-stone-900 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-[#b08f65] transition-all active:scale-[0.98] flex items-center justify-center gap-1"
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
            <div className="flex gap-2">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setSubSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === subSlide ? 'w-8 bg-[#c1a077]' : 'w-2 bg-stone-700 hover:bg-stone-600'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen 4: How You'll Use It vignettes */}
      {step === 'HOWTO' && (
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => handleTouchEnd(3, () => updateStep('CIRCLES'))}
          className="w-full max-w-sm z-20 flex flex-col items-center text-center space-y-6 mb-4 select-none touch-pan-y"
        >
          <AnimatePresence mode="wait">
            {subSlide === 0 && (
              <motion.div
                key="howto-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                <div className="w-16 h-16 bg-stone-850/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-stone-700 mx-auto">
                  <Compass size={24} className="text-[#c1a077]" />
                </div>
                <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#c1a077] block mb-1">Scenario 1: Sharing</span>
                  <blockquote className="serif text-lg font-bold text-stone-100 italic border-l-2 border-[#c1a077] pl-3 mb-4">
                    "I have a drill gathering dust in the cellar, maybe someone needs it."
                  </blockquote>
                  <h3 className="serif text-xl font-bold text-[#f0e6d2] mt-4">🎁 Giving</h3>
                  <p className="text-stone-300 text-xs leading-relaxed font-medium mt-1">
                    List items to borrow, skills, surplus food, or simple household items. No sales, just loans and gifts.
                  </p>
                </div>
              </motion.div>
            )}

            {subSlide === 1 && (
              <motion.div
                key="howto-1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                <div className="w-16 h-16 bg-stone-850/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-stone-700 mx-auto">
                  <HeartHandshake size={24} className="text-[#c1a077]" />
                </div>
                <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#c1a077] block mb-1">Scenario 2: Asking</span>
                  <blockquote className="serif text-lg font-bold text-stone-100 italic border-l-2 border-[#c1a077] pl-3 mb-4">
                    "I'm looking for a French conversation partner to practice with."
                  </blockquote>
                  <h3 className="serif text-xl font-bold text-[#f0e6d2] mt-4">🙋 Asking</h3>
                  <p className="text-stone-300 text-xs leading-relaxed font-medium mt-1">
                    Request what you need openly from your trusted network. Neighborhood sharing is reciprocal and transparent.
                  </p>
                </div>
              </motion.div>
            )}

            {subSlide === 2 && (
              <motion.div
                key="howto-2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 w-full"
              >
                <div className="w-16 h-16 bg-stone-850/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-stone-700 mx-auto">
                  <Users size={24} className="text-[#c1a077]" />
                </div>
                <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80 text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#c1a077] block mb-1">Scenario 3: Meetups</span>
                  <blockquote className="serif text-lg font-bold text-stone-100 italic border-l-2 border-[#c1a077] pl-3 mb-4">
                    "Anyone want to walk to the local market together on Sunday?"
                  </blockquote>
                  <h3 className="serif text-xl font-bold text-[#f0e6d2] mt-4">👋 Joining</h3>
                  <p className="text-stone-300 text-xs leading-relaxed font-medium mt-1">
                    Organize casual gatherings, street cleanups, or collaborative events. Connect with neighbors directly.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full flex flex-col items-center gap-4 mt-6">
            <button
              onClick={() => {
                if (subSlide < 2) {
                  setSubSlide(prev => prev + 1);
                } else {
                  updateStep('CIRCLES');
                }
              }}
              className="w-full py-4 bg-[#c1a077] text-stone-900 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-[#b08f65] transition-all active:scale-[0.98] flex items-center justify-center gap-1"
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
            <div className="flex gap-2">
              {[0, 1, 2].map((idx) => (
                <button
                  key={idx}
                  onClick={() => setSubSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === subSlide ? 'w-8 bg-[#c1a077]' : 'w-2 bg-stone-700 hover:bg-stone-600'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Screen 5: Circles explainer */}
      {step === 'CIRCLES' && (
        <div className="w-full max-w-sm z-20 flex flex-col items-center text-center space-y-6 mb-4">
          <CirclesAnimation />
          <div className="space-y-4 px-4 py-6 bg-stone-900/70 backdrop-blur-lg rounded-[2rem] border border-stone-800/80">
            <h2 className="serif text-3xl font-bold tracking-tight text-[#f0e6d2]">Local Circles</h2>
            <p className="text-stone-300 text-sm leading-relaxed font-medium">
              Circles are dedicated communities within your neighborhood. Join interest groups, garden collectives, or build your own circle of close friends.
            </p>
          </div>

          <button
            onClick={() => updateStep('PROFILE')}
            className="w-full py-4 bg-[#c1a077] text-stone-900 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-[#b08f65] transition-all active:scale-[0.98] flex items-center justify-center gap-1"
          >
            <span>Set Up Presence</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Screen 6: Profile Setup (stepper wizard) */}
      {step === 'PROFILE' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProfileNext();
          }}
          className="w-full max-w-sm z-20 flex flex-col items-center text-center space-y-6 mb-4"
        >
          <AnimatePresence mode="wait">
            {profileStep === 0 && (
              <motion.div
                key="prof-name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 w-full"
              >
                <div className="space-y-2">
                  <h2 className="serif text-2xl font-bold text-[#f0e6d2]">What should neighbors call you?</h2>
                  <p className="text-xs text-stone-400">Display name or nickname works perfectly.</p>
                </div>
                <input
                  key="name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  autoFocus
                  className="w-full bg-stone-800/80 border border-stone-700 rounded-2xl px-4 py-4 text-center text-lg text-stone-100 placeholder-stone-500 outline-none focus:border-[#c1a077] transition-all"
                />
              </motion.div>
            )}

            {profileStep === 1 && (
              <motion.div
                key="prof-neigh"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 w-full"
              >
                <div className="space-y-2">
                  <h2 className="serif text-2xl font-bold text-[#f0e6d2]">Where in the city are you?</h2>
                  <p className="text-xs text-stone-400">District name, neighborhood, or city region.</p>
                </div>
                <input
                  key="neigh-input"
                  type="text"
                  value={neighborhoodName}
                  onChange={(e) => setNeighborhoodName(e.target.value)}
                  placeholder="e.g. Neukölln"
                  autoFocus
                  className="w-full bg-stone-800/80 border border-stone-700 rounded-2xl px-4 py-4 text-center text-lg text-stone-100 placeholder-stone-500 outline-none focus:border-[#c1a077] transition-all"
                />
                <p className="text-[10px] text-stone-400 leading-normal max-w-xs mx-auto">
                  We use this label to show relevant local posts in the feed. We never expose your exact street address.
                </p>
              </motion.div>
            )}

            {profileStep === 2 && (
              <motion.div
                key="prof-lang"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 w-full"
              >
                <div className="space-y-2">
                  <h2 className="serif text-2xl font-bold text-[#f0e6d2]">Which language do you prefer?</h2>
                  <p className="text-xs text-stone-400">KULA automatically translates posts for you.</p>
                </div>
                <div className="relative w-full">
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full bg-stone-800/80 border border-stone-700 rounded-2xl px-4 py-4 text-center text-lg text-stone-100 outline-none focus:border-[#c1a077] appearance-none cursor-pointer"
                  >
                    <option value="English">English</option>
                    <option value="Deutsch">Deutsch</option>
                    <option value="Türkçe">Türkçe</option>
                    <option value="Español">Español</option>
                    <option value="Français">Français</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full flex items-center justify-between gap-4 mt-6">
            {profileStep > 0 ? (
              <button
                type="button"
                onClick={() => setProfileStep(prev => prev - 1)}
                className="p-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl transition-all"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-12" />
            )}

            <button
              type="submit"
              disabled={loading || (profileStep === 0 && !displayName.trim()) || (profileStep === 1 && !neighborhoodName.trim())}
              className="flex-1 py-4 bg-[#c1a077] text-stone-900 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-[#b08f65] transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-1"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-900" />
              ) : (
                <>
                  <span>{profileStep === 2 ? 'Save Details' : 'Continue'}</span>
                  {profileStep < 2 && <ArrowRight size={16} />}
                </>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === profileStep ? 'w-8 bg-[#c1a077]' : 'w-2 bg-stone-700'
                }`}
              />
            ))}
          </div>
        </form>
      )}

      {/* Screen 7: Your First Act */}
      {step === 'FIRST_ACT' && (
        <div className="w-full max-w-sm z-20 flex flex-col items-center space-y-6 mb-4 text-center">
          <div className="space-y-2">
            <h2 className="serif text-3xl font-bold tracking-tight text-[#f0e6d2]">You're in, {displayName.split(' ')[0]}.</h2>
            <p className="text-xs text-stone-400">
              Welcome to the neighborhood. Let's make your first gesture of connection.
            </p>
          </div>

          <div className="w-full space-y-3">
            {/* Give Card */}
            <button
              onClick={() => completeOnboarding('give')}
              className="w-full p-4 bg-stone-900/80 border border-stone-850 hover:border-[#c1a077]/40 rounded-2xl text-left flex items-start gap-4 transition-all hover:bg-stone-850/80 group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/30 border border-[#5A5A40]/30 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🎁
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-sm text-[#f0e6d2]">Give something</h4>
                <p className="text-[11px] text-stone-400">Share a tool, skill, or list something gathering dust.</p>
              </div>
            </button>

            {/* Ask Card */}
            <button
              onClick={() => completeOnboarding('ask')}
              className="w-full p-4 bg-stone-900/80 border border-stone-850 hover:border-[#c1a077]/40 rounded-2xl text-left flex items-start gap-4 transition-all hover:bg-stone-850/80 group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#A95C42]/30 border border-[#A95C42]/30 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                🙋
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-sm text-[#f0e6d2]">Ask for something</h4>
                <p className="text-[11px] text-stone-400">Request a tool to borrow or help from neighbors.</p>
              </div>
            </button>

            {/* Just Explore Card */}
            <button
              onClick={() => completeOnboarding('explore')}
              className="w-full p-4 bg-stone-900/80 border border-stone-850 hover:border-[#c1a077]/40 rounded-2xl text-left flex items-start gap-4 transition-all hover:bg-stone-850/80 group"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                👋
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-sm text-[#f0e6d2]">Just explore</h4>
                <p className="text-[11px] text-stone-400">See what neighbors are sharing or asking for first.</p>
              </div>
            </button>
          </div>

          {/* Explicit Skip button with nudge activation */}
          <button
            onClick={() => completeOnboarding('explore')}
            className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-300 transition-colors pt-2"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
