/**
 * FILE: useAuth.tsx
 * PURPOSE: This file acts as the "Gatekeeper" of the application.
 * It uses the React Context API to provide authentication state (user info, profile data) 
 * to every component in the app. This way, any screen can easily check: 
 * "Is anyone logged in?" or "What is the name of the current user?".
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';

/**
 * AuthContextType:
 * This defines the shape of the data we are sharing across the app.
 * Think of it as a contract: any component using 'useAuth' is guaranteed to have these fields.
 */
interface AuthContextType {
  user: User | null;         // The raw Firebase Auth user object (emails, tokens, etc.)
  profile: UserProfile | null; // Our custom KULA profile (bio, rating, circles)
  loading: boolean;          // True while we are waiting for Firebase to respond
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  isGuardian: boolean;       // A special "Admin" mode for developers to bypass login
  enableGuardianMode: () => void;
}

// Create the context container
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider:
 * This is a "Wrapper" component. We wrap our entire app inside <AuthProvider> in main.tsx.
 * It manages the actual state logic for logins.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // State variables: when these change, any component using them will re-render automatically.
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuardian, setIsGuardian] = useState(localStorage.getItem('kula-guardian-mode') === 'true');

  /**
   * enableGuardianMode():
   * This is a "Cheat Code" for developers. 
   * It creates a mock profile so we can test the app without actually logging into Google.
   */
  const enableGuardianMode = () => {
    localStorage.setItem('kula-guardian-mode', 'true');
    setIsGuardian(true);
    
    // Create a mock guardian profile with pre-filled community status
    const mockProfile: UserProfile = {
      uid: 'guardian-uid',
      displayName: 'Neighborhood Guardian',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guardian',
      bio: 'I watch over the neighborhood to ensure everyone is safe and connected.',
      rating: 5,
      reviewCount: 100,
      createdAt: serverTimestamp(),
      isAdmin: true,
      defaultReach: ['VICINITY'],
      joinedCircles: ['general'],
      hasCompletedOnboarding: true,
      hasCompletedInteractiveTour: true,
      inviteCode: 'GUARDIAN',
      hostStatus: 'APPROVED',
      hostId: 'founder'
    };
    setProfile(mockProfile);
    setLoading(false);
  };

  // Effect to handle dev-only tools
  useEffect(() => {
    // We only expose 'enableGuardianMode' to the browser window during development.
    if (import.meta.env.DEV) {
      (window as any).enableGuardianMode = enableGuardianMode;
    }
    // If the browser remembers we were in guardian mode, turn it back on.
    if (isGuardian && !profile) {
      enableGuardianMode();
    }
  }, [isGuardian]);

  /**
   * The Master Auth Listener:
   * This useEffect runs once when the app starts.
   * It asks Firebase: "Hey, is there a session saved in this browser?"
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If we are in guardian mode, we ignore the real Firebase auth.
      if (isGuardian) return; 
      
      setUser(user); // Save the raw user object (or null if logged out)

      if (user) {
        // If a user exists, we look up their custom KULA profile in Firestore.
        const profileRef = doc(db, 'users', user.uid);
        
        // 'onSnapshot' is a "Live Link". If the user profile updates in the database, 
        // this code runs again instantly, updating the UI.
        const unsubProfile = onSnapshot(profileRef, async (profileSnap) => {
          if (!profileSnap.exists()) {
            /**
             * NEW USER REGISTRATION:
             * If the user just logged in for the first time, they won't have a profile.
             * We create a fresh one here with default community settings.
             */
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous User',
              photoURL: user.photoURL,
              bio: '',
              rating: 0,
              reviewCount: 0,
              createdAt: serverTimestamp(),
              isAdmin: false,
              defaultReach: ['VICINITY'],
              joinedCircles: [],
              hasCompletedOnboarding: false,
              hasCompletedInteractiveTour: false,
              // Generate a random 6-character invite code for them to share
              inviteCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
              hostStatus: 'NONE'
            };
            // Save the new profile to Firestore
            await setDoc(profileRef, newProfile);
            setProfile(newProfile);
          } else {
            // If they already have a profile, just load it into state.
            setProfile(profileSnap.data() as UserProfile);
          }
          setLoading(false); // We are done loading!
        });

        // Clean up the live link when the component is destroyed
        return () => {
          unsubProfile();
        };
      } else {
        // If no user is logged in, clear the profile and stop loading.
        setProfile(null);
        setLoading(false);
      }
    });

    // Clean up the auth listener when the component is destroyed
    return unsubscribe;
  }, []);

  /**
   * signIn():
   * Triggers the Google Login popup.
   */
  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  /**
   * logout():
   * Clears the session from both our app state and Firebase's servers.
   */
  const logout = async () => {
    try {
      if (isGuardian) {
        // If in dev-mode, we just clear the local storage.
        localStorage.removeItem('kula-guardian-mode');
        setIsGuardian(false);
        setProfile(null);
        return;
      }
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  /**
   * We pass all our state and functions into the 'Provider'.
   * Any child component inside <AuthProvider> can now access these.
   */
  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, isGuardian, enableGuardianMode }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth():
 * This is the custom hook that components call.
 * Usage: const { profile, signIn } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
