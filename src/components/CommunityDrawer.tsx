/**
 * FILE: CommunityDrawer.tsx
 * ROLE IN KULA: The Community Landscape overlay — slide-up drawer containing
 * the Neighborhood Map and the Trust Network / Lineage Graph.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, Users, X, Sliders, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useItems } from '../hooks/useItems';
import MapView from './MapView';
import { ItemDetailsSheet } from './ItemDetailsSheet';
import PublicProfile from './PublicProfile';
import { Circle } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ART_DIRECTION } from '../lib/artDirection';

const NetworkGraph = React.lazy(() => import('./NetworkGraph'));

interface CommunityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number } | null;
  onNavigateToChat?: (chatId: string) => void;
}

const TRUST_LEVELS = [
  { value: 1, label: 'Direct trust', short: '1st Degree', desc: 'Only your direct connections' },
  { value: 2, label: 'Friends of friends', short: '2nd Degree', desc: '2 handshakes away' },
  { value: 3, label: 'Extended network', short: '3rd Degree', desc: '3 handshakes away' },
  { value: 4, label: 'Community reach', short: '4th Degree', desc: '4 handshakes away' },
  { value: 5, label: 'Wide neighborhood', short: '5th Degree', desc: '5 handshakes away' },
  { value: 6, label: 'Whole world', short: 'All', desc: 'No connection filter' },
];

/* ── Map Wrapper with Items Hook ── */
function MapFeedView({ 
  location, 
  trustFilter,
  circleFilter,
  typeFilter,
  categoryFilter,
  onNavigateToChat
}: { 
  location: { lat: number; lng: number } | null;
  trustFilter: number;
  circleFilter: string;
  typeFilter: string;
  categoryFilter: string;
  onNavigateToChat?: (chatId: string) => void;
}) {
  const { profile } = useAuth();
  const { items } = useItems(location, profile);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  
  const filteredItems = items.filter(item => {
    if (trustFilter < 6) {
      if (item.degrees === undefined || item.degrees > trustFilter) return false;
    }
    if (circleFilter && circleFilter !== 'ALL') {
      if (item.circleId !== circleFilter && !item.targetCircles?.includes(circleFilter)) return false;
    }
    if (typeFilter !== 'ALL') {
      if (item.type !== typeFilter) return false;
    }
    if (categoryFilter !== 'ALL') {
      if (item.category !== categoryFilter) return false;
    }
    return true;
  });

  return (
    <div className="relative h-full w-full">
      <MapView
        items={filteredItems.filter(i => i.status === 'ACTIVE')}
        center={location || { lat: 52.5200, lng: 13.4050 }}
        onItemClick={setDetailItem}
      />

      {detailItem && (
        <ItemDetailsSheet 
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onViewProfile={(userId) => {
            setSelectedProfileId(userId);
            setDetailItem(null);
          }}
        />
      )}

      {selectedProfileId && (
        <PublicProfile 
          userId={selectedProfileId} 
          onClose={() => setSelectedProfileId(null)} 
          onNavigateToChat={onNavigateToChat}
        />
      )}
    </div>
  );
}

/* ── Filters Popover Component ── */
function FilterPopover({
  selectedFilterScope,
  setSelectedFilterScope,
  joinedCirclesList,
  typeFilter,
  setTypeFilter,
  categoryFilter,
  setCategoryFilter,
  onReset
}: {
  selectedFilterScope: string;
  setSelectedFilterScope: (v: string) => void;
  joinedCirclesList: Circle[];
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="bg-[#FDFBF4] rounded-2xl border border-[#D9D0C0] shadow-xl w-72 p-4 space-y-4 text-left">
      <div className="border-b border-[#E8E0D0] pb-2 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#9B8E78]">
          Map Filters
        </span>
        {(selectedFilterScope !== 'trust_6' || typeFilter !== 'ALL' || categoryFilter !== 'ALL') && (
          <button
            onClick={onReset}
            className="text-[9px] font-black uppercase tracking-wider text-[#C86A51] hover:underline"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Scope */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5B6B56] block">
          Trust Reach
        </label>
        <select
          value={selectedFilterScope}
          onChange={(e) => setSelectedFilterScope(e.target.value)}
          className="w-full text-[11px] font-bold bg-[#F6F4EE] border border-[#D9D0C0] rounded-xl px-3 py-2 text-stone-700 focus:outline-none focus:border-[#5B6B56] cursor-pointer"
        >
          <optgroup label="Connection Levels">
            <option value="trust_6">Whole World (All)</option>
            {TRUST_LEVELS.filter(l => l.value < 6).map(level => (
              <option key={level.value} value={`trust_${level.value}`}>
                {`${level.short} (${level.label})`}
              </option>
            ))}
          </optgroup>
          {joinedCirclesList.length > 0 && (
            <optgroup label="Your Circles">
              {joinedCirclesList.map(circle => (
                <option key={circle.id} value={`circle_${circle.id}`}>
                  {circle.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5B6B56] block">
          Type
        </label>
        <div className="grid grid-cols-4 gap-1">
          {['ALL', 'ASK', 'SHARE', 'JOIN'].map((t) => {
            const isActive = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all border ${
                  isActive
                    ? 'bg-[#5B6B56] text-white border-[#5B6B56] shadow-sm'
                    : 'bg-[#F6F4EE] text-stone-600 border-[#D9D0C0] hover:bg-[#EADFC9]'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'ASK' ? 'Ask' : t === 'SHARE' ? 'Share' : 'Join'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-[#5B6B56] block">
          Category
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full text-[11px] font-bold bg-[#F6F4EE] border border-[#D9D0C0] rounded-xl px-3 py-2 text-stone-700 focus:outline-none focus:border-[#5B6B56] cursor-pointer"
        >
          <option value="ALL">All Categories</option>
          {Object.keys(ART_DIRECTION.fallbacks)
            .filter(cat => cat !== 'CircleInvite' && cat !== 'Default')
            .map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}

/* ── Main Drawer Component ── */
export default function CommunityDrawer({ isOpen, onClose, location, onNavigateToChat }: CommunityDrawerProps) {
  const { profile } = useAuth();
  const [view, setView] = useState<'MAP' | 'NETWORK'>('MAP');
  const [selectedFilterScope, setSelectedFilterScope] = useState<string>('trust_6');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [joinedCirclesList, setJoinedCirclesList] = useState<Circle[]>([]);

  useEffect(() => {
    if (profile?.joinedCircles && profile.joinedCircles.length > 0) {
      const fetchJoinedCircles = async () => {
        try {
          const promises = profile.joinedCircles.map(async (cid) => {
            const docRef = doc(db, 'circles', cid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              return { id: docSnap.id, ...docSnap.data() } as Circle;
            }
            return null;
          });
          const results = await Promise.all(promises);
          const validCircles = results.filter((c): c is Circle => c !== null);
          setJoinedCirclesList(validCircles);
        } catch (err) {
          console.error('Error fetching joined circles for CommunityDrawer:', err);
        }
      };
      fetchJoinedCircles();
    } else {
      setJoinedCirclesList([]);
    }
  }, [profile?.joinedCircles]);

  // Derived filters
  let trustFilter = 6;
  let circleFilter = 'ALL';
  if (selectedFilterScope.startsWith('trust_')) {
    trustFilter = parseInt(selectedFilterScope.replace('trust_', ''), 10);
  } else if (selectedFilterScope.startsWith('circle_')) {
    circleFilter = selectedFilterScope.replace('circle_', '');
  }

  const activeFilterCount = 
    (trustFilter !== 6 ? 1 : 0) + 
    (circleFilter !== 'ALL' ? 1 : 0) +
    (typeFilter !== 'ALL' ? 1 : 0) + 
    (categoryFilter !== 'ALL' ? 1 : 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900 z-40 max-w-md mx-auto"
          />

          {/* Slide-Up Drawer Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-16 left-0 right-0 z-45 max-w-md mx-auto h-[82vh] bg-[#FDFBF9] border-t-2 border-stone-200 rounded-t-[2rem] flex flex-col overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
          >
            {/* Visual drag handle pill */}
            <div className="w-12 h-1 bg-stone-300 rounded-full mx-auto my-3 shrink-0" />

            {/* Top Bar / Switcher Header */}
            <div className="px-6 pb-3 flex items-center justify-between border-b border-stone-100 shrink-0">
              <h3 className="serif text-base font-bold text-stone-900 leading-none">
                Community Landscape
              </h3>

              {/* Toggle switch between Map and Trust Graph */}
              <div className="flex bg-[#F3F1EB] p-0.5 rounded-xl border border-stone-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                {[
                  { id: 'MAP', label: 'Map', icon: MapIcon },
                  { id: 'NETWORK', label: 'Network', icon: Users }
                ].map((opt) => {
                  const active = view === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setView(opt.id as any)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                        active 
                          ? 'bg-[#5B6B56] text-white shadow-sm font-black' 
                          : 'text-stone-500 hover:text-stone-750'
                      }`}
                    >
                      <opt.icon size={11} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Close Button */}
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-stone-50 rounded-full text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filters Row */}
            <div className="px-6 py-2 bg-[#FDFBF9] border-b border-stone-200/40 flex items-center justify-between shrink-0 relative z-20">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <select
                  value={selectedFilterScope}
                  onChange={(e) => setSelectedFilterScope(e.target.value)}
                  className="text-[9px] font-bold bg-[#F6F4EE] border border-stone-300 rounded-full px-2.5 py-1 text-stone-750 focus:outline-none focus:border-[#5B6B56] cursor-pointer shadow-sm"
                >
                  <optgroup label="Connection Levels">
                    <option value="trust_6">Whole World (All)</option>
                    {TRUST_LEVELS.filter(l => l.value < 6).map(level => (
                      <option key={level.value} value={`trust_${level.value}`}>
                        {`${level.short} (${level.label})`}
                      </option>
                    ))}
                  </optgroup>
                  {joinedCirclesList.length > 0 && (
                    <optgroup label="Your Circles">
                      {joinedCirclesList.map(circle => (
                        <option key={circle.id} value={`circle_${circle.id}`}>
                          {circle.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Filter indicator chips */}
                {trustFilter !== 6 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#5B6B56]/10 text-[#5B6B56] text-[8px] font-bold uppercase flex items-center gap-0.5 border border-[#5B6B56]/20">
                    {TRUST_LEVELS.find(l => l.value === trustFilter)?.short}
                    <button onClick={() => setSelectedFilterScope('trust_6')} className="hover:text-[#C86A51] ml-0.5 font-bold">×</button>
                  </span>
                )}
                {circleFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-[#5B6B56]/10 text-[#5B6B56] text-[8px] font-bold uppercase flex items-center gap-0.5 border border-[#5B6B56]/20">
                    {joinedCirclesList.find(c => c.id === circleFilter)?.name || 'Circle'}
                    <button onClick={() => setSelectedFilterScope('trust_6')} className="hover:text-[#C86A51] ml-0.5 font-bold">×</button>
                  </span>
                )}
              </div>

              {/* Filters Toggle Popover */}
              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border shadow-sm flex items-center gap-1 ${
                    activeFilterCount > 0
                      ? 'bg-[#5B6B56] text-white border-[#5B6B56]'
                      : 'bg-[#F6F4EE] text-stone-700 border-stone-350 hover:bg-[#EADFC9]'
                  }`}
                >
                  <Sliders size={9} className={activeFilterCount > 0 ? 'text-white' : 'text-stone-500'} />
                  <span>Filters</span>
                  <ChevronDown size={9} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>

                {showFilters && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                    <div className="absolute top-full right-0 mt-1 z-50">
                      <FilterPopover
                        selectedFilterScope={selectedFilterScope}
                        setSelectedFilterScope={setSelectedFilterScope}
                        joinedCirclesList={joinedCirclesList}
                        typeFilter={typeFilter}
                        setTypeFilter={setTypeFilter}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        onReset={() => {
                          setSelectedFilterScope('trust_6');
                          setTypeFilter('ALL');
                          setCategoryFilter('ALL');
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Display View Content */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {view === 'MAP' ? (
                  <motion.div
                    key="map"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full w-full"
                  >
                    <MapFeedView
                      location={location}
                      trustFilter={trustFilter}
                      circleFilter={circleFilter}
                      typeFilter={typeFilter}
                      categoryFilter={categoryFilter}
                      onNavigateToChat={onNavigateToChat}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="network"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full w-full"
                  >
                    <React.Suspense fallback={
                      <div className="h-full w-full flex flex-col items-center justify-center bg-stone-50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-850"></div>
                        <p className="text-stone-400 text-xs mt-3 italic">Drawing trust constellation...</p>
                      </div>
                    }>
                      <NetworkGraph trustFilter={trustFilter} onNavigateToChat={onNavigateToChat} />
                    </React.Suspense>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
