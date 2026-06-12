/**
 * FILE: InviteGate.tsx
 * ROLE IN KULA: Screen 2 - The Invitation Moment.
 * 
 * CIRCUIT A (Sacred Space Gatekeeper):
 *   This component is shown as part of the onboarding sequence when
 *   profile.onboardingStep is null or 'INVITED'.
 * 
 * DESIGN INTENT (Berlin Analog):
 *   - Clean warm neutral stone-50 page.
 *   - Tile-grid code entry (6 characters).
 *   - "The Handshake" reveal card displaying host's profile details.
 *   - Welcoming invitation verification note.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { KeyRound, ArrowRight, LogOut, Heart } from 'lucide-react';
import { logEvent } from '../lib/analytics';

/**
 * Server-side invite flow (functions/src/invites.ts):
 *  - lookupInvite validates the code and returns the host preview without
 *    exposing the invites collection to client reads.
 *  - applyInviteCode marks the code USED and sets hostId/hostStatus with
 *    Admin SDK privileges (clients can no longer write those fields).
 * Reviewer/demo access: a `reusable: true` invite doc (created server-side)
 * can be redeemed repeatedly — no hardcoded backdoor in the bundle.
 */
const lookupInviteFn = httpsCallable<
  { code: string },
  { host: { uid: string; name: string; photo: string | null; joinedAtMillis: number | null; helpedCount: number } }
>(functions, 'lookupInvite');
const applyInviteCodeFn = httpsCallable<{ code: string }, { hostId: string }>(functions, 'applyInviteCode');

export default function InviteGate() {
  const { user, profile, logout } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvedHost, setResolvedHost] = useState<{
    uid: string;
    name: string;
    photo: string | null;
    joinedDateStr: string;
    helpedCount: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the hidden text input
  const handleTileClick = () => {
    inputRef.current?.focus();
  };

  /**
   * PHASE 1: Look up the invite code via the lookupInvite Cloud Function.
   */
  const handleLookup = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);
    setError('');
    setResolvedHost(null);

    try {
      const { data } = await lookupInviteFn({ code: code.trim().toLowerCase() });
      const host = data.host;
      const joinedDateStr = host.joinedAtMillis
        ? new Date(host.joinedAtMillis).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'recently';

      setResolvedHost({
        uid: host.uid,
        name: host.name,
        photo: host.photo,
        joinedDateStr,
        helpedCount: host.helpedCount,
      });
    } catch (err: any) {
      console.error('Invite lookup failed:', err);
      const errCode: string = err?.code || '';
      if (errCode.includes('not-found')) {
        setError('This invite code is invalid. Double-check and try again.');
      } else if (errCode.includes('failed-precondition')) {
        setError('This invite code has already been used.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * PHASE 2: Redeem the code server-side. The applyInviteCode function
   * atomically marks the invite USED and sets hostId/hostStatus/onboardingStep
   * on this profile — the onSnapshot in useAuth picks the change up live.
   */
  const handleConfirm = async () => {
    if (!resolvedHost || !user || !profile) return;
    setLoading(true);

    try {
      await applyInviteCodeFn({ code: code.trim().toLowerCase() });
      logEvent('onboarding_step_reached', { step: 'PHILOSOPHY' });
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-stone-50 overflow-y-auto">
      <div className="min-h-full w-full flex flex-col items-center justify-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full space-y-8 text-center py-8"
        >
        {/* Header Branding */}
        <div className="space-y-3">
          <div className="w-16 h-16 bg-brand rounded-2xl mx-auto flex items-center justify-center shadow-lg transform rotate-6">
            <span className="text-white font-bold text-2xl">K</span>
          </div>
          <h1 className="serif text-4xl font-bold text-brand">Welcome to KULA</h1>
          <p className="text-stone-400 text-sm max-w-xs mx-auto">
            KULA grows through trusted connections.
          </p>
        </div>

        {/* Greeting */}
        {profile && (
          <div className="flex items-center justify-center gap-3 py-1 bg-stone-100/50 rounded-full max-w-[200px] mx-auto border border-stone-200/40">
            <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex-shrink-0">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500 font-bold text-xs">
                  {profile.displayName?.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-xs font-semibold text-stone-600 pr-3">
              Hello, {profile.displayName?.split(' ')[0]}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!resolvedHost ? (
            /* Phase 1: Code Input Tile Grid */
            <motion.div
              key="code-input-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="serif text-2xl font-semibold text-stone-800">Someone opened the door for you.</h2>
                <p className="text-xs text-stone-400">Enter the invite code they gave you.</p>
              </div>

              {/* Styled Thematic Code Input */}
              <div className="max-w-[320px] mx-auto px-1">
                <input
                  type="text"
                  placeholder="e.g. cozy-zucchini-42"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toLowerCase());
                    setError('');
                  }}
                  className="w-full bg-white border-2 border-stone-200 rounded-2xl px-4 py-4 text-center text-base font-mono font-bold text-stone-800 focus:border-stone-900 outline-none shadow-sm transition-all placeholder:text-stone-300 placeholder:font-sans placeholder:text-xs"
                />
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleLookup}
                  disabled={loading || code.length < 4}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <>
                      <ArrowRight size={16} />
                      Find My Host
                    </>
                  )}
                </button>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 font-medium"
                  >
                    {error}
                  </motion.p>
                )}
              </div>
            </motion.div>
          ) : (
            /* Phase 2: Host Confirmation (The Handshake) */
            <motion.div
              key="confirm-host-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 border border-stone-200/50 shadow-md space-y-4 max-w-sm mx-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  You were invited by
                </p>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden border-2 border-stone-50 shadow-lg relative">
                    {resolvedHost.photo ? (
                      <img src={resolvedHost.photo} alt={resolvedHost.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-200 text-stone-500 text-3xl font-bold">
                        {resolvedHost.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="serif text-2xl font-bold text-stone-900">{resolvedHost.name}</h3>
                </div>

                <div className="border-t border-stone-100 pt-4 text-left space-y-2 px-2">
                  <p className="text-xs text-stone-500 italic">
                    • Part of KULA since {resolvedHost.joinedDateStr}
                  </p>
                  <p className="text-xs text-stone-500 italic">
                    • Helped {resolvedHost.helpedCount} neighbor{resolvedHost.helpedCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs font-semibold text-brand flex items-center gap-1 mt-2">
                    <Heart size={14} className="fill-brand text-brand" /> They are vouching for you.
                  </p>
                </div>
              </div>

              {/* Invitation Ready info box */}
              <div className="bg-stone-100 border border-stone-200 rounded-2xl p-4 text-left max-w-sm mx-auto shadow-sm">
                <h4 className="text-xs font-bold text-brand uppercase tracking-wider mb-1">Invitation Ready</h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Welcome! Your invitation has been verified. Once you accept, you will enter KULA—our shared neighborhood circle built on trust and mutual support.
                </p>
              </div>

              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    'Accept the invitation'
                  )}
                </button>
                <button
                  onClick={() => {
                    setResolvedHost(null);
                    setCode('');
                  }}
                  className="text-xs text-stone-400 hover:text-stone-600 font-bold uppercase tracking-wider transition-colors"
                >
                  Use a different code
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign out */}
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 text-[10px] text-stone-400 hover:text-stone-600 font-bold uppercase tracking-widest transition-colors mx-auto pt-6"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </motion.div>
    </div>
  </div>
  );
}
