/**
 * FILE: App.tsx
 * PURPOSE: This is the "Heart" of the application. 
 * It manages global state (like which tab is open) and decides 
 * which screen the user should see based on their profile.
 * 
 * Think of it as a switcher: 
 * If NOT logged in -> Show Welcome.
 * If logged in but NO invite -> Show Invite Gate.
 * If all good -> Show the main app shell with Navigation.
 */
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useGeolocation } from './hooks/useGeolocation';
import Explore from './components/Explore';
import Organizations from './components/Organizations';
import Circles from './components/Circles';
import PostItem from './components/PostItem';
import ChatsList from './components/ChatsList';
import Profile from './components/Profile';
import PublicProfile from './components/PublicProfile';
import AdminPanel from './components/AdminPanel';
import GuardianDashboard from './components/GuardianDashboard';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Welcome from './components/Welcome';
import Onboarding from './components/Onboarding';
import TourGuide from './components/TourGuide';
import InviteGate from './components/InviteGate';
import WaitingRoom from './components/WaitingRoom';
import { db } from './lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * AppContent:
 * We separate this from the 'App' export so that it can use the 'useAuth' hook.
 * Hooks can only be used INSIDE a Provider.
 */
function AppContent() {
  // Pull data from our sensors (hooks)
  const { user, profile, loading: authLoading, isGuardian } = useAuth();
  const { location } = useGeolocation();
  
  // Local state for navigation
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  const handleNavigateToCircle = (circleId: string) => {
    setSelectedCircleId(circleId);
    setActiveTab('circles');
  };

  /**
   * LINK-IN-BIO LOGIC:
   * KULA profiles can be shared on Instagram/socials.
   * If the URL has '?u=@handle', we try to find that user and show their profile.
   */
  const searchParams = new URLSearchParams(window.location.search);
  const linkInBioParam = searchParams.get('u');
  const [linkInBioUid, setLinkInBioUid] = useState<string | null>(null);
  const [resolvingLink, setResolvingLink] = useState(!!linkInBioParam);

  useEffect(() => {
    async function resolveLink() {
      if (linkInBioParam) {
         try {
           const usersRef = collection(db, 'users');
           // Query users where their Instagram handle matches the URL parameter
           const q = query(usersRef, where('instagramHandle', '==', linkInBioParam.replace('@', '')));
           const snapshot = await getDocs(q);
           if (!snapshot.empty) {
             setLinkInBioUid(snapshot.docs[0].id);
           } else {
             setLinkInBioUid(linkInBioParam); // fallback to raw uid if no handle match
           }
         } catch (e) {
           console.error("Error resolving user link:", e);
           setLinkInBioUid(linkInBioParam);
         }
      }
      setResolvingLink(false);
    }
    resolveLink();
  }, [linkInBioParam]);

  /**
   * LOADING STATE:
   * If we are still checking the user's login or resolving a link, 
   * show a nice spinner in our brand colors.
   */
  if (authLoading || resolvingLink) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[--color-brand-light]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--color-brand]"></div>
      </div>
    );
  }

  /**
   * PUBLIC VIEW:
   * If someone is just looking at a profile from a link, 
   * show the PublicProfile view immediately.
   */
  if (linkInBioUid) {
    return (
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
        <PublicProfile userId={linkInBioUid} onClose={() => {
           window.location.href = '/'; // Go back to the main app
        }} />
      </div>
    );
  }

  // GATE 1: If not logged in (and not in dev guardian mode), show the Welcome/Login screen.
  if (!user && !isGuardian) {
    return <Welcome />;
  }

  /**
   * GATE 2: INVITE CHAIN GATING
   * KULA is a trust-based community. You need an invite to enter.
   * Admins bypass this.
   */
  if (!profile?.isAdmin) {
    // If you don't have a 'host' (inviter), go to the Invite Gate.
    if (!profile?.hostId || profile.hostStatus === 'NONE') {
      return <InviteGate />;
    }

    // If your invite is still being reviewed by your host, stay in the Waiting Room.
    if (profile.hostStatus === 'PENDING') {
      return <WaitingRoom />;
    }
  }

  // GATE 3: ONBOARDING
  // If you are brand new, we force you to complete the onboarding flow (bio, photo, etc).
  if (profile && profile.hasCompletedOnboarding === false) {
    return <Onboarding onComplete={() => {}} />;
  }

  /**
   * renderContent():
   * This function decides which "Component" to show in the middle of the screen
   * based on the 'activeTab' state.
   */
  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Explore 
            location={location} 
            onNavigateToChat={(chatId) => {
              setSelectedChatId(chatId);
              setActiveTab('chats');
            }} 
            onNavigateToCircle={handleNavigateToCircle}
          />
        );
      case 'organizations':
        return (
          <Organizations 
            location={location} 
            onNavigateToChat={(chatId) => {
              setSelectedChatId(chatId);
              setActiveTab('chats');
            }} 
          />
        );
      case 'circles':
        return (
          <Circles 
            selectedCircleId={selectedCircleId}
            onClearSelection={() => setSelectedCircleId(null)}
            onNavigateToChat={(chatId) => {
              setSelectedChatId(chatId);
              setActiveTab('chats');
            }} 
          />
        );
      case 'post':
        // When a post is successful, we automatically take them back to 'home' to see it.
        return <PostItem location={location} onSuccess={() => setActiveTab('home')} />;
      case 'chats':
        return <ChatsList selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} />;
      case 'profile':
        return (
          <Profile 
            onRestartOnboarding={() => setActiveTab('home')} 
            onSeedComplete={() => setActiveTab('home')}
            onNavigateToGuardian={() => setActiveTab('guardian')}
          />
        );
      case 'admin':
        return <AdminPanel />;
      case 'guardian':
        return <GuardianDashboard />;
      default:
        return <Explore location={location} />;
    }
  };

  /**
   * MAIN LAYOUT:
   * This is the "App Shell" that stays visible on almost every page.
   * It includes the Header (Top), Main Content (Middle), and Navigation (Bottom).
   */
  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
      {/* The TourGuide is a hidden layer that can pop up to show 'How-to' tips */}
      <TourGuide />
      
      <Header setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative h-full w-full">
        {/* This is where the magic happens - the dynamic content swaps here */}
        {renderContent()}
      </main>
      
      {/* The bottom navigation bar that lets users switch between tabs */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={profile?.isAdmin} />
    </div>
  );
}

/**
 * ENTRY POINT:
 * Every React app has one main component. For KULA, it's this one.
 * We wrap the content in <AuthProvider> so that the entire app knows about the user.
 */
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
