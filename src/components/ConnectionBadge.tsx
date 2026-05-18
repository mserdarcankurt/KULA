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
import { Share2 } from 'lucide-react';

interface ConnectionBadgeProps {
  targetUserId: string;
  className?: string;
  showLineage?: boolean;
}

export default function ConnectionBadge({ targetUserId, className = "", showLineage = false }: ConnectionBadgeProps) {
  const { user } = useAuth();
  const [data, setData] = useState<{ degrees: number | null; via?: string; fullChain?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

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
    1: { label: '1st Degree', color: 'text-emerald-600', bg: 'bg-emerald-50', dots: '●─●' },
    2: { label: '2nd Degree', color: 'text-blue-600', bg: 'bg-blue-50', dots: '●─●─●' },
    3: { label: '3rd Degree', color: 'text-amber-600', bg: 'bg-amber-50', dots: '●─●─●─●' },
    default: { label: `${data.degrees} Degrees`, color: 'text-stone-500', bg: 'bg-stone-50', dots: '● ... ●' }
  };

  const style = config[data.degrees as keyof typeof config] || config.default;

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${style.bg} ${style.color} border border-current border-opacity-10`}>
        <span className="font-mono text-[8px] tracking-tight font-bold">{style.dots}</span>
        <span className="text-[9px] font-black uppercase tracking-widest">{style.label}</span>
      </div>
      {showLineage && data.fullChain && data.fullChain.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-stone-500 font-bold mt-1 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-100">
          {data.fullChain.map((name, idx) => (
            <React.Fragment key={idx}>
              <span className={idx === 0 ? 'text-[--color-brand]' : idx === data.fullChain!.length - 1 ? 'text-stone-900' : ''}>
                {idx === 0 ? 'You' : name.split(' ')[0]}
              </span>
              {idx < data.fullChain!.length - 1 && (
                <span className="text-stone-300 font-mono">➔</span>
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
