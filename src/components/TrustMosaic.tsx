/**
 * FILE: TrustMosaic.tsx
 * ROLE IN KULA: The "Community Passport" — a visual dashboard of a user's participation.
 * 
 * [ALPHA] Simplified for closed alpha:
 *   - Growth Stage levels (Seedling → Elder) REMOVED
 *   - Replaced with clear per-type counters: "X asks, Y shares, Z joins completed"
 *   - Gratitude Wall retained intact
 * 
 * DATA SOURCE:
 *   - mosaic.completedExchanges — incremented by GratitudeFlow.tsx on any exchange
 *   - mosaic.completedAsks / completedShares / completedJoins — per-type counters
 *     (new fields, will be 0 for old users until they complete exchanges)
 *   - mosaic.circleCount — circles the user belongs to
 * 
 * USED BY:
 *   - Profile.tsx — shows YOUR trust mosaic on your own profile
 *   - PublicProfile.tsx — shows SOMEONE ELSE's trust mosaic (compact mode)
 */
import React, { useState, useEffect } from 'react';
import { TrustMosaic as TrustMosaicType, GratitudeNote } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Handshake, Users, Calendar, ChevronDown, Package, MessageSquare, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TrustMosaicProps {
  userId: string;
  mosaic?: TrustMosaicType;
  memberSince?: any;
  compact?: boolean; // For PublicProfile (slightly smaller layout)
}

export default function TrustMosaicComponent({ userId, mosaic, memberSince, compact }: TrustMosaicProps) {
  const [notes, setNotes] = useState<GratitudeNote[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);

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

  // Per-type counts — use specific fields if available, otherwise split total evenly
  // New: completedAsks, completedShares, completedJoins fields
  // Legacy: fall back to completedExchanges total
  const completedAsks = (mosaic as any)?.completedAsks ?? 0;
  const completedShares = (mosaic as any)?.completedShares ?? 0;
  const completedJoins = (mosaic as any)?.completedJoins ?? 0;
  const totalExchanges = mosaic?.completedExchanges ?? 0;

  const stats = [
    {
      icon: <MessageSquare size={compact ? 14 : 16} className="text-[#8B7E66]" />,
      count: completedAsks,
      label: completedAsks === 1 ? 'Ask' : 'Asks',
      sublabel: 'completed',
      color: 'bg-[#FAF7F0] border-[#E8E2D2]',
    },
    {
      icon: <Package size={compact ? 14 : 16} className="text-[#3D5A40]" />,
      count: completedShares,
      label: completedShares === 1 ? 'Share' : 'Shares',
      sublabel: 'completed',
      color: 'bg-emerald-50/40 border-emerald-200/40',
    },
    {
      icon: <Users size={compact ? 14 : 16} className="text-[#3F726A]" />,
      count: completedJoins,
      label: completedJoins === 1 ? 'Join' : 'Joins',
      sublabel: 'completed',
      color: 'bg-teal-50/40 border-teal-200/40',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Simple stats — what matters is what you've done, not a label */}
      <div className={`grid grid-cols-3 gap-${compact ? '2' : '3'}`}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.color} border rounded-2xl ${compact ? 'p-3' : 'p-4'} flex flex-col items-center text-center gap-1.5 hover:shadow-sm transition-all`}
          >
            {stat.icon}
            <span className={`${compact ? 'text-lg' : 'text-2xl'} font-black text-stone-800 leading-none`}>
              {stat.count}
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#7A6D55]">
                {stat.label}
              </span>
              <span className="text-[7px] font-bold text-stone-400 uppercase tracking-wide">
                {stat.sublabel}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total exchanges (if any exist but per-type is all zeros, show total as fallback) */}
      {totalExchanges > 0 && (completedAsks + completedShares + completedJoins === 0) && (
        <div className="flex items-center justify-center gap-2 bg-[#FAF7F0] border border-[#E8E2D2] rounded-2xl p-3 shadow-sm">
          <Handshake size={14} className="text-emerald-600" />
          <span className="text-sm font-black text-brand">{totalExchanges}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#7A6D55]">exchanges completed</span>
        </div>
      )}

      {/* Circles & Member Since */}
      <div className="flex items-center justify-between px-1">
        {mosaic?.circleCount !== undefined && mosaic.circleCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
              {mosaic.circleCount} {mosaic.circleCount === 1 ? 'circle' : 'circles'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Calendar size={12} className="text-stone-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
            Neighbor for {formatMemberSince()}
          </span>
        </div>
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
