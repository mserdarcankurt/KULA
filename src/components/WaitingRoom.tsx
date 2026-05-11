import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Clock, LogOut, Heart } from 'lucide-react';

export default function WaitingRoom() {
  const { user, profile, logout } = useAuth();
  const [hostName, setHostName] = useState('your host');
  const [hostPhoto, setHostPhoto] = useState<string | null>(null);
  const [dots, setDots] = useState('');

  // Animate the waiting dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Fetch host info
  useEffect(() => {
    if (!profile?.hostId) return;
    const unsub = onSnapshot(doc(db, 'users', profile.hostId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setHostName(data.displayName || 'your host');
        setHostPhoto(data.photoURL || null);
      }
    });
    return () => unsub();
  }, [profile?.hostId]);

  const values = [
    { emoji: '🤝', text: 'Give what you can, take what you need' },
    { emoji: '🌱', text: 'Trust grows through real connections' },
    { emoji: '🏘️', text: 'Your neighborhood is your network' },
    { emoji: '💚', text: 'No money. Just community.' },
  ];

  const [activeValue, setActiveValue] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveValue(prev => (prev + 1) % values.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full space-y-8 text-center"
      >
        {/* Logo */}
        <div className="space-y-2">
          <div className="w-16 h-16 bg-[#5A5A40] rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">K</span>
          </div>
          <h1 className="serif text-3xl font-bold text-[#5A5A40]">Almost there!</h1>
        </div>

        {/* Host Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-8 border border-stone-100 shadow-md space-y-5"
        >
          <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden border-2 border-stone-50 shadow-lg mx-auto">
            {hostPhoto ? (
              <img src={hostPhoto} alt={hostName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-bold">
                {hostName.charAt(0)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-stone-500">
              Waiting for <span className="font-bold text-stone-800">{hostName}</span> to welcome you{dots}
            </p>
            <div className="flex items-center justify-center gap-2 text-amber-500">
              <Clock size={14} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Pending Approval
              </span>
            </div>
          </div>
        </motion.div>

        {/* Rotating Values */}
        <div className="h-24 flex items-center justify-center">
          <motion.div
            key={activeValue}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-3xl">{values[activeValue].emoji}</span>
            <p className="text-sm text-stone-500 italic serif">{values[activeValue].text}</p>
          </motion.div>
        </div>

        {/* Info */}
        <div className="bg-stone-100 rounded-2xl p-5 border border-stone-200 space-y-2">
          <div className="flex items-center justify-center gap-2 text-stone-600">
            <Heart size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Why invite-only?</span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            KULA grows through personal trust. Every member is invited by someone they know, 
            creating a real web of neighborly connections — not anonymous strangers.
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 text-[10px] text-stone-400 hover:text-stone-600 font-bold uppercase tracking-widest transition-colors mx-auto pt-2"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </motion.div>
    </div>
  );
}
