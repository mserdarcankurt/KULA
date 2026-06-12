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
// [ALPHA] Organizations shelved — import kept for future re-enabling
// import Organizations from './components/Organizations';
const Circles = React.lazy(() => import('./components/Circles'));
const PostItem = React.lazy(() => import('./components/PostItem'));
const ChatsList = React.lazy(() => import('./components/ChatsList'));
const Profile = React.lazy(() => import('./components/Profile'));
import PublicProfile from './components/PublicProfile';
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const GuardianDashboard = React.lazy(() => import('./components/GuardianDashboard'));
import Header from './components/Header';
import Navigation from './components/Navigation';
import Welcome from './components/Welcome';
import CommunityDrawer from './components/CommunityDrawer';
import GlobalTraditionsLoader from './components/GlobalTraditionsLoader';
const Onboarding = React.lazy(() => import('./components/Onboarding'));
const TourGuide = React.lazy(() => import('./components/TourGuide'));
const InviteGate = React.lazy(() => import('./components/InviteGate'));
const WaitingRoom = React.lazy(() => import('./components/WaitingRoom'));
import { db } from './lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY as string) || '';

/**
 * AppContent:
 * We separate this from the 'App' export so that it can use the 'useAuth' hook.
 * Hooks can only be used INSIDE a Provider.
 */
function AppContent() {
  // Pull data from our sensors (hooks)
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const { location } = useGeolocation(!!user);
  
  // Local state for navigation
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [showCommunityDrawer, setShowCommunityDrawer] = useState(false);

  // App-open intro animation overlay states
  const [introCompleted, setIntroCompleted] = useState(false);
  const [canContinueIntro, setCanContinueIntro] = useState(false);

  useEffect(() => {
    if (user && profile) {
      if (profile.skipIntroAnimation) {
        setIntroCompleted(true);
      } else {
        setIntroCompleted(false);
        setCanContinueIntro(false);
        const timer = setTimeout(() => {
          setCanContinueIntro(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    } else {
      setIntroCompleted(false);
      setCanContinueIntro(false);
    }
  }, [user, profile?.uid, profile?.skipIntroAnimation]);

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

  // Handle circle invite links (?circle=xxx or ?join=xxx)
  useEffect(() => {
    const circleId = searchParams.get('circle') || searchParams.get('join');
    if (circleId) {
      setSelectedCircleId(circleId);
      setActiveTab('circles');
      
      // Clean query params from address bar
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);


  // Request browser notification permissions once authenticated
  useEffect(() => {
    if (user && profile) {
      import('./lib/pushService').then(({ requestNotificationPermission }) => {
        requestNotificationPermission().then(token => {
          if (token && user.uid && !user.isAnonymous) {
            // Only update if it's not already in the array to avoid unnecessary writes, 
            // though arrayUnion handles duplicates gracefully on the backend.
            if (!profile.fcmTokens?.includes(token)) {
              updateDoc(doc(db, 'users', user.uid), {
                fcmTokens: arrayUnion(token)
              }).catch(err => console.error("Failed to save FCM token:", err));
            }
          }
        });
      });
    }
  }, [user, profile?.uid, profile?.fcmTokens]);

  /**
   * LOADING STATE:
   * If we are still checking the user's login or resolving a link, 
   * show a nice spinner in our brand colors.
   */
  if (authLoading || resolvingLink) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-brand-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
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
        <React.Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-stone-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
          <PublicProfile userId={linkInBioUid} onClose={() => {
             window.location.href = '/'; // Go back to the main app
          }} />
        </React.Suspense>
      </div>
    );
  }

  if (!user) {
    return <Welcome />;
  }

  /**
   * ONBOARDING STATE MACHINE:
   * Instead of checking multiple boolean flags, we use a single `onboardingStep` field.
   * The Onboarding component handles the full Storied Journey internally —
   * from invite code entry through philosophy slides to profile setup.
   * 
   * Legacy users with hasCompletedOnboarding === true are treated as COMPLETE.
   * Admins bypass the entire flow.
   */
  const onboardingStep = profile?.onboardingStep;
  const isOnboardingComplete = 
    onboardingStep === 'COMPLETE' || 
    profile?.hasCompletedOnboarding === true ||
    profile?.isAdmin;

  if (!isOnboardingComplete && profile) {
    return (
      <React.Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-brand-light"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div></div>}>
        <Onboarding onComplete={(action?: 'give' | 'ask' | 'explore') => {
          if (action === 'give' || action === 'ask') {
            setActiveTab('post');
          } else {
            setActiveTab('home');
          }
        }} />
      </React.Suspense>
    );
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
            onNavigateToTab={setActiveTab}
            onOpenCommunity={() => setShowCommunityDrawer(true)}
          />
        );
      // [ALPHA] organizations tab shelved — case removed
      // case 'organizations': ...
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
            onNavigateToChat={(chatId) => {
              setSelectedChatId(chatId);
              setActiveTab('chats');
            }}
          />
        );
      case 'admin':
        return <AdminPanel />;
      case 'guardian':
        return <GuardianDashboard />;
      default:
        return <Explore location={location} onOpenCommunity={() => setShowCommunityDrawer(true)} />;
    }
  };

  const showIntroOverlay = user && profile && isOnboardingComplete && !profile.skipIntroAnimation && !introCompleted;

  if (showIntroOverlay) {
    return (
      <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-[#FAF7F0] items-center justify-center p-6 relative overflow-hidden">
        <GlobalTraditionsLoader showLearnMore={true} />
        <div className={`transition-all duration-500 mt-4 ${canContinueIntro ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <button
            onClick={() => {
              setIntroCompleted(true);
              // The opening ritual plays exactly once — returning users go
              // straight into their neighborhood (no recurring 2.5s lockout).
              updateProfile({ skipIntroAnimation: true }).catch(() => {});
            }}
            className="px-6 py-3 bg-brand hover:opacity-90 text-white text-xs font-black uppercase tracking-wider rounded-2xl active:scale-[0.98] transition-all shadow-md cursor-pointer"
          >
            Your neighborhood is ready ✨
          </button>
        </div>
      </div>
    );
  }

  /**
   * MAIN LAYOUT:
   * This is the "App Shell" that stays visible on almost every page.
   * It includes the Header (Top), Main Content (Middle), and Navigation (Bottom).
   */
  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
      {/* The TourGuide is a hidden layer that can pop up to show 'How-to' tips */}
      <React.Suspense fallback={null}>
        <TourGuide />
      </React.Suspense>
      
      <Header setActiveTab={setActiveTab} setSelectedChatId={setSelectedChatId} />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative h-full w-full">
        {/* This is where the magic happens - the dynamic content swaps here */}
        <React.Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-stone-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-800"></div></div>}>
          {renderContent()}
        </React.Suspense>
      </main>
      
      {/* The Community Drawer */}
      <CommunityDrawer
        isOpen={showCommunityDrawer}
        onClose={() => setShowCommunityDrawer(false)}
        location={location}
        onNavigateToChat={(chatId) => {
          setSelectedChatId(chatId);
          setActiveTab('chats');
          setShowCommunityDrawer(false);
        }}
      />

      {/* The bottom navigation bar that lets users switch between tabs */}
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isAdmin={profile?.isAdmin} 
        showCommunityDrawer={showCommunityDrawer}
        setShowCommunityDrawer={setShowCommunityDrawer}
      />
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
      {API_KEY ? (
        <APIProvider apiKey={API_KEY} version="weekly">
          <AppContent />
        </APIProvider>
      ) : (
        <AppContent />
      )}
    </AuthProvider>
  );
}
