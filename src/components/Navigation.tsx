/**
 * FILE: Navigation.tsx
 * ROLE IN KULA: The "Bottom Tab Bar" — the persistent navigation at the bottom of every screen.
 * 
 * CIRCUIT CONNECTION:
 *   This is the component that App.tsx renders at the bottom of the screen.
 *   When the user taps a tab, it calls setActiveTab() which is defined in App.tsx.
 *   App.tsx then switches the main content area to the corresponding component:
 *     - 'home' → Explore.tsx (map + feed + network graph)
 *     - 'circles' → Circles.tsx (community groups)
 *     - 'organizations' → Organizations.tsx (shelters, charities)
 *     - 'post' → PostItem.tsx (create new content)
 *     - 'chats' → ChatsList.tsx (conversations)
 *     - 'profile' → Profile.tsx (user settings)
 *     - 'admin' → AdminPanel.tsx (ONLY if isAdmin is true)
 * 
 * BADGE SYSTEM:
 *   The "Chats" tab shows a red badge with the number of unread chats.
 *   This number comes from useUnreadCount.ts, which runs a live Firestore
 *   listener on the `chats` collection. When someone sends you a message,
 *   the badge appears here within milliseconds.
 * 
 * ADMIN TAB:
 *   The admin tab is conditionally inserted into the tab array (splice).
 *   It only appears if the `isAdmin` prop is true, which App.tsx reads
 *   from the user's profile in Firestore. This prevents non-admins from
 *   even seeing the admin navigation option.
 * 
 * MOBILE SAFE AREA:
 *   The `pb-safe` class (from index.css) adds padding for the iPhone home
 *   indicator bar, preventing the bottom tabs from being hidden behind it.
 * 
 * TOUR INTEGRATION:
 *   Each tab button has an `id` like `tour-home-tab`, `tour-circles-tab`.
 *   TourGuide.tsx targets these IDs with Joyride tooltips during the
 *   interactive onboarding walkthrough.
 */
import React from 'react';
import { Home, PlusCircle, User, ShieldCheck, Users, Map } from 'lucide-react';
import { cn } from '../lib/utils';

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
  
  // Define the tab configuration. Each tab maps to a component in App.tsx.
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'community', icon: Map, label: 'Community' },
    { id: 'circles', icon: Users, label: 'Circles' },
    { id: 'post', icon: PlusCircle, label: 'Post' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  // Conditionally insert the Admin tab before Profile (index 4)
  if (isAdmin) {
    tabs.splice(4, 0, { id: 'admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    // We replace h-16 and pb-safe with pt-3 and calc-based safe area padding to prevent
    // tab content from being squished on iOS devices with home indicators.
    <nav className="pt-3 pb-[calc(10px+env(safe-area-inset-bottom))] bg-white border-t border-stone-100 flex items-center justify-around px-2 sticky bottom-0 z-55 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
      {tabs.map((tab) => {
        // Community is active when the drawer is open.
        // Other tabs are active when activeTab matches and the drawer is closed.
        const isActive = tab.id === 'community' 
          ? showCommunityDrawer 
          : (activeTab === tab.id && !showCommunityDrawer);

        return (
          <button
            key={tab.id}
            id={`tour-${tab.id}-tab`}  // Used by TourGuide.tsx for tooltip targeting
            onClick={() => {
              if (tab.id === 'community') {
                setShowCommunityDrawer(!showCommunityDrawer);
              } else {
                setActiveTab(tab.id);
                setShowCommunityDrawer(false);
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 transition-all duration-200",
              // Active tab gets the brand color and scales up slightly
              isActive ? "text-brand scale-110 font-bold" : "text-stone-500 hover:text-stone-700"
            )}
          >
            {/* Icon scales based on active state for visual feedback */}
            <tab.icon size={isActive ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
