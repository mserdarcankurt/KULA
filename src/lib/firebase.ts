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
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
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

// In development, we use the "(default)" database (the emulator).
// In production, we use a named database from the config file.
const databaseId = isDev ? '(default)' : firebaseConfig.firestoreDatabaseId;

console.log(`[KULA SYSTEM] Running in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode.`);
console.log(`[KULA SYSTEM] Targeting Database: ${databaseId}`);

// ═══════════════════════════════════════════════════════════════
// FIRESTORE INITIALIZATION
// ═══════════════════════════════════════════════════════════════
// `ignoreUndefinedProperties`: If a UserProfile has `instagramHandle: undefined`,
//   Firestore would normally throw an error. This flag lets it silently skip those fields.
//   This is important because TypeScript optional fields (`?`) default to undefined.
//
// `memoryLocalCache()`: Uses in-memory caching instead of IndexedDB.
//   Faster startup, but data disappears on refresh. For a real-time app like KULA
//   where we use `onSnapshot` everywhere, this is acceptable because data is always fresh.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: memoryLocalCache()
}, databaseId);

// ═══════════════════════════════════════════════════════════════
// AUTH INITIALIZATION
// ═══════════════════════════════════════════════════════════════
// `auth` is the Firebase Auth instance. useAuth.tsx uses this to:
//   1. Listen for login state changes (onAuthStateChanged)
//   2. Trigger Google login (signInWithPopup)
//   3. Log out (signOut)
//
// `googleProvider` configures the Google OAuth popup.
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ═══════════════════════════════════════════════════════════════
// EMULATOR CONNECTION (DEV ONLY)
// ═══════════════════════════════════════════════════════════════
// When running locally, we redirect all Firebase calls to the emulators
// instead of hitting the real cloud. This means:
//   - Auth calls go to localhost:9099 (no real Google accounts needed)
//   - Firestore calls go to localhost:8080 (data lives in memory, resets on restart)
//
// IMPORTANT: If you see "Firestore unreachable" errors in dev, make sure
// you've started the emulators with: `firebase emulators:start`
if (isDev) {
  console.log("[KULA SYSTEM] Connecting to local Firebase Emulators...");
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
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
    console.log("Testing Firestore connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful!");
  } catch (error) {
    console.warn("Firestore connection test failed (expected if 'test/connection' doc doesn't exist, but checking for connectivity errors):", error);
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
        console.error("CRITICAL: Firestore unreachable. Please check your network or Firebase configuration.");
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
