/**
 * FILE: Explore.tsx
 * ROLE IN KULA: The "Home Hub" — the main tab that users spend most time on.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   This component is a VIEW SWITCHER. It doesn't display content itself —
 *   it delegates to three sub-components based on the user's toggle selection:
 *     - DISCOVERY (default) → Discovery.tsx: Card-swipe interface + map overlay
 *     - FEED → Feed.tsx: Scrollable list of items sorted by time/distance
 *     - NETWORK → NetworkGraph.tsx: Force-directed D3 visualization of the trust graph
 * 
 * DATA FLOW:
 *   App.tsx passes `location` (from useGeolocation.ts) down to this component.
 *   This component passes it further down to Discovery and Feed, which then
 *   pass it to useItems.ts for distance-based sorting and filtering.
 * 
 * `onNavigateToChat` CALLBACK:
 *   When a user swipes right on an item in Discovery, or clicks "Message" in Feed,
 *   chatService.ts creates a chat, and this callback navigates them to the Chats tab.
 *   The callback is defined in App.tsx and sets: activeTab = 'chats', selectedChatId = id.
 * 
 * ANIMATION:
 *   Uses AnimatePresence with different entry directions for each view:
 *     - DISCOVERY slides in from the left (x: -10)
 *     - FEED slides in from the right (x: 10)
 *     - NETWORK scales in (scale: 0.95 → 1)
 *   This gives a spatial sense of "switching views."
 * 
 * TOUR INTEGRATION:
 *   The toggle bar has id="tour-explore-views", targeted by TourGuide.tsx.
 */
import React, { useState } from 'react';
import Feed from './Feed';
import Discovery from './Discovery';
import NetworkGraph from './NetworkGraph';
import { List, Map as MapIcon, Compass, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Explore({ 
  location, 
  onNavigateToChat,
  onNavigateToCircle
}: { 
  location: { lat: number; lng: number } | null;
  onNavigateToChat?: (chatId: string) => void;
  onNavigateToCircle?: (circleId: string) => void;
}) {
  const [view, setView] = useState<'FEED' | 'DISCOVERY' | 'NETWORK'>('DISCOVERY');

  // --- VISIBLE UI STARTS HERE ---
  // This code renders the top bar with the 3 toggle buttons, and then shows the selected view below it.
  return (
    <div className="flex-1 flex flex-col bg-stone-50 min-h-0 h-full w-full">
      <div className="px-6 pt-4 pb-2 flex justify-between items-center bg-stone-50/80 backdrop-blur-md sticky top-0 z-10 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white">
            <Compass size={18} />
          </div>
          <h2 className="serif text-xl font-bold text-stone-900">Explore</h2>
        </div>
        
        <div id="tour-explore-views" className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 shadow-inner">
          <button 
            onClick={() => setView('DISCOVERY')}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
              view === 'DISCOVERY' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <MapIcon size={14} />
            <span className={view === 'DISCOVERY' ? 'block' : 'hidden'}>Discover</span>
          </button>
          <button 
            id="tour-explore-feed-button"
            onClick={() => setView('FEED')}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
              view === 'FEED' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <List size={14} />
            <span className={view === 'FEED' ? 'block' : 'hidden'}>Feed</span>
          </button>
          <button 
            onClick={() => setView('NETWORK')}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
              view === 'NETWORK' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <Share2 size={14} />
            <span className={view === 'NETWORK' ? 'block' : 'hidden'}>World</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {view === 'DISCOVERY' ? (
            <motion.div
              key="discovery"
              /* If the user clicked 'DISCOVERY', show the Map view */
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              <Discovery 
                location={location} 
                onNavigateToChat={onNavigateToChat} 
                onNavigateToCircle={onNavigateToCircle}
              />
            </motion.div>
          ) : view === 'FEED' ? (
            <motion.div
              key="feed"
              /* If the user clicked 'FEED', show the List view */
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              <Feed location={location} onNavigateToChat={onNavigateToChat} />
            </motion.div>
          ) : (
            <motion.div
              key="network"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              <NetworkGraph />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
