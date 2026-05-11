import React, { useState } from 'react';
import Feed from './Feed';
import Discovery from './Discovery';
import { List, Map as MapIcon, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Explore({ 
  location, 
  onNavigateToChat 
}: { 
  location: { lat: number; lng: number } | null;
  onNavigateToChat?: (chatId: string) => void;
}) {
  const [view, setView] = useState<'FEED' | 'DISCOVERY'>('DISCOVERY');

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
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {view === 'DISCOVERY' ? (
            <motion.div
              key="discovery"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              <Discovery location={location} onNavigateToChat={onNavigateToChat} />
            </motion.div>
          ) : (
            <motion.div
              key="feed"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex-1 flex flex-col min-h-0 h-full w-full"
            >
              <Feed location={location} onNavigateToChat={onNavigateToChat} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
