/**
 * FILE: firebase.ts
 * ROLE IN KULA: The "Wiring Closet" — connects the frontend to Google's cloud infrastructure.
 * 
 * CIRCUIT: Almost every file in the app imports from here.
 *   - useAuth.tsx imports `auth`, `db`, `googleProvider` for login.
 *   - useItems.ts imports `db` for querying items.
 *   - useTrustNetwork.ts imports `db` for building the trust graph.
 *   - chatService.ts imports `db` for creating/reading chats.
 * 
 * ENVIRONMENT DETECTION:
 *   The app runs in two modes:
 *   1. DEVELOPMENT (npm run dev): Connects to LOCAL Firebase Emulators on your machine.
 *      This means no real data is touched, and no costs are incurred.
 *   2. PRODUCTION (deployed to Firebase Hosting): Connects to the LIVE Firestore database.
 *      The `databaseId` switches based on the config in firebase-applet-config.json.
 * 
 * DOWNSTREAM EFFECTS:
 *   - If `db` fails to initialize, NOTHING in the app works — no auth, no items, no chats.
 *   - `handleFirestoreError()` is the centralized error handler. When a security rule blocks
 *     a write (see firestore.rules), this function catches it and can show a user-facing alert.
 *   - The `memoryLocalCache()` setting means Firestore uses RAM (not IndexedDB) for caching.
 *     This is faster but means data isn't persisted across browser refreshes.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, connectAuthEmulator } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { getFirestore, doc, getDocFromServer, initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize the Firebase app instance. This is the root object from which
// all Firebase services (Auth, Firestore, Functions) are derived.
const app = initializeApp(firebaseConfig);

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT DETECTION
// ═══════════════════════════════════════════════════════════════
// import.meta.env.DEV is a Vite built-in that is `true` during `npm run dev`
// and `false` in production builds.
export const isDev = import.meta.env.DEV;

export const useEmulator = isDev && (
  (typeof window !== 'undefined' && window.navigator.webdriver) ||
  (typeof window !== 'undefined' && window.location.search.includes('emulator=true')) ||
  import.meta.env.VITE_USE_EMULATOR === 'true'
);

// In development/emulator, we use the "(default)" database.
// In production, we use the named database from the config file.
const databaseId = useEmulator ? '(default)' : firebaseConfig.firestoreDatabaseId;

console.log(`[KULA SYSTEM] Running in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode.`);
console.log(`[KULA SYSTEM] Targeting Database: ${databaseId}`);

// ═══════════════════════════════════════════════════════════════
// FIRESTORE INITIALIZATION
// ═══════════════════════════════════════════════════════════════
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: memoryLocalCache(),
}, databaseId);

// ═══════════════════════════════════════════════════════════════
// AUTH INITIALIZATION
// ═══════════════════════════════════════════════════════════════
// On native (Capacitor iOS/Android), getAuth() hangs because it tries to probe
// IndexedDB for session persistence, and IndexedDB behaves erratically under
// the `capacitor://localhost` origin. Using initializeAuth with explicit
// browserLocalPersistence (which uses localStorage) bypasses this entirely.
// On web (real browsers), getAuth() works perfectly.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: browserLocalPersistence })
  : getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ═══════════════════════════════════════════════════════════════
// FUNCTIONS INITIALIZATION
// ═══════════════════════════════════════════════════════════════
export const functions = getFunctions(app);
export const storage = getStorage(app);

// ═══════════════════════════════════════════════════════════════
// MESSAGING INITIALIZATION
// ═══════════════════════════════════════════════════════════════
export const messaging = typeof window !== 'undefined' && 'Notification' in window ? getMessaging(app) : null;

if (useEmulator) {
  console.log("[KULA SYSTEM] Connecting to local Firebase Emulators...");
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION TEST
// ═══════════════════════════════════════════════════════════════
// Called by main.tsx at boot time. Attempts to read a dummy document
// to verify that the Firestore connection is alive.
// If it fails with "offline" or "unavailable", we know the backend is down
// BEFORE the user ever tries to interact with the app.
export async function testConnection() {
  try {
    console.log("[KULA SYSTEM] Testing Firestore connection...");
    // Race the Firestore read against a 15-second timeout.
    // In Capacitor WebView, Firestore can sometimes hang on first connection.
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection test timed out after 15s')), 15000)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise
    ]);
    console.log("[KULA SYSTEM] Firestore connection successful!");
  } catch (error) {
    console.warn("[KULA SYSTEM] Firestore connection test result:", error);
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
        console.error("[KULA SYSTEM] CRITICAL: Firestore unreachable. Please check your network or Firebase configuration.");
      } else if (error.message.includes('timed out')) {
        console.warn("[KULA SYSTEM] Firestore connection test timed out — app may still work, auth will proceed independently.");
      }
    }
  }
}

// Re-export Firebase Auth utilities so other files can import them from here
// instead of directly from 'firebase/auth'. This centralizes all Firebase imports.
export { signInWithPopup, signOut, onAuthStateChanged };
export type { User };

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

/**
 * OperationType: Labels for what kind of Firestore operation failed.
 * Used in error logging so we can quickly identify WHERE in the flow a failure occurred.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * FirestoreErrorInfo: A structured error object for debugging.
 * Captures not just the error message, but WHO was trying to do WHAT.
 * This is critical for debugging security rule failures — you can see
 * the userId, email, and the exact path they tried to access.
 */
interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

/**
 * handleFirestoreError():
 * The centralized error handler for ALL Firestore operations.
 * 
 * Called by: useItems.ts, useUnreadCount.ts, and any other file that does
 * Firestore queries with error callbacks.
 * 
 * SPECIAL BEHAVIOR: If the error is "Missing or insufficient permissions",
 * it means our firestore.rules blocked the operation. We show an alert
 * so the user knows their action was denied (e.g., trying to read a
 * profile hidden by visibilityPreference).
 * 
 * CONNECTION TO SECURITY (firestore.rules):
 *   When firestore.rules denies a read/write, Firestore throws an error.
 *   That error arrives here, gets enriched with auth context, and is logged.
 *   This is the "other side" of the security system — rules BLOCK, this function REPORTS.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In dev, also alert for visibility since blocking actions are high-intent
  if (errInfo.error.includes('Missing or insufficient permissions')) {
    alert("Interaction blocked by privacy settings.");
  }
  
  throw new Error(JSON.stringify(errInfo));
}
