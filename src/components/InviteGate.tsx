/**
 * FILE: InviteGate.tsx
 * ROLE IN KULA: The "Bouncer" — ensures every new user enters through a trusted connection.
 * 
 * CIRCUIT A (Sacred Space Gatekeeper):
 *   This is Step 2 of the onboarding cascade. App.tsx shows this component when:
 *     - The user IS logged in (has a Firebase Auth session)
 *     - BUT their profile has NO `hostId` (nobody has vouched for them yet)
 *   
 *   Without a hostId, the user cannot proceed to the main app. This is the
 *   CORE MECHANISM that makes KULA invite-only.
 * 
 * TWO-PHASE FLOW:
 *   Phase 1 — CODE LOOKUP:
 *     User enters a 6-character invite code (e.g., "XK4M9P").
 *     handleLookup() queries Firestore: `users WHERE inviteCode == code`
 *     If found, we show the host's name and photo for confirmation.
 *     If not found, we show an error.
 *     If the user enters their OWN code, we catch that too ("That's your own code!").
 *   
 *   Phase 2 — CONFIRMATION:
 *     User sees who invited them and clicks "Request to Join".
 *     handleConfirm() updates their profile with:
 *       hostId: the host's UID (creates the Lineage Tree link)
 *       hostStatus: 'PENDING' (host hasn't approved yet)
 *     
 *     After this updateDoc, the onSnapshot listener in useAuth.tsx detects the change.
 *     App.tsx then switches to WaitingRoom.tsx (because hostStatus is 'PENDING').
 * 
 * DOWNSTREAM EFFECTS:
 *   Setting `hostId` creates a link in the trust graph:
 *     - useTrustNetwork.ts will find this as an INVITE edge
 *     - LineageTree.tsx will draw a line from host to this user
 *     - ConnectionBadge.tsx will show "1st Degree" between them
 * 
 * SECURITY:
 *   The invite code system is checked CLIENT-SIDE against Firestore.
 *   The real security is in firestore.rules — a user with hostStatus 'PENDING'
 *   has limited write access until an admin or host approves them.
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { KeyRound, ArrowRight, LogOut } from 'lucide-react';

export default function InviteGate() {
  const { user, profile, logout } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Phase tracking: null = entering code, object = confirming host
  const [resolvedHost, setResolvedHost] = useState<{ uid: string; name: string; photo: string | null } | null>(null);

  /**
   * PHASE 1: Look up the invite code in Firestore.
   * Queries the `users` collection for a document where inviteCode matches.
   * Each user gets a unique inviteCode when they complete onboarding.
   */
  const handleLookup = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);
    setError('');
    setResolvedHost(null);

    try {
      const upperCode = code.trim().toUpperCase();

      const q = query(
        collection(db, 'users'),
        where('inviteCode', '==', code.trim().toUpperCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('No neighbor found with this code. Double-check and try again.');
        setLoading(false);
        return;
      }

      const hostDoc = snap.docs[0];
      // Prevent using your own invite code
      if (hostDoc.id === user.uid) {
        setError("That's your own code! Ask a neighbor for theirs.");
        setLoading(false);
        return;
      }

      const hostData = hostDoc.data();
      // Store the host info for the confirmation screen
      setResolvedHost({
        uid: hostDoc.id,
        name: hostData.displayName || 'A neighbor',
        photo: hostData.photoURL || null
      });
    } catch (err) {
      console.error('Invite lookup failed:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * PHASE 2: Confirm the host and request to join.
   * Updates the current user's profile with the host's UID and sets status to PENDING.
   * After this write, useAuth.tsx's onSnapshot fires → App.tsx transitions to WaitingRoom.tsx.
   */
  const handleConfirm = async () => {
    if (!resolvedHost || !user) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hostId: resolvedHost.uid,        // Creates the Lineage Tree link
        hostStatus: 'PENDING'            // Host must approve before full access
      });
      // onSnapshot in useAuth will automatically update profile
      // App.tsx will detect hostStatus === 'PENDING' and show WaitingRoom
    } catch (err) {
      console.error('Failed to set host:', err);
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full space-y-8 text-center"
      >
        {/* Logo */}
        <div className="space-y-3">
          <div className="w-16 h-16 bg-[#5A5A40] rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">K</span>
          </div>
          <h1 className="serif text-4xl font-bold text-[#5A5A40]">Welcome to KULA</h1>
          <p className="text-stone-400 text-sm">
            KULA grows through trusted connections.<br />
            Enter the code you received from a neighbor.
          </p>
        </div>

        {/* Greeting — shows the user's profile if available */}
        {profile && (
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold">
                  {profile.displayName?.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-stone-600">
              Hello, {profile.displayName?.split(' ')[0]}
            </span>
          </div>
        )}

        {/* Code Input (Phase 1) OR Host Confirmation (Phase 2) */}
        {!resolvedHost ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="INVITE CODE"
                  className="w-full bg-white border-2 border-stone-200 focus:border-stone-900 rounded-2xl pl-11 pr-4 py-4 text-center text-lg font-mono font-bold tracking-[0.3em] text-stone-800 placeholder-stone-300 outline-none transition-all uppercase"
                />
              </div>
            </div>

            <button
              onClick={handleLookup}
              disabled={loading || code.trim().length < 4}
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
        ) : (
          /* Host Confirmation (Phase 2) — shows who invited you */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-md space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                You were invited by
              </p>
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden border-2 border-stone-50 shadow-lg">
                  {resolvedHost.photo ? (
                    <img src={resolvedHost.photo} alt={resolvedHost.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-bold">
                      {resolvedHost.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="serif text-2xl font-bold text-stone-900">{resolvedHost.name}</h3>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  'Request to Join'
                )}
              </button>
              <button
                onClick={() => {
                  setResolvedHost(null);
                  setCode('');
                }}
                className="text-sm text-stone-400 hover:text-stone-600 font-medium transition-colors"
              >
                Use a different code
              </button>
            </div>
          </motion.div>
        )}

        {/* Sign out option — always available in case user logged in with wrong account */}
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 text-[10px] text-stone-400 hover:text-stone-600 font-bold uppercase tracking-widest transition-colors mx-auto pt-4"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </motion.div>
    </div>
  );
}
