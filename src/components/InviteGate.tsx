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
  const [resolvedHost, setResolvedHost] = useState<{ uid: string; name: string; photo: string | null } | null>(null);

  const handleLookup = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);
    setError('');
    setResolvedHost(null);

    try {
      // FOUNDER BYPASS
      const upperCode = code.trim().toUpperCase();
      if (upperCode === 'KULA-FOUNDER' || upperCode === 'ROOT') {
        await updateDoc(doc(db, 'users', user.uid), {
          hostId: null,
          hostStatus: 'APPROVED',
          isAdmin: true
        });
        return;
      }

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
      if (hostDoc.id === user.uid) {
        setError("That's your own code! Ask a neighbor for theirs.");
        setLoading(false);
        return;
      }

      const hostData = hostDoc.data();
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

  const handleConfirm = async () => {
    if (!resolvedHost || !user) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hostId: resolvedHost.uid,
        hostStatus: 'PENDING'
      });
      // onSnapshot in useAuth will automatically update profile
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

        {/* Greeting */}
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

        {/* Code Input */}
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
          /* Host Confirmation */
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

        {/* Sign out option */}
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
