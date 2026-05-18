/**
 * FILE: Header.tsx
 * ROLE IN KULA: The "Top Bar" — persistent header with logo, search, notifications, and avatar.
 * 
 * CIRCUIT CONNECTION:
 *   Rendered by App.tsx at the top of the main app shell (only after full authentication).
 *   This component is the COMMAND CENTER for:
 *     1. Global Search (opens SearchOverlay.tsx)
 *     2. Notifications (opens NotificationsOverlay.tsx)
 *     3. Quick profile access (clicking avatar navigates to Profile tab)
 * 
 * LIVE DATA:
 *   - `unreadNotifications` from useUnreadCount.ts: powers the red dot on the bell icon.
 *     This is a LIVE Firestore listener — when a Cloud Function creates a notification,
 *     the dot appears here within milliseconds.
 *   - `profile` from useAuth.tsx: shows the user's photo or initial in the avatar.
 * 
 * OVERLAY PATTERN:
 *   SearchOverlay and NotificationsOverlay are rendered using AnimatePresence.
 *   They slide in/out with animation. The overlays are CHILDREN of this component,
 *   positioned absolutely — they don't replace the header, they float above the content.
 * 
 * MOBILE SAFE AREA:
 *   `pt-safe` (from index.css) adds top padding for phones with notches or camera cutouts,
 *   ensuring the header content isn't hidden behind the phone's hardware UI.
 * 
 * TOUR INTEGRATION:
 *   The search button has id="tour-global-search" and the bell has id="tour-notifications".
 *   TourGuide.tsx targets these for the interactive onboarding walkthrough.
 */
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { Bell, Search } from 'lucide-react';
import SearchOverlay from './SearchOverlay';
import NotificationsOverlay from './NotificationsOverlay';
import { AnimatePresence } from 'motion/react';

interface HeaderProps {
  setActiveTab: (tab: string) => void; // Passed from App.tsx — clicking avatar sets tab to 'profile'
}

export default function Header({ setActiveTab }: HeaderProps) {
  const { profile } = useAuth();
  const { unreadNotifications } = useUnreadCount();
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  return (
    <>
      {/* The fixed header bar */}
      <header className="pt-safe bg-white sticky top-0 z-50 border-b border-stone-100">
        <div className="h-16 flex items-center justify-between px-6">
          {/* Logo — clicking it navigates to the Home tab */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 bg-[--color-brand] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">K</span>
            </div>
            <h1 className="serif text-lg font-bold tracking-tight text-[--color-brand]">KULA</h1>
          </div>
        
        {/* Right-side action buttons */}
        <div className="flex items-center gap-4 text-stone-500">
          {/* Search button — opens SearchOverlay.tsx */}
          <button 
            id="tour-global-search"
            onClick={() => setShowSearch(true)}
            className="hover:text-[--color-brand] transition-colors p-2 hover:bg-stone-50 rounded-full"
          >
            <Search size={20} />
          </button>
          {/* Notifications bell — opens NotificationsOverlay.tsx */}
          <button 
            id="tour-notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="hover:text-[--color-brand] transition-colors relative p-2 hover:bg-stone-50 rounded-full"
          >
            <Bell size={20} />
            {/* Red dot indicator — only visible when unread notifications exist */}
            {unreadNotifications > 0 && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          
          {/* User avatar — clicking navigates to the Profile tab via setActiveTab */}
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

      {/* Overlays — rendered OUTSIDE the header, animated in/out */}
      <AnimatePresence>
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
        {showNotifications && <NotificationsOverlay onClose={() => setShowNotifications(false)} />}
      </AnimatePresence>
    </>
  );
}
