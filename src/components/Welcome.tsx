/**
 * FILE: Welcome.tsx
 * ROLE IN KULA: The "Threshold" & "Sign In" — the very first screen a visitor sees.
 * 
 * CIRCUIT A (Sacred Space Gatekeeper):
 *   This component is shown ONLY when the user is NOT logged in.
 *   App.tsx checks `if (!user) → show Welcome`.
 * 
 * DESIGN INTENT (Berlin Analog):
 *   - Golden hour / warm neighborhood full-bleed background image.
 *   - Staged text reveal explaining the philosophy of KULA.
 *   - "I was invited" button triggering a bottom-sheet slide-up for Sign In.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { ART_DIRECTION } from '../lib/artDirection';

export default function Welcome() {
  const { signIn } = useAuth();
  const [showSignInSheet, setShowSignInSheet] = useState(false);
  const [revealedLines, setRevealedLines] = useState<number>(0);

  // Staged text reveal: fade-in text lines one-by-one
  useEffect(() => {
    if (revealedLines < 3) {
      const timer = setTimeout(() => {
        setRevealedLines((prev) => prev + 1);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [revealedLines]);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900 text-white h-[100dvh] max-w-md mx-auto relative overflow-hidden flex flex-col justify-end p-6 pb-20">
      {/* Background Image with blur-in and cross-fade */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-900/20 via-stone-900/60 to-stone-900 z-10" />
        <img
          src={ART_DIRECTION.backgrounds.hero}
          alt=""
          className="w-full h-full object-cover opacity-70 scale-105 filter blur-[1px]"
        />
      </div>

      {/* Screen 0: The Threshold Text Elements */}
      <div className="z-10 w-full max-w-sm mx-auto flex flex-col items-center text-center space-y-8 mb-8">
        {/* KULA Logo icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 12 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-20 h-20 bg-brand rounded-3xl flex items-center justify-center shadow-2xl border border-[#7A7A5A]/30 mb-2"
        >
          <span className="text-white font-bold text-4xl select-none">K</span>
        </motion.div>

        {/* Tagline / Staged copy */}
        <div className="space-y-4 px-4">
          <AnimatePresence>
            {revealedLines >= 1 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="serif text-xl sm:text-2xl text-stone-100 font-medium italic"
              >
                "Your neighbor has something for you."
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {revealedLines >= 2 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="serif text-xl sm:text-2xl text-stone-100 font-medium italic"
              >
                "And you probably have something for them."
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {revealedLines >= 3 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="serif text-stone-300 text-sm font-medium tracking-wide uppercase mt-6"
              >
                KULA is how neighborhoods remember how to share.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Threshold CTA Button */}
      <AnimatePresence>
        {revealedLines >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="z-10 w-full max-w-sm mx-auto flex flex-col items-center gap-4"
          >
            <button
              onClick={() => setShowSignInSheet(true)}
              className="w-full py-4 bg-[#c1a077] text-stone-900 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-[#b08f65] transition-all transform active:scale-[0.98] flex items-center justify-center"
            >
              I was invited
            </button>
            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-[0.1em]">
              KULA is invite-only. You'll need a code from a neighbor.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 1: Sign In Bottom Sheet Overlay */}
      <AnimatePresence>
        {showSignInSheet && (
          <>
            {/* Backdrop click dismisses bottom sheet */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignInSheet(false)}
              className="fixed inset-0 bg-black z-30"
            />
            {/* Slide up sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-stone-50 rounded-t-[2.5rem] border-t border-stone-200 p-6 pb-12 z-40 text-stone-800 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] flex flex-col items-center"
            >
              {/* Drag indicator */}
              <div className="w-12 h-1 bg-stone-300 rounded-full mb-6" />

              <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mb-4 text-white font-bold text-xl">
                K
              </div>

              <h3 className="serif text-2xl font-bold text-stone-900 mb-2">Join the circle</h3>
              <p className="text-stone-500 text-xs text-center max-w-[280px] mb-4 font-medium">
                We use Google or Apple to verify your identity. We never post on your behalf or share your private data.
              </p>

              {/* Explicit EULA & Privacy Policy Consent */}
              <p className="text-[10px] text-stone-400 text-center max-w-[320px] mb-6 leading-relaxed">
                By signing in, you agree to our{' '}
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline text-stone-600 hover:text-stone-900">
                  Terms of Service (EULA)
                </a>{' '}
                and{' '}
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline text-stone-600 hover:text-stone-900">
                  Privacy Policy
                </a>.
              </p>

              <div className="w-full flex flex-col gap-3">
                <button
                  onClick={() => signIn('google')}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-md hover:bg-black transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>

                <button
                  onClick={() => signIn('apple')}
                  className="w-full py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-md hover:bg-stone-900 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74,17,21.95,15.66,22S13.8,21.15,12.28,21.15C10.74,21.15,9,22,7.62,22S5.24,20.76,3.87,18.79C1,14.73,1,8.93,4,4.76C5.46,2.69,7.6,1.38,9.92,1.35C11.68,1.32,13.3,2.53,14.38,2.53S16.82,1.09,19,1.31C19.92,1.35,22.45,1.68,24,4C22.78,5.19,22,6.78,22,8.53C22,10.66,23.3,12.31,25,13C24,15.5,21.36,19.5,18.71,19.5M15.97,4.17C16.94,3,17.59,1.44,17.41,0C16.15,0.05,14.62,0.84,13.72,1.9C12.94,2.83,12.26,4.42,12.47,5.81C13.88,5.92,15.31,5.12,15.97,4.17Z"/>
                  </svg>
                  <span>Sign in with Apple</span>
                </button>


              </div>

              <button
                onClick={() => setShowSignInSheet(false)}
                className="mt-4 text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
              >
                Go back
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
