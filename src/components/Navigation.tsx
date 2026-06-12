/**
 * FILE: Navigation.tsx
 * ROLE IN KULA: The "Bottom Tab Bar" — the app's primary navigation.
 *
 * STRUCTURE (post-IA-restructure):
 *   Home · Circles · [ + ]  · Chats · Profile     (+ Admin for admins)
 *                  center FAB
 *
 *   - Posting is the center floating action button — creation is an action,
 *     not a destination, so it no longer occupies a tab.
 *   - Chats (the retention loop) earned the tab slot, with an unread badge.
 *   - Community (map + trust graph) lives inside Home now — Explore.tsx has
 *     a Map affordance that opens the CommunityDrawer.
 *
 *   When the user taps a tab, it calls setActiveTab() which is defined in App.tsx.
 */
import React from 'react';
import { Home, Plus, User, ShieldCheck, Users, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { hapticLight } from '../lib/haptics';
import { useUnreadCount } from '../hooks/useUnreadCount';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin?: boolean;
  showCommunityDrawer: boolean;
  setShowCommunityDrawer: (show: boolean) => void;
}

export default function Navigation({
  activeTab,
  setActiveTab,
  isAdmin,
  showCommunityDrawer,
  setShowCommunityDrawer
}: NavigationProps) {
  const { unreadChats } = useUnreadCount();

  // Tab configuration; 'post' renders as the center FAB.
  const tabs: { id: string; icon: any; label: string; fab?: boolean }[] = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'circles', icon: Users, label: 'Circles' },
    { id: 'post', icon: Plus, label: 'Post', fab: true },
    { id: 'chats', icon: MessageCircle, label: 'Chats' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  // Conditionally insert the Admin tab before Profile.
  if (isAdmin) {
    tabs.splice(4, 0, { id: 'admin', icon: ShieldCheck, label: 'Admin' });
  }

  const go = (tabId: string) => {
    hapticLight();
    setActiveTab(tabId);
    setShowCommunityDrawer(false);
  };

  return (
    <nav className="pt-3 pb-[calc(10px+env(safe-area-inset-bottom))] bg-white border-t border-stone-100 flex items-center justify-around px-2 sticky bottom-0 z-55 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id && !showCommunityDrawer;

        if (tab.fab) {
          // Center floating action button — creation is an action, not a place.
          return (
            <button
              key={tab.id}
              id={`tour-${tab.id}-tab`}
              onClick={() => go(tab.id)}
              aria-label="Create a post"
              className={cn(
                "relative -mt-7 w-14 h-14 rounded-full flex items-center justify-center",
                "shadow-lg active:scale-95 transition-all border-4 border-white",
                isActive ? "bg-brand-deep text-white" : "bg-brand text-white hover:bg-brand-deep"
              )}
            >
              <Plus size={26} strokeWidth={2.5} />
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            id={`tour-${tab.id}-tab`}  // Used by TourGuide.tsx for tooltip targeting
            onClick={() => go(tab.id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 transition-all duration-200",
              isActive ? "text-brand scale-110 font-bold" : "text-stone-500 hover:text-stone-700"
            )}
          >
            <tab.icon size={isActive ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} />
            {/* Unread badge on Chats — the retention loop deserves a signal */}
            {tab.id === 'chats' && unreadChats > 0 && (
              <span className="absolute -top-1.5 right-[-10px] bg-terracotta text-white min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 border-2 border-white">
                {unreadChats}
              </span>
            )}
            <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
