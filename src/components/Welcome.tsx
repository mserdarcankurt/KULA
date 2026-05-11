import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';

export default function Welcome() {
  const { signIn } = useAuth();
  const [info, setInfo] = useState<'NEAR' | 'GIFT' | null>(null);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="space-y-4">
          <div className="w-20 h-20 bg-[#5A5A40] rounded-3xl mx-auto flex items-center justify-center shadow-lg transform rotate-12">
            <span className="text-white font-bold text-4xl">K</span>
          </div>
          <h1 className="serif text-6xl font-bold tracking-tight text-[#5A5A40]">KULA</h1>
          <p className="text-stone-500 text-lg serif italic">The traditional gift economy, reimagined for your neighborhood.</p>
        </div>

        <div className="space-y-6 pt-12">
          <p className="text-sm text-stone-400 uppercase tracking-[0.2em] font-medium">Join the circle</p>
          <button 
            onClick={signIn}
            className="w-full py-4 bg-stone-900 text-white border-2 border-stone-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-white">Sign in with Google</span>
          </button>
          
          <div className="pt-8 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-[9px] uppercase tracking-[0.2em] text-stone-400 font-black">
              <button 
                onClick={() => setInfo(info === 'NEAR' ? null : 'NEAR')}
                className={`p-4 border-2 rounded-[2rem] flex flex-col items-center gap-2 transition-all active:scale-95 ${
                  info === 'NEAR' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-stone-50 border-stone-100'
                }`}
              >
                <span className="text-xl">🌍</span>
                <span>Near you</span>
              </button>
              <button 
                onClick={() => setInfo(info === 'GIFT' ? null : 'GIFT')}
                className={`p-4 border-2 rounded-[2rem] flex flex-col items-center gap-2 transition-all active:scale-95 ${
                  info === 'GIFT' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-stone-50 border-stone-100'
                }`}
              >
                <span className="text-xl">🎁</span>
                <span>Gift economy</span>
              </button>
            </div>
            
            <AnimatePresence mode="wait">
              {info && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-[10px] text-stone-500 serif italic px-4 leading-relaxed"
                >
                  {info === 'NEAR' 
                    ? "Connect with neighbors within walking distance. Share tools, skills, and support based on your actual proximity."
                    : "A resource-sharing model where we give what we can and take what we need, strengthening community bonds without money."}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
