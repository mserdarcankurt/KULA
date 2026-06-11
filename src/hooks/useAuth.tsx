/**
 * FILE: useAuth.tsx
 * PURPOSE: This file acts as the "Gatekeeper" of the application.
 * It uses the React Context API to provide authentication state (user info, profile data) 
 * to every component in the app. This way, any screen can easily check: 
 * "Is anyone logged in?" or "What is the name of the current user?".
 */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '../lib/firebase';
import { signInWithCredential, GoogleAuthProvider, signInAnonymously, OAuthProvider } from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { isNative } from '../lib/platform';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { logEvent } from '../lib/analytics';

/**
 * ADMIN STATUS:
 * Admin is granted via Firebase custom claims (scripts/grant-admin.ts), which
 * also sets isAdmin: true on the user's profile document for UI gating.
 * firestore.rules check request.auth.token.admin — the client never decides
 * who is an admin, and no admin UIDs ship in this bundle.
 */

/**
 * AuthContextType:
 * This defines the shape of the data we are sharing across the app.
 * Think of it as a contract: any component using 'useAuth' is guaranteed to have these fields.
 */
interface AuthContextType {
  user: User | null;         // The raw Firebase Auth user object (emails, tokens, etc.)
  profile: UserProfile | null; // Our custom KULA profile (bio, rating, circles)
  loading: boolean;          // True while we are waiting for Firebase to respond
  signIn: (provider?: 'google' | 'apple') => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
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

  // Re-entry guard: prevents signIn() from being called while it's already in progress.
  // This is critical on native iOS where the Google Sign-In sheet dismiss can
  // inadvertently re-trigger the sign-in flow.
  const signInInProgress = useRef(false);



  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), updates);
    }
  };

  // Expose test login helper to window during local development strictly for headless automated E2E testing.
  // This is completely tree-shaken and stripped from production builds.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__runTestLogin = async () => {
        setLoading(true);
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Test login helper failed:", err);
          setLoading(false);
          throw err;
        }
      };
    }
  }, []);

  /**
   * Redirect Result Handler:
   * Handle redirect result (Only relevant for web if using redirect, but we use popup now)
   */
  useEffect(() => {
    // getRedirectResult is no longer used since native uses the native plugin
    // and web uses popup. Kept here empty just in case.
  }, []);

  /**
    * The Master Auth Listener:
    * This useEffect runs once when the app starts.
    * It asks Firebase: "Hey, is there a session saved in this browser?"
    *
    * SAFETY TIMEOUT:
    * On native iOS (Capacitor WebView), Firebase Auth can sometimes take longer
    * to initialize because of the capacitor://localhost origin. We add a safety
    * timeout that stops the loading spinner after 10 seconds if onAuthStateChanged
    * never fires — this prevents the app from being stuck on a forever-spinner.
    */
   useEffect(() => {
    console.log('[KULA AUTH] Setting up onAuthStateChanged listener...');
    let authFired = false;

    // Safety timeout: if Firebase Auth doesn't respond within 10 seconds,
    // assume no user is logged in and show the Welcome screen.
    const safetyTimeout = setTimeout(() => {
      if (!authFired) {
        console.warn('[KULA AUTH] Safety timeout reached (10s) — Firebase Auth did not respond. Showing Welcome screen.');
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authFired = true;
      clearTimeout(safetyTimeout);
      console.log('[KULA AUTH] onAuthStateChanged fired. User:', user ? user.uid : 'null (not logged in)');

      // If we are in guardian or test user mode, we ignore the real Firebase auth.

      
      setUser(user); // Save the raw user object (or null if logged out)

      if (user) {
        console.log('[KULA AUTH] User found, loading profile from Firestore...');
        // If a user exists, we look up their custom KULA profile in Firestore.
        const profileRef = doc(db, 'users', user.uid);
        const privateRef = doc(db, 'users_private', user.uid);

        let publicData: UserProfile | null = null;
        let privateData: any = null;

        const mergeAndSetProfile = () => {
          if (publicData) {
            setProfile({
              ...publicData,
              exactHomeLocation: privateData?.exactHomeLocation || null,
              savedLocations: privateData?.savedLocations || []
            });
            console.log('[KULA AUTH] Profile loaded successfully. Loading complete.');
            setLoading(false);
          }
        };

        const unsubProfile = onSnapshot(profileRef, async (profileSnap) => {
          if (!profileSnap.exists()) {
            /**
              * NEW USER REGISTRATION:
              * If the user just logged in for the first time, they won't have a profile.
              * We create a fresh one here with default community settings.
              */
            console.log('[KULA AUTH] New user detected — creating profile...');
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
              onboardingStep: null,
              hasCompletedInteractiveTour: false,
              hostStatus: 'NONE'
            };
            const newPrivate = {
              exactHomeLocation: null,
              savedLocations: []
            };
            // Save the new profile and private document to Firestore
            await setDoc(profileRef, newProfile);
            await setDoc(privateRef, newPrivate);
            publicData = newProfile;
            privateData = newPrivate;
            mergeAndSetProfile();
          } else {
            // If they already have a profile, just load it into state.
            // (Admin status lives in custom claims + the isAdmin field, both
            // set server-side via scripts/grant-admin.ts — the client never
            // writes privilege fields, and firestore.rules would deny it.)
            publicData = profileSnap.data() as UserProfile;
            mergeAndSetProfile();
          }
        });

        const unsubPrivate = onSnapshot(privateRef, (privateSnap) => {
          if (privateSnap.exists()) {
            privateData = privateSnap.data();
          } else {
            privateData = { exactHomeLocation: null, savedLocations: [] };
          }
          mergeAndSetProfile();
        });

        // Clean up the live links when the component is destroyed
        return () => {
          unsubProfile();
          unsubPrivate();
        };
      } else {
        // If no user is logged in, clear the profile and stop loading.
        console.log('[KULA AUTH] No user logged in. Showing Welcome screen.');
        setProfile(null);
        setLoading(false);
      }
    });

    // Clean up the auth listener and safety timeout when the component is destroyed
    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  /**
   * signIn():
   * Triggers Google Login.
   *
   * NATIVE vs. WEB:
   *   - On NATIVE (iOS/Android): Uses `@capacitor-firebase/authentication` to trigger
   *     the native iOS Google Sign-In dialog. With `skipNativeAuth: true` in Capacitor config,
   *     the plugin only returns the credential (idToken) without signing in natively.
   *     We then call `signInWithCredential` ourselves so the JS SDK's `onAuthStateChanged` fires.
   *   - On WEB (browser): Uses `signInWithPopup` which opens a small Google
   *     login window that overlays the current page.
   *
   * RE-ENTRY GUARD: Uses a ref to prevent the function from being called again
   * while a sign-in is already in progress (prevents the iOS dismiss-and-retrigger loop).
   */
  const signIn = async (provider: 'google' | 'apple' = 'google') => {
    // Prevent re-entry: if signIn is already running, bail out.
    if (signInInProgress.current) {
      console.warn('[KULA AUTH] signIn() called while already in progress — ignoring.');
      return;
    }
    signInInProgress.current = true;
    logEvent('login_started', { provider });

    try {
      if (isNative()) {
        if (provider === 'apple') {
          console.log('[KULA AUTH] Triggering Native Apple Sign-In...');
          const result = await FirebaseAuthentication.signInWithApple();
          if (result.credential?.idToken) {
            console.log('[KULA AUTH] Got Native Apple ID token, signing into Firebase JS SDK...');
            const appleProvider = new OAuthProvider('apple.com');
            const credential = appleProvider.credential({
              idToken: result.credential.idToken,
              rawNonce: result.credential.nonce,
            });
            const userCredential = await signInWithCredential(auth, credential);
            console.log('[KULA AUTH] Firebase JS SDK Apple sign-in successful! UID:', userCredential.user.uid);
            logEvent('login_completed', { provider: 'apple', platform: 'native' });
            try {
              await Haptics.impact({ style: ImpactStyle.Light });
            } catch (_) {}
          } else {
            console.warn('[KULA AUTH] Native Apple Sign-In cancelled or no token received.');
          }
        } else {
          console.log('[KULA AUTH] Triggering Native Google Sign-In...');
          const result = await FirebaseAuthentication.signInWithGoogle();
          if (result.credential?.idToken) {
            console.log('[KULA AUTH] Got Native Google ID token, signing into Firebase JS SDK...');
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            const userCredential = await signInWithCredential(auth, credential);
            console.log('[KULA AUTH] Firebase JS SDK Google sign-in successful! UID:', userCredential.user.uid);
            logEvent('login_completed', { provider: 'google', platform: 'native' });
            try {
              await Haptics.impact({ style: ImpactStyle.Light });
            } catch (_) {}
          } else {
            console.warn('[KULA AUTH] Native Google Sign-In cancelled or no token received.');
          }
        }
      } else {
        if (provider === 'apple') {
          console.log('[KULA AUTH] Triggering Web Apple Sign-In Popup...');
          const appleProvider = new OAuthProvider('apple.com');
          await signInWithPopup(auth, appleProvider);
          logEvent('login_completed', { provider: 'apple', platform: 'web' });
        } else {
          console.log('[KULA AUTH] Triggering Web Google Sign-In Popup...');
          await signInWithPopup(auth, googleProvider);
          logEvent('login_completed', { provider: 'google', platform: 'web' });
        }
      }
    } catch (error: any) {
      console.error(`[KULA AUTH] Sign in error (${provider}):`, error);
      const errMsg = error?.message || String(error);
      const isCancellation = errMsg.toLowerCase().includes('cancel') || errMsg.toLowerCase().includes('canceled') || errMsg.toLowerCase().includes('cancelled');
      if (!isCancellation) {
        alert(
          `Sign-in failed (${provider}): ${errMsg}\n\n` +
          `Note: On iOS Simulator, native Apple Sign-In requires an iCloud sandbox account in device settings.`
        );
      }
    } finally {
      signInInProgress.current = false;
    }
  };

  /**
   * logout():
   * Clears the session from both our app state and Firebase's servers.
   */
  const logout = async () => {
    try {
      logEvent('logout');
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
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout, updateProfile }}>
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
