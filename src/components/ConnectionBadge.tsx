/**
 * FILE: ConnectionBadge.tsx
 * ROLE IN KULA: The "Trust Distance Indicator" — shows how closely connected two users are.
 * 
 * CIRCUIT C (Trust Fabric):
 *   This component visualizes the OUTPUT of the trust graph algorithm.
 *   It calls trustGraph.ts → getDegreesOfSeparation() to find the shortest path
 *   between the current user and a target user through the invite/vouch network.
 * 
 * VISUAL OUTPUT:
 *   - 1st Degree (emerald): Direct connection (you invited them or they invited you)
 *   - 2nd Degree (blue): Friend of a friend
 *   - 3rd Degree (amber): Three hops away
 *   - 4+ Degrees (stone): Distant connection
 * 
 * "VIA" DISPLAY:
 *   When showLineage is true, the badge shows the FULL trust chain:
 *     "You → Bob → Carol → Target"
 *   When showLineage is false, it just shows "via Bob" (the first intermediary).
 *   This comes from the `chain` array returned by getDegreesOfSeparation().
 * 
 * USED BY:
 *   - PublicProfile.tsx — shows trust distance on someone's profile page
 *   - ItemDetailsSheet.tsx — shows how close you are to the item poster
 *   - Feed.tsx — compact badge on item cards in the feed
 * 
 * PERFORMANCE:
 *   The BFS calculation runs ONCE when the component mounts (or targetUserId changes).
 *   Results are not cached between renders — each badge independently calculates.
 *   For a feed of 20 items with 10 unique owners, that's 10 BFS traversals.
 */
import React, { useState, useEffect } from 'react';
import { getDegreesOfSeparation } from '../lib/trustGraph';
import { useAuth } from '../hooks/useAuth';
import { Share2, Info } from 'lucide-react';

interface ConnectionBadgeProps {
  targetUserId: string;
  className?: string;
  showLineage?: boolean;
}

export default function ConnectionBadge({ targetUserId, className = "", showLineage = false }: ConnectionBadgeProps) {
  const { user } = useAuth();
  const [data, setData] = useState<{ degrees: number | null; via?: string; fullChain?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!user || !targetUserId || user.uid === targetUserId) {
      setLoading(false);
      return;
    }

    async function calculate() {
      try {
        const result = await getDegreesOfSeparation(user!.uid, targetUserId);
        if (result.degrees !== null) {
          // Find the "via" person (the first step in the chain from the current user)
          // chain[0] is current user, chain[1] is host, etc.
          const via = result.chain.length > 2 ? result.chain[1].name : undefined;
          const fullChain = result.chain.map(node => node.name);
          setData({ degrees: result.degrees, via, fullChain });
        }
      } catch (err) {
        console.error('Failed to calculate connection:', err);
      } finally {
        setLoading(false);
      }
    }

    calculate();
  }, [user?.uid, targetUserId]);

  if (loading || !data || data.degrees === null) return null;

  const config = {
    1: { label: '1st Degree', color: 'text-[#3D5A40]', bg: 'bg-[#E8EFE9]', border: 'border-[#D1DFD3]', dots: '●──●' },
    2: { label: '2nd Degree', color: 'text-[#A0522D]', bg: 'bg-[#FDF5E6]', border: 'border-[#F5DEB3]', dots: '●──●──●' },
    3: { label: '3rd Degree', color: 'text-[#B38F4F]', bg: 'bg-[#FAF6EE]', border: 'border-[#EEDCA5]', dots: '●──●──●──●' },
    default: { label: `${data.degrees} Degrees`, color: 'text-[#5C5C5C]', bg: 'bg-[#F7F6F2]', border: 'border-[#E8E7E3]', dots: '● ── ●' }
  };

  const style = config[data.degrees as keyof typeof config] || config.default;

  const getTooltipText = () => {
    if (!data) return '';
    if (data.degrees === 1) {
      return "Direct connection. You either invited them, they invited you, or you have vouched for each other.";
    }
    if (data.degrees === 2 && data.via) {
      return `Friend of a friend. You are connected to them through ${data.via.split(' ')[0]}.`;
    }
    const chainString = data.fullChain 
      ? data.fullChain.map((n, idx) => (idx === 0 ? 'You' : n.split(' ')[0])).join(' ➔ ')
      : '';
    return `Connected via trust chain: ${chainString || `${data.degrees} hops away`}.`;
  };

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div 
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${style.bg} ${style.color} border ${style.border} cursor-pointer hover:opacity-90 transition-all relative`}
      >
        <span className="font-mono text-[8px] tracking-tight font-bold">{style.dots}</span>
        <span className="text-[9px] font-black uppercase tracking-widest">{style.label}</span>
        <Info size={10} className="opacity-70 hover:opacity-100 transition-opacity ml-0.5" />

        {showTooltip && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[99] bg-stone-900 text-stone-100 text-[10px] leading-relaxed p-3 rounded-2xl shadow-xl border border-stone-800 w-52 text-center normal-case font-medium">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 rotate-45 border-t border-l border-stone-800" />
            {getTooltipText()}
          </div>
        )}
      </div>
      {showLineage && data.fullChain && data.fullChain.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#7A6D55] mt-2 bg-[#FAF7F0] px-4 py-2 rounded-2xl border border-[#E8E2D2] shadow-sm">
          {data.fullChain.map((name, idx) => (
            <React.Fragment key={idx}>
              <span className={idx === 0 ? 'text-stone-400 font-medium normal-case' : idx === data.fullChain!.length - 1 ? 'text-[#5B6B56] font-black' : 'text-stone-600 font-bold'}>
                {idx === 0 ? 'You' : name.split(' ')[0]}
              </span>
              {idx < data.fullChain!.length - 1 && (
                <span className="text-stone-300 font-mono font-normal">➔</span>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : data.via && (
        <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider ml-1">
          via {data.via}
        </span>
      )}
    </div>
  );
}
