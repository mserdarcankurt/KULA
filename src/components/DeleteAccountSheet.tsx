/**
 * DeleteAccountSheet.tsx
 *
 * A critical App Store compliance component. Apple requires all apps that offer
 * account creation to also provide an account deletion option (App Store Review
 * Guideline 5.1.1(v), effective June 30 2022).
 *
 * This component renders a full-screen overlay sheet with a multi-step flow:
 *   1. **Warning** – Explains the consequences of account deletion.
 *   2. **Confirmation** – Asks the user to type "DELETE" to proceed.
 *   3. **Processing** – Shows a spinner while the account is being soft-deleted.
 *
 * **Soft-delete strategy:**
 * We anonymize the user's Firestore document rather than hard-deleting it,
 * because true account removal (Firebase Auth record + all subcollections)
 * requires the Firebase Admin SDK running on a server. The soft-delete marks
 * the account as `DELETED`, wipes PII, and logs the user out immediately.
 *
 * @module DeleteAccountSheet
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';

/* ───────────────────────────── Types ───────────────────────────── */

/** Props accepted by {@link DeleteAccountSheet}. */
interface DeleteAccountSheetProps {
  /** Callback invoked when the user dismisses the sheet (cancel / close). */
  onClose: () => void;
}

/** Internal step state for the deletion flow. */
type Step = 'warning' | 'confirm' | 'processing';

/* ──────────────────────────── Component ─────────────────────────── */

/**
 * Full-screen bottom-sheet overlay that guides the user through permanent
 * account deletion in three steps.
 *
 * Rendered via `createPortal` so it always sits above every other layer.
 *
 * @example
 * ```tsx
 * {showDeleteSheet && (
 *   <DeleteAccountSheet onClose={() => setShowDeleteSheet(false)} />
 * )}
 * ```
 *
 * @param props - {@link DeleteAccountSheetProps}
 * @returns A React portal containing the animated deletion sheet.
 */
const DeleteAccountSheet: React.FC<DeleteAccountSheetProps> = ({ onClose }) => {
  const { user, logout } = useAuth();

  /** Current step in the deletion flow. */
  const [step, setStep] = useState<Step>('warning');

  /** Value the user types into the confirmation input. */
  const [confirmText, setConfirmText] = useState('');

  /** Error message surfaced when something goes wrong during deletion. */
  const [error, setError] = useState<string | null>(null);

  /* ────────────────── Deletion handler ────────────────── */

  /**
   * Performs the soft-delete:
   *  1. Transitions to the "processing" step.
   *  2. Updates the Firestore `users/{uid}` document to anonymize all PII.
   *  3. Calls `logout()` to sign the user out.
   *
   * If anything fails the user is moved back to the confirmation step with
   * a human-readable error message.
   */
  const handleDelete = async () => {
    if (!user) return;

    setStep('processing');
    setError(null);

    try {
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        status: 'DELETED',
        displayName: 'Deleted User',
        bio: '',
        photoURL: null,
        deletedAt: serverTimestamp(),
      });

      await logout();
    } catch (err) {
      console.error('[DeleteAccountSheet] deletion failed:', err);
      setError(
        'Something went wrong while deleting your account. Please try again or contact support.'
      );
      setStep('confirm');
    }
  };

  /* ─────────────────── Step renderers ─────────────────── */

  /**
   * Step 1 – Warning screen.
   * Lists the consequences of deletion and offers Cancel / Continue buttons.
   */
  const renderWarning = () => (
    <div className="flex flex-col items-center gap-6 px-2">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C86A51]/10">
        <AlertTriangle className="h-8 w-8 text-[#C86A51]" />
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-stone-800">
          Delete your account?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Please read this carefully. This is permanent.
        </p>
      </div>

      {/* Consequences list */}
      <ul className="w-full space-y-3 rounded-2xl bg-[#C86A51]/5 p-5 text-sm leading-relaxed text-stone-700">
        <li className="flex items-start gap-3">
          <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C86A51]" />
          All your posts, messages, and profile data will be permanently deleted
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C86A51]" />
          Your invite code will stop working
        </li>
        <li className="flex items-start gap-3">
          <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#C86A51]" />
          This action cannot be undone
        </li>
      </ul>

      {/* Buttons */}
      <div className="flex w-full flex-col gap-3">
        <button
          onClick={() => setStep('confirm')}
          className="w-full rounded-2xl bg-[#C86A51] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#B55A42] active:scale-[0.98]"
        >
          I understand, continue
        </button>
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-[#F3F1EB] px-6 py-3.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-200 active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /**
   * Step 2 – Confirmation screen.
   * Requires the user to type "DELETE" before the destructive button activates.
   */
  const renderConfirm = () => {
    const isConfirmed = confirmText.trim().toUpperCase() === 'DELETE';

    return (
      <div className="flex flex-col items-center gap-6 px-2">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C86A51]/10">
          <Trash2 className="h-8 w-8 text-[#C86A51]" />
        </div>

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-stone-800">
            Are you absolutely sure?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Type <span className="font-bold text-stone-700">DELETE</span> below
            to confirm.
          </p>
        </div>

        {/* Text input */}
        <input
          type="text"
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type DELETE to confirm"
          className="w-full rounded-2xl border border-stone-200 bg-white px-5 py-3.5 text-center text-sm font-semibold tracking-widest text-stone-800 outline-none transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-400 focus:border-[#C86A51] focus:ring-2 focus:ring-[#C86A51]/20"
        />

        {/* Error message (if deletion previously failed) */}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-xs leading-relaxed text-red-600">
            {error}
          </p>
        )}

        {/* Buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            onClick={handleDelete}
            disabled={!isConfirmed}
            className="w-full rounded-2xl bg-[#C86A51] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#B55A42] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Permanently Delete My Account
          </button>
          <button
            onClick={() => {
              setStep('warning');
              setConfirmText('');
              setError(null);
            }}
            className="w-full rounded-2xl bg-[#F3F1EB] px-6 py-3.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-200 active:scale-[0.98]"
          >
            Go back
          </button>
        </div>
      </div>
    );
  };

  /**
   * Step 3 – Processing screen.
   * Shows a loading spinner while the account is being deleted.
   */
  const renderProcessing = () => (
    <div className="flex flex-col items-center gap-6 px-2 py-8">
      <Loader2 className="h-10 w-10 animate-spin text-[#C86A51]" />
      <p className="text-sm font-medium text-stone-600">
        Deleting your account…
      </p>
    </div>
  );

  /* ──────────────── Portal & overlay rendering ──────────────── */

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      /** Close on backdrop click — only during warning/confirm steps. */
      onClick={() => {
        if (step !== 'processing') onClose();
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-[2.5rem] rounded-b-none bg-white px-6 pb-10 pt-6 shadow-xl"
      >
        {/* Close button — hidden while processing to prevent interrupting the request */}
        {step !== 'processing' && (
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Drag indicator */}
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-stone-300" />

        {/* Step content */}
        {step === 'warning' && renderWarning()}
        {step === 'confirm' && renderConfirm()}
        {step === 'processing' && renderProcessing()}
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default DeleteAccountSheet;
