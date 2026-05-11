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
  const { unreadChats } = useUnreadCount();
  
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'circles', icon: Users, label: 'Circles' },
    { id: 'organizations', icon: Shield, label: 'Orgs' },
    { id: 'post', icon: PlusCircle, label: 'Post' },
    { id: 'chats', icon: MessageSquare, label: 'Chats', badge: unreadChats > 0 ? unreadChats : 0 },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  if (isAdmin) {
    tabs.splice(4, 0, { id: 'admin', icon: ShieldCheck, label: 'Admin' });
  }

  return (
    <nav className="h-16 pb-safe bg-white border-t border-stone-100 flex items-center justify-around px-2 sticky bottom-0 z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`tour-${tab.id}-tab`}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1 transition-all duration-200",
            activeTab === tab.id ? "text-[--color-brand] scale-110" : "text-stone-500 hover:text-stone-700"
          )}
        >
          <tab.icon size={activeTab === tab.id ? 24 : 20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
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
