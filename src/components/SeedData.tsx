import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, serverTimestamp, writeBatch, doc, getDocs, query, where, deleteDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useGeolocation } from '../hooks/useGeolocation';
import { RefreshCw } from 'lucide-react';
import { ItemType, KulaReachType } from '../types';

const seedNames = ["Alice Chen", "Bob Miller", "Chloe Smith", "David Park", "Elena Rodriguez", "Faisal Kahn", "Greta Braun", "Henry Davis"];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, user: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: user?.uid },
    operationType,
    path
  };
  
  if (errInfo.error.includes('Quota limit exceeded') || errInfo.error.includes('quota')) {
    console.warn("Database quota exceeded during seed operation.");
    throw new Error("Quota limit exceeded. Retry after quota limits are reset.");
  }
  
  throw new Error(JSON.stringify(errInfo));
}

export default function SeedData({ onComplete }: { onComplete?: () => void }) {
  const { user, profile } = useAuth();
  const { location } = useGeolocation();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{text: string, type: 'error' | 'success'} | null>(null);

  const handleSeed = async () => {
    if (!user || !profile) {
      setStatusMessage({ text: "Missing user context. Try reloading.", type: 'error' });
      return;
    }

    setStatusMessage(null);
    const baseLocation = location || profile.location || { lat: 52.5200, lng: 13.4050 };

    setLoading(true);
    console.log("Starting seed process...");

    // Timeout fallback to ensure we don't spin forever
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Operation timed out after 30 seconds.")), 30000)
    );

    const runSeed = async () => {
      setStatusMessage({ text: "Step 1: Contacting secure backend seeder...", type: 'success' });
      
      const response = await fetch('/api/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          callerUid: user.uid,
          userEmail: user.email,
          userDisplayName: profile.displayName,
          userPhoto: profile.photoURL,
          baseLocation: baseLocation
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed via backend');
      }
      
      return data;
    };

    try {
      await Promise.race([runSeed(), timeoutPromise]);
      console.log("Successfully seeded rich test data via backend.");
      setStatusMessage({ text: "Successfully seeded test data securely!", type: 'success' });
      if (onComplete) {
        setTimeout(onComplete, 1000);
      }
    } catch (e: any) {
      console.error("Failed to seed data:", e);
      let msg = e.message;
      setStatusMessage({ text: "Failed to seed data: " + msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button 
        onClick={handleSeed}
        disabled={loading}
      className={`w-full py-4 border-2 border-dashed rounded-[1.5rem] font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all disabled:opacity-50
        ${loading ? 'bg-stone-50 border-stone-100 text-stone-400 cursor-not-allowed' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}
      `}
    >
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
      {loading ? "Planting rich seeds..." : "Regenerate Test Data"}
      </button>
      {statusMessage && (
        <div className={`text-xs text-center px-4 py-2 rounded-lg ${statusMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {statusMessage.text}
        </div>
      )}
    </div>
  );
}
