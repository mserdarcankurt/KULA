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
import { Home, Compass, PlusCircle, MessageSquare, User, ShieldCheck, Users, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { useUnreadCount } from '../hooks/useUnreadCount';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin?: boolean;
}

export default function Navigation({ activeTab, setActiveTab, isAdmin }: NavigationProps) {
  // Read the unread chat count from the live Firestore listener
  // This updates in real-time when messages arrive
  const { unreadChats } = useUnreadCount();
  
  // Define the tab configuration. Each tab maps to a component in App.tsx.
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'circles', icon: Users, label: 'Circles' },
    { id: 'organizations', icon: Shield, label: 'Orgs' },
    { id: 'post', icon: PlusCircle, label: 'Post' },
    { id: 'chats', icon: MessageSquare, label: 'Chats', badge: unreadChats > 0 ? unreadChats : 0 },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  // Conditionally insert the Admin tab before Chats (index 4)
  // splice(4, 0, ...) means "at position 4, remove 0 items, insert this"
  if (isAdmin) {
    tabs.splice(4, 0, { id: 'admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    // sticky bottom-0 z-50 keeps this bar fixed at the bottom above all content
    <nav className="h-16 pb-safe bg-white border-t border-stone-100 flex items-center justify-around px-2 sticky bottom-0 z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tour-${tab.id}-tab`}  // Used by TourGuide.tsx for tooltip targeting
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 transition-all duration-200",
            // Active tab gets the brand color and scales up slightly
            activeTab === tab.id ? "text-[--color-brand] scale-110" : "text-stone-500 hover:text-stone-700"
          )}
        >
          {/* Icon scales based on active state for visual feedback */}
          <tab.icon size={activeTab === tab.id ? 24 : 20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
          {/* Red unread badge — only shown on the Chats tab when count > 0 */}
          {tab.badge ? (
            <span className="absolute top-[-4px] right-[2px] bg-red-500 text-white min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 border-2 border-white">
              {tab.badge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}
