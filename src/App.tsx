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
import Header from './components/Header';
import Navigation from './components/Navigation';
import Welcome from './components/Welcome';
import Onboarding from './components/Onboarding';
import TourGuide from './components/TourGuide';
import InviteGate from './components/InviteGate';
import WaitingRoom from './components/WaitingRoom';
import { db } from './lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

function AppContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const { location } = useGeolocation();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const linkInBioParam = searchParams.get('u');
  const [linkInBioUid, setLinkInBioUid] = useState<string | null>(null);
  const [resolvingLink, setResolvingLink] = useState(!!linkInBioParam);

  useEffect(() => {
    async function resolveLink() {
      if (linkInBioParam) {
         try {
           const usersRef = collection(db, 'users');
           const q = query(usersRef, where('instagramHandle', '==', linkInBioParam.replace('@', '')));
           const snapshot = await getDocs(q);
           if (!snapshot.empty) {
             setLinkInBioUid(snapshot.docs[0].id);
           } else {
             setLinkInBioUid(linkInBioParam); // fallback to raw uid
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

  if (authLoading || resolvingLink) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[--color-brand-light]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--color-brand]"></div>
      </div>
    );
  }

  // If there is a '?u=' query parameter, show the Link In Bio view (public profile)
  // regardless of authentication
  if (linkInBioUid) {
    return (
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
        <PublicProfile userId={linkInBioUid} onClose={() => {
           window.location.href = '/'; // clear URL params to close link-in-bio view
        }} />
      </div>
    );
  }

  if (!user) {
    return <Welcome />;
  }

  // Invite Chain Gating
  if (!profile?.isAdmin) {
    if (!profile?.hostId || profile.hostStatus === 'NONE') {
      return <InviteGate />;
    }

    if (profile.hostStatus === 'PENDING') {
      return <WaitingRoom />;
    }
  }

  if (profile && profile.hasCompletedOnboarding === false) {
    return <Onboarding onComplete={() => {}} />;
  }

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
            onNavigateToChat={(chatId) => {
              setSelectedChatId(chatId);
              setActiveTab('chats');
            }} 
          />
        );
      case 'post':
        return <PostItem location={location} onSuccess={() => setActiveTab('home')} />;
      case 'chats':
        return <ChatsList selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} />;
      case 'profile':
        return (
          <Profile 
            onRestartOnboarding={() => setActiveTab('home')} 
            onSeedComplete={() => setActiveTab('home')}
          />
        );
      case 'admin':
        return <AdminPanel />;
      default:
        return <Explore location={location} />;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
      <TourGuide />
      <Header setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative h-full w-full">
        {renderContent()}
      </main>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={profile?.isAdmin} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
