import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { Bell, Search } from 'lucide-react';
import SearchOverlay from './SearchOverlay';
import NotificationsOverlay from './NotificationsOverlay';
import { AnimatePresence } from 'motion/react';

interface HeaderProps {
  setActiveTab: (tab: string) => void;
}

export default function Header({ setActiveTab }: HeaderProps) {
  const { profile } = useAuth();
  const { unreadNotifications } = useUnreadCount();
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  return (
    <>
      <header className="pt-safe bg-white sticky top-0 z-50 border-b border-stone-100">
        <div className="h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 bg-[--color-brand] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">K</span>
            </div>
            <h1 className="serif text-lg font-bold tracking-tight text-[--color-brand]">KULA</h1>
          </div>
        
        <div className="flex items-center gap-4 text-stone-500">
          <button 
            id="tour-global-search"
            onClick={() => setShowSearch(true)}
            className="hover:text-[--color-brand] transition-colors p-2 hover:bg-stone-50 rounded-full"
          >
            <Search size={20} />
          </button>
          <button 
            id="tour-notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="hover:text-[--color-brand] transition-colors relative p-2 hover:bg-stone-50 rounded-full"
          >
            <Bell size={20} />
            {unreadNotifications > 0 && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          
          <button onClick={() => setActiveTab('profile')} className="transition-transform active:scale-90">
            {profile?.photoURL ? (
              <img referrerPolicy="no-referrer" 
                src={profile.photoURL} 
                alt={profile.displayName} 
                className="w-8 h-8 rounded-full border border-stone-200 object-cover bg-stone-100 shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-full border border-stone-200 bg-stone-50 flex items-center justify-center">
                <span className="text-[10px] font-bold text-stone-400 capitalize">
                  {profile?.displayName?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </header>

      <AnimatePresence>
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
        {showNotifications && <NotificationsOverlay onClose={() => setShowNotifications(false)} />}
      </AnimatePresence>
    </>
  );
}
