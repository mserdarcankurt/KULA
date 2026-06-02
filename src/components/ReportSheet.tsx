/**
 * FILE: ReportSheet.tsx
 * ROLE IN KULA: The "Safety Valve" — lets users report inappropriate content or users.
 *
 * APP STORE COMPLIANCE:
 *   Apple's App Store Review Guideline 1.2 requires all apps with user-generated
 *   content to include a mechanism for users to report offensive content.
 *   Without this, the app WILL be rejected during App Store review.
 *
 * HOW IT WORKS:
 *   1. User taps the "Flag" icon on a profile (PublicProfile.tsx) or item (ItemDetailsSheet.tsx).
 *   2. This sheet slides up from the bottom.
 *   3. User selects a reason from a predefined list.
 *   4. Optionally adds details in a textarea.
 *   5. On submit, a document is created in the `reports` Firestore collection.
 *   6. A "Thank you" confirmation appears, then the sheet closes.
 *
 * DATA FLOW:
 *   WRITES: reports/{autoId} — with reporterId, type, targetId, reason, details, status
 *   The admin/guardian can later query this collection to review reports.
 *
 * CALLED BY: PublicProfile.tsx (report user), ItemDetailsSheet.tsx (report content)
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Send, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logEvent } from '../lib/analytics';

/**
 * REPORT REASONS:
 * These match the standard categories Apple expects for UGC moderation.
 * Each one maps to a clear violation type that a moderator can act on.
 */
const REPORT_REASONS = [
  'Spam or fake content',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Inappropriate or offensive content',
  'Scam or fraud',
  'Impersonation',
  'Other',
];

interface ReportSheetProps {
  /** What kind of thing is being reported: a user, an item/post, or a comment */
  type: 'USER' | 'ITEM' | 'COMMENT';
  /** The Firestore document ID of the thing being reported */
  targetId: string;
  /** A human-readable name for context (e.g., user's display name or item title) */
  targetName: string;
  /** Callback to close the sheet */
  onClose: () => void;
}

export default function ReportSheet({ type, targetId, targetName, onClose }: ReportSheetProps) {
  const { user, profile } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /**
   * handleSubmit():
   * Creates a report document in Firestore.
   * The document contains everything a moderator needs to review:
   * who reported, what was reported, why, and any additional context.
   */
  const handleSubmit = async () => {
    if (!selectedReason || !user) return;
    setSubmitting(true);

    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterName: profile?.displayName || 'Anonymous',
        type,
        targetId,
        targetName,
        reason: selectedReason,
        details: details.trim(),
        status: 'PENDING',
        createdAt: serverTimestamp(),
      });

      logEvent('content_reported', {
        content_type: type,
        target_id: targetId,
        reason: selectedReason
      });

      setSubmitted(true);
      // Auto-close after showing the thank-you message
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      console.error('Failed to submit report:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = type === 'USER' ? 'Neighbor' : type === 'ITEM' ? 'Content' : 'Comment';

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[1200] flex items-end justify-center px-4 pb-4 sm:pb-20">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm"
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-[1201]"
        >
          {submitted ? (
            /* ═══════════════════════════════════════════ */
            /* THANK YOU STATE                             */
            /* Shown after successful report submission    */
            /* ═══════════════════════════════════════════ */
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h3 className="serif text-2xl font-bold text-stone-900">Thank you</h3>
              <p className="text-stone-500 text-sm max-w-xs">
                Your report has been submitted. Our team will review it and take appropriate action.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-6 sm:p-8 border-b border-stone-100 flex items-center justify-between flex-none">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="serif text-xl sm:text-2xl font-bold text-stone-900 leading-none">
                      Report {typeLabel}
                    </h3>
                    <p className="text-stone-400 text-[10px] sm:text-xs mt-1 font-medium uppercase tracking-widest">
                      {targetName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
                {/* Reason Selection */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-stone-500 px-1">
                    What's the issue?
                  </label>
                  <div className="space-y-2">
                    {REPORT_REASONS.map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setSelectedReason(reason)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all text-sm font-medium ${
                          selectedReason === reason
                            ? 'border-[#C86A51] bg-[#C86A51]/5 text-[#C86A51]'
                            : 'border-stone-100 bg-stone-50/50 text-stone-700 hover:border-stone-200'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-stone-500 px-1">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Tell us more about what happened..."
                    className="w-full rounded-2xl border border-stone-200 p-4 min-h-[100px] text-sm focus:border-[#C86A51] focus:ring-1 focus:ring-[#C86A51] outline-none resize-none bg-stone-50/50"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-100 flex gap-3 flex-none">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-[#F3F1EB] text-stone-700 font-bold rounded-2xl hover:bg-stone-200 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedReason || submitting}
                  className="flex-1 py-3 px-4 bg-[#C86A51] hover:bg-[#B55A42] text-white font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                >
                  <Send size={16} />
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
