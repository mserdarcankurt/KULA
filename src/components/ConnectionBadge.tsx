import React, { useState, useEffect } from 'react';
import { getDegreesOfSeparation } from '../lib/trustGraph';
import { useAuth } from '../hooks/useAuth';
import { Share2 } from 'lucide-react';

interface ConnectionBadgeProps {
  targetUserId: string;
  className?: string;
}

export default function ConnectionBadge({ targetUserId, className = "" }: ConnectionBadgeProps) {
  const { user } = useAuth();
  const [data, setData] = useState<{ degrees: number | null; via?: string } | null>(null);
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
          setData({ degrees: result.degrees, via });
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
    <div className={`inline-flex flex-col items-start gap-0.5 ${className}`}>
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${style.bg} ${style.color} border border-current border-opacity-10`}>
        <span className="font-mono text-[8px] tracking-tight font-bold">{style.dots}</span>
        <span className="text-[9px] font-black uppercase tracking-widest">{style.label}</span>
      </div>
      {data.via && (
        <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider ml-1">
          via {data.via}
        </span>
      )}
    </div>
  );
}
