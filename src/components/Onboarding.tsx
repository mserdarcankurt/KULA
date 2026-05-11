import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Compass, PlusCircle, Users, HeartHandshake, MessageSquare, User } from 'lucide-react';
import { ART_DIRECTION } from '../lib/artDirection';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to KULA',
    description: 'The traditional gift economy, reimagined for your neighborhood. In KULA, we share resources, time, and skills without money.',
    image: ART_DIRECTION.fallbacks.Community,
    icon: '👋',
  },
  {
    id: 'home_feed',
    title: 'Home Tab',
    description: 'Explore the map or feed to see what neighbors are asking for, sharing, or organizing around you. Filter by specific needs or vicinity.',
    image: ART_DIRECTION.fallbacks.Equipment,
    icon: <Compass size={24} className="text-[#c1a077]" />,
  },
  {
    id: 'circles_orgs',
    title: 'Circles & Orgs',
    description: 'Join local, interest-based Circles with people you trust, or connect with verified organizations making a difference in the community.',
    image: ART_DIRECTION.fallbacks.CircleInvite,
    icon: <Users size={24} className="text-[#c1a077]" />,
  },
  {
    id: 'post',
    title: 'Create & Share (+)',
    description: 'Tap the + button to Ask for something, Share an item, organize an İmece (community work), post an Org Mission, or create a Join.',
    image: ART_DIRECTION.fallbacks.Plants,
    icon: <PlusCircle size={24} className="text-[#c1a077]" />,
  },
  {
    id: 'joins',
    title: 'What is a "Join"?',
    description: 'A "Join" is for casual meetups, gatherings, or activities (like \'going for a run\' or \'coffee chat\') where any neighbor can participate.',
    image: ART_DIRECTION.fallbacks.Support,
    icon: <HeartHandshake size={24} className="text-[#c1a077]" />,
  },
  {
    id: 'chats',
    title: 'Chats Tab',
    description: 'Coordinate pickups, discuss missions, and build relationships with your neighbors in real-time.',
    image: ART_DIRECTION.fallbacks.Service,
    icon: <MessageSquare size={24} className="text-[#c1a077]" />,
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Manage your settings, configure your reach radius, and view your impact. Trust is the currency of KULA.',
    image: ART_DIRECTION.backgrounds.hero,
    icon: <User size={24} className="text-[#c1a077]" />,
  }
];

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      if (user) {
        try {
          const profileRef = doc(db, 'users', user.uid);
          await updateDoc(profileRef, {
            hasCompletedOnboarding: true
          });
        } catch (e) {
          console.error('Error updating onboarding status:', e);
        }
      }
      onComplete();
    }
  };

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-stone-900 flex flex-col items-center justify-end p-6 pb-48 text-white h-[100dvh] max-w-md mx-auto relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-0 h-[60vh]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-stone-900/10 via-stone-900/60 to-stone-900 z-10" />
          <img src={step.image} alt="" className="w-full h-full object-cover opacity-80" />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id + "_content"}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-col items-center text-center space-y-6 w-full max-w-sm z-20 mb-4"
        >
          <div className="w-16 h-16 bg-stone-800/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-stone-700 text-3xl">
            {step.icon}
          </div>
          
          <div className="space-y-4 px-4 py-6 bg-stone-900/60 backdrop-blur-lg rounded-3xl border border-stone-800">
            <h2 className="serif text-3xl font-bold tracking-tight text-[#f0e6d2] drop-shadow-sm">{step.title}</h2>
            <p className="text-stone-300 text-base leading-relaxed font-medium">
              {step.description}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-12 w-full max-w-sm px-6 flex flex-col items-center gap-6 z-30">
        <button 
          onClick={handleNext}
          className="w-full py-4 bg-[#c1a077] text-stone-900 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-[#b08f65] transition-all transform active:scale-[0.98] flex items-center justify-center"
        >
          {currentStep < STEPS.length - 1 ? 'Continue' : 'Start Exploring'}
        </button>

        <div className="flex gap-2">
          {STEPS.map((s, idx) => (
            <div 
              key={s.id} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-8 bg-[#c1a077]' : 'w-2 bg-stone-700/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
