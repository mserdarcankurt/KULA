/**
 * FILE: GratitudeFlow.tsx
 * ROLE IN KULA: The "Thank You Ritual" — the ceremony that closes a gift exchange.
 * 
 * CIRCUIT: This is the BRIDGE between the Item lifecycle and the Trust Engine.
 *   When an exchange is completed (ASK fulfilled, SHARE received), this component
 *   opens as a bottom sheet. The user writes a personal thank-you note and selects
 *   a "vibe" emoji. On submit:
 * 
 *   1. GRATITUDE NOTE is created in Firestore → `gratitude_notes/{id}`
 *      This appears on the recipient's profile in TrustMosaic.tsx ("Gratitude Wall")
 * 
 *   2. TRUST MOSAIC is incremented for BOTH users:
 *      trustMosaic.completedExchanges += 1 (uses Firestore `increment()`)
 *      This affects the GrowthStage calculation in TrustMosaic.tsx:
 *        SEEDLING (0) → SPROUT (1-4) → TREE (5-14) → OLD_GROWTH (15+) → ELDER (30+)
 * 
 *   3. CALLBACK fires: onComplete() tells ItemDetailsSheet.tsx to update the item status.
 * 
 * DESIGN INTENT:
 *   This component is intentionally ceremonial — the vibe emoji selector, the
 *   minimum 10-character requirement, the animated success heart — all designed
 *   to make "saying thank you" feel meaningful, not transactional.
 *   This is the anti-Amazon review: personal, warm, community-focused.
 * 
 * CALLED BY: ItemDetailsSheet.tsx (when item status transitions to COMPLETED)
 */
import React, { useState } from 'react';
import { X, Send, Heart } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

interface GratitudeFlowProps {
  recipientId: string;
  recipientName: string;
  recipientPhoto?: string;
  itemId: string;
  itemTitle: string;
  itemType?: 'ASK' | 'SHARE' | 'JOIN' | string; // for per-type trust counter
  onClose: () => void;
  onComplete: () => void;
}

const vibeEmojis = ['🤝', '🙏', '⭐', '🌱', '💚'];

export default function GratitudeFlow({
  recipientId,
  recipientName,
  recipientPhoto,
  itemId,
  itemTitle,
  itemType,
  onClose,
  onComplete
}: GratitudeFlowProps) {
  const { user, profile } = useAuth();
  const [text, setText] = useState('');
  const [selectedVibe, setSelectedVibe] = useState('🤝');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 10 || !user || !profile) return;

    setSubmitting(true);
    try {
      // Save the gratitude note
      await addDoc(collection(db, 'gratitude_notes'), {
        fromUserId: user.uid,
        fromUserName: profile.displayName || 'A neighbor',
        fromUserPhoto: profile.photoURL || null,
        toUserId: recipientId,
        itemId,
        itemTitle,
        text: `${selectedVibe} ${text.trim()}`,
        createdAt: serverTimestamp()
      });

      // Increment the recipient's exchange count
      const recipientRef = doc(db, 'users', recipientId);
      const recipientUpdate: any = {
        'trustMosaic.completedExchanges': increment(1)
      };
      // Per-type counter for the new TrustMosaic display
      if (itemType === 'ASK') {
        recipientUpdate['trustMosaic.completedAsks'] = increment(1);
      } else if (itemType === 'SHARE') {
        recipientUpdate['trustMosaic.completedShares'] = increment(1);
      } else if (itemType === 'JOIN' || itemType === 'IMECE' || itemType === 'MISSION') {
        recipientUpdate['trustMosaic.completedJoins'] = increment(1);
        if (itemType === 'IMECE') {
          recipientUpdate['trustMosaic.imeceParticipations'] = increment(1);
        }
      }
      await updateDoc(recipientRef, recipientUpdate);

      // Also increment our own exchange count
      const myRef = doc(db, 'users', user.uid);
      const myUpdate: any = {
        'trustMosaic.completedExchanges': increment(1)
      };
      if (itemType === 'ASK') {
        myUpdate['trustMosaic.completedAsks'] = increment(1);
      } else if (itemType === 'SHARE') {
        myUpdate['trustMosaic.completedShares'] = increment(1);
      } else if (itemType === 'JOIN' || itemType === 'IMECE' || itemType === 'MISSION') {
        myUpdate['trustMosaic.completedJoins'] = increment(1);
        if (itemType === 'IMECE') {
          myUpdate['trustMosaic.imeceParticipations'] = increment(1);
        }
      }
      await updateDoc(myRef, myUpdate);

      setDone(true);
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit gratitude note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-t-[2.5rem] max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        {/* Header */}
        <div className="flex-none p-6 pb-0 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 border-2 border-stone-50 shadow-md overflow-hidden flex items-center justify-center">
              {recipientPhoto ? (
                <img src={recipientPhoto} alt={recipientName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-stone-300">{recipientName.charAt(0)}</span>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Say thanks to</p>
              <h3 className="serif text-2xl font-bold text-stone-900">{recipientName}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          /* Success State */
          <div className="p-8 flex flex-col items-center justify-center text-center gap-4 py-16">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 animate-in zoom-in duration-500">
              <Heart size={36} fill="currentColor" />
            </div>
            <h3 className="serif text-2xl font-bold text-stone-900">Gratitude sent!</h3>
            <p className="text-sm text-stone-500">Your note will appear on {recipientName}'s profile.</p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">For the exchange</p>
              <p className="text-sm font-bold text-stone-700">{itemTitle}</p>
            </div>

            {/* Vibe Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Pick a vibe
              </label>
              <div className="flex gap-3">
                {vibeEmojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedVibe(emoji)}
                    className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all ${
                      selectedVibe === emoji
                        ? 'bg-stone-900 shadow-lg scale-110'
                        : 'bg-stone-100 hover:bg-stone-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                Write a personal thank-you
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`What would you like ${recipientName.split(' ')[0]} to know?`}
                rows={3}
                className="w-full bg-stone-50 border-2 border-stone-100 focus:border-stone-900 rounded-2xl px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none transition-all resize-none"
              />
              {text.length > 0 && text.length < 10 && (
                <p className="text-[10px] text-amber-500 font-bold">
                  A few more words to make it meaningful...
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || text.trim().length < 10}
              className="w-full py-4 bg-stone-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <Send size={16} />
                  Send Gratitude
                </>
              )}
            </button>
          </form>
        )}

        {/* Bottom safe area */}
        <div className="h-8 flex-none" />
      </div>
    </div>
  );
}
