/**
 * FILE: TourGuide.tsx
 * ROLE IN KULA: The "Interactive Tutorial" — tooltip-based walkthrough of the real UI.
 * 
 * CIRCUIT A (Sacred Space Gatekeeper):
 *   This is Step 5 — the FINAL onboarding step. It runs AFTER:
 *     1. Login (Welcome.tsx)
 *     2. Invite code (InviteGate.tsx)
 *     3. Host approval (WaitingRoom.tsx)
 *     4. Static tutorial (Onboarding.tsx)
 *   
 *   TourGuide overlays tooltips on the REAL app interface, pointing to
 *   actual buttons and tabs. It only runs once — after completion,
 *   it sets hasCompletedInteractiveTour = true in the user's profile.
 * 
 * HOW IT TARGETS UI ELEMENTS:
 *   Each step has a CSS selector `target` (e.g., '#tour-global-search').
 *   These IDs are placed on real UI elements:
 *     - Header.tsx: #tour-global-search, #tour-notifications
 *     - Explore.tsx: #tour-explore-views
 *     - Navigation.tsx: #tour-home-tab, #tour-circles-tab, #tour-post-tab, etc.
 *   Joyride highlights each target and shows an explanatory tooltip.
 * 
 * TIMING:
 *   A 1-second delay (setTimeout) before starting ensures the real UI has
 *   fully rendered and the DOM elements exist before Joyride tries to find them.
 * 
 * LIBRARY: react-joyride (Joyride component)
 *   Styled to match the Berlin Analog aesthetic: stone backgrounds, rounded corners,
 *   uppercase tracking, and the warm #c1a077 accent color for the primary button.
 */
import React, { useEffect, useState } from 'react';
import { Joyride, Step, EventData, STATUS } from 'react-joyride';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DISCOVERY_DEFAULTS } from '../lib/constants';

export default function TourGuide() {
  const { user, profile } = useAuth();
  const [run, setRun] = useState(false);

  useEffect(() => {
    const isReadyForTour = profile?.hasCompletedOnboarding || profile?.isAdmin;
    if (isReadyForTour && !profile?.hasCompletedInteractiveTour) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const handleJoyrideCallback = async (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (user) {
        try {
          const profileRef = doc(db, 'users', user.uid);
          await updateDoc(profileRef, {
            hasCompletedInteractiveTour: true
          });
        } catch (e) {
          console.error('Error updating tour status:', e);
        }
      }
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to KULA! Let us show you around quickly so you can get the most out of sharing with your neighbors.',
      placement: 'center',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-global-search',
      content: 'Click here to access the universal search anytime! You can also set up powerful Radar alerts here to get notified when neighbors share what you need.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-notifications',
      content: 'All your matches, messages, and join requests will pop up in your notifications panel.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-explore-views',
      content: 'Use this toggle to switch between Discovery mode (card swiping to see what\'s around) and the Feed view (a browsable chronological list of posts).',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-discovery-filter',
      content: `In Discovery mode, use this filter button to narrow down exactly what you want to see around you! By default, it shows ${DISCOVERY_DEFAULTS.typeFilter === 'ALL' ? 'everything' : String(DISCOVERY_DEFAULTS.typeFilter).toLowerCase() + 's'} within ${DISCOVERY_DEFAULTS.radius}km.`,
      skipBeacon: true,
      skipScroll: true,
      placement: 'bottom',
    },
    {
      target: '#tour-post-tab',
      content: 'Tap here to Create! You can Ask for things, Share items, organize an İmece (community work) or create a Join (gathering).',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-home-tab',
      content: 'Your Home tab brings you back to the main map and feed anytime.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-circles-tab',
      content: 'Here you can explore local sub-communities, building trusted groups to share exclusively with.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-organizations-tab',
      content: 'Connect with verified organizations and participate in their community missions here.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-chats-tab',
      content: 'Coordinate pickups and community missions in real-time chats with your neighbors.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-profile-tab',
      content: 'Manage your settings, configure your reach radius, and view your impact here. Let\'s get started!',
      skipBeacon: true,
      skipScroll: true,
    }
  ];

  // [ALPHA] Tours disabled for closed alpha — UI is cleaner without guided overlays.
  // TODO: Update steps post-launch to reflect the new Feed-first UX.
  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      locale={{ last: 'Done' }}
      options={{
        showProgress: false,
        buttons: ['back', 'skip', 'primary'],
        arrowColor: '#f5f5f4', // stone-100
        backgroundColor: '#f5f5f4',
        overlayColor: 'rgba(28, 25, 23, 0.7)', // stone-900 / 0.7
        primaryColor: '#c1a077',
        textColor: '#292524', // stone-800
        zIndex: 1000,
      }}
      onEvent={handleJoyrideCallback}
      styles={{
        floater: {
          textAlign: 'left',
          borderRadius: '1rem',
          padding: '1rem',
        },
        buttonPrimary: {
          backgroundColor: '#292524',
          borderRadius: '1rem',
          fontFamily: 'sans-serif',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: '10px',
          padding: '12px 20px',
          color: '#ffffff',
        },
        buttonBack: {
          marginRight: 10,
          color: '#78716c',
          fontSize: '12px',
          fontWeight: 600,
        },
        buttonSkip: {
          color: '#78716c',
          fontSize: '12px',
          fontWeight: 600,
        }
      }}
    />
  );
}
