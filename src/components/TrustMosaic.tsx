/**
 * FILE: TrustMosaic.tsx
 * ROLE IN KULA: The "Community Passport" — a visual dashboard of a user's participation.
 * 
 * CIRCUIT: This is the READ SIDE of the Trust Engine.
 *   GratitudeFlow.tsx WRITES to trustMosaic (increments counters).
 *   This component READS those counters and renders them as a visual dashboard.
 * 
 * GROWTH STAGE ALGORITHM:
 *   getGrowthStage() maps raw numbers to metaphorical labels:
 *     - SEEDLING: 0 completed exchanges (just joined)
 *     - SPROUT: 1-4 exchanges (getting started)
 *     - TREE: 5-14 exchanges + 1 İmece participation (active contributor)
 *     - OLD_GROWTH: 15+ exchanges + 3 İmece + 2 vouches (community pillar)
 *     - ELDER: 30+ exchanges + 5 İmece (long-standing leader)
 *   Each stage has a color, icon, and description that maps to the Berlin Analog aesthetic.
 * 
 * SECTIONS:
 *   1. Growth Stage Banner — the metaphorical title (Seedling → Elder)
 *   2. Stats Bento Grid — 3 tiles showing Exchanges, İmece, and Circle counts
 *   3. Member Since — timestamp from UserProfile.createdAt
 *   4. Gratitude Wall — live feed of thank-you notes from other users
 *      (Subscribes to `gratitude_notes WHERE toUserId == this user`, ordered by recency)
 * 
 * USED BY:
 *   - Profile.tsx — shows YOUR trust mosaic on your own profile
 *   - PublicProfile.tsx — shows SOMEONE ELSE's trust mosaic (compact mode)
 */
import React, { useState, useEffect } from 'react';
import { TrustMosaic as TrustMosaicType, GratitudeNote, GrowthStage } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Sprout, TreePine, Trees, Home, Handshake, Users, Heart, Calendar, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TrustMosaicProps {
  userId: string;
  mosaic?: TrustMosaicType;
  memberSince?: any;
  compact?: boolean; // For PublicProfile (slightly smaller layout)
}

function getGrowthStage(mosaic?: TrustMosaicType): GrowthStage {
  if (!mosaic || mosaic.completedExchanges === 0) return 'SEEDLING';
  if (mosaic.completedExchanges < 5) return 'SPROUT';
  if (mosaic.completedExchanges < 15 && mosaic.imeceParticipations >= 1) return 'TREE';
  if (mosaic.completedExchanges >= 15 && mosaic.imeceParticipations >= 3 && mosaic.vouchCount >= 2) return 'OLD_GROWTH';
  if (mosaic.completedExchanges >= 30 && mosaic.imeceParticipations >= 5) return 'ELDER';
  // Fallback: if they have lots of exchanges but not enough imece, still give TREE
  if (mosaic.completedExchanges >= 5) return 'TREE';
  return 'SPROUT';
}

const stageConfig: Record<GrowthStage, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; description: string }> = {
  SEEDLING: {
    label: 'Seedling',
    icon: <Sprout size={24} />,
    color: 'text-lime-600',
    bg: 'bg-lime-50',
    border: 'border-lime-100',
    description: 'Just planted in the neighborhood'
  },
  SPROUT: {
    label: 'Sprout',
    icon: <Sprout size={24} />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    description: 'Growing roots in the community'
  },
  TREE: {
    label: 'Tree',
    icon: <TreePine size={24} />,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-100',
    description: 'A reliable presence in the Kiez'
  },
  OLD_GROWTH: {
    label: 'Old Growth',
    icon: <Trees size={24} />,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    description: 'Deep roots, trusted by many'
  },
  ELDER: {
    label: 'Neighborhood Elder',
    icon: <Home size={24} />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    description: 'A pillar of the community'
  }
};

export default function TrustMosaicComponent({ userId, mosaic, memberSince, compact }: TrustMosaicProps) {
  const [notes, setNotes] = useState<GratitudeNote[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const stage = getGrowthStage(mosaic);
  const config = stageConfig[stage];

  useEffect(() => {
    const q = query(
      collection(db, 'gratitude_notes'),
      where('toUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as GratitudeNote)));
      setLoadingNotes(false);
    }, () => {
      // Index might not exist yet, silently handle
      setLoadingNotes(false);
    });

    return () => unsub();
  }, [userId]);

  const displayedNotes = showAllNotes ? notes : notes.slice(0, 3);

  const formatMemberSince = () => {
    if (!memberSince) return 'Recently joined';
    try {
      const date = typeof memberSince?.toDate === 'function' ? memberSince.toDate() : memberSince;
      return formatDistanceToNow(date, { addSuffix: false });
    } catch {
      return 'Recently joined';
    }
  };

  return (
    <div className="space-y-4">
      {/* Growth Stage Banner */}
      <div className={`${config.bg} ${config.border} border rounded-[2rem] p-5 flex items-center gap-4`}>
        <div className={`w-14 h-14 rounded-2xl ${config.bg} border ${config.border} flex items-center justify-center ${config.color} shadow-sm`}>
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black uppercase tracking-widest ${config.color}`}>
              {config.label}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{config.description}</p>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 text-center space-y-1 hover:shadow-sm transition-all">
          <div className="flex items-center justify-center gap-1 text-stone-800">
            <Handshake size={16} className="text-emerald-500" />
            <span className="text-xl font-black">{mosaic?.completedExchanges || 0}</span>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 leading-none block">
            Exchanges
          </span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 text-center space-y-1 hover:shadow-sm transition-all">
          <div className="flex items-center justify-center gap-1 text-stone-800">
            <Heart size={16} className="text-amber-500" />
            <span className="text-xl font-black">{mosaic?.imeceParticipations || 0}</span>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 leading-none block">
            İmece
          </span>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-4 text-center space-y-1 hover:shadow-sm transition-all">
          <div className="flex items-center justify-center gap-1 text-stone-800">
            <Users size={16} className="text-indigo-500" />
            <span className="text-xl font-black">{mosaic?.circleCount || 0}</span>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 leading-none block">
            Circles
          </span>
        </div>
      </div>

      {/* Member Since */}
      <div className="flex items-center justify-center gap-2 text-stone-400">
        <Calendar size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          Neighbor for {formatMemberSince()}
        </span>
      </div>

      {/* Gratitude Wall */}
      {(notes.length > 0 || loadingNotes) && (
        <div className="space-y-3 pt-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
            <span>💌</span> Gratitude Wall
            {notes.length > 0 && (
              <span className="bg-stone-100 px-2 py-0.5 rounded-full text-stone-500">{notes.length}</span>
            )}
          </h4>

          {loadingNotes ? (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse bg-stone-50 rounded-2xl p-4 h-20 border border-stone-100" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayedNotes.map(note => (
                <div key={note.id} className="bg-stone-50 rounded-2xl p-4 border border-stone-100 hover:shadow-sm transition-all">
                  <p className="text-sm text-stone-700 leading-relaxed italic">
                    "{note.text}"
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 flex-shrink-0">
                        <span className="text-[8px] font-bold uppercase">{note.fromUserName?.charAt(0)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-600">{note.fromUserName}</span>
                    </div>
                    <span className="text-[9px] text-stone-400 font-medium">
                      for "{note.itemTitle}"
                    </span>
                  </div>
                </div>
              ))}

              {notes.length > 3 && !showAllNotes && (
                <button
                  onClick={() => setShowAllNotes(true)}
                  className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors py-2"
                >
                  <ChevronDown size={14} />
                  Show {notes.length - 3} more
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
