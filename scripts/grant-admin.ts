/**
 * FILE: scripts/grant-admin.ts
 * ROLE: Grants (or revokes) KULA admin status for a user — the ONLY way to
 * become an admin since the client-side founder UIDs / self-promotion paths
 * were removed.
 *
 * WHAT IT DOES:
 *   1. Sets the `admin: true` custom claim on the Firebase Auth user.
 *      firestore.rules and the seed endpoint check this claim
 *      (request.auth.token.admin) — no Firestore read needed.
 *   2. Sets isAdmin: true on the users/{uid} profile doc (UI gating only),
 *      and unblocks onboarding for the account.
 *
 * USAGE (requires Admin SDK credentials):
 *   # Option A: gcloud application-default login (recommended)
 *   gcloud auth application-default login
 *   npx tsx scripts/grant-admin.ts <uid>
 *
 *   # Option B: service account key file
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npx tsx scripts/grant-admin.ts <uid>
 *
 *   # Revoke:
 *   npx tsx scripts/grant-admin.ts <uid> --revoke
 *
 * NOTE: The user must sign out and back in (or wait up to an hour for token
 * refresh) before the new claim is active in their session.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'gen-lang-client-0207804941';
const DATABASE_ID = 'kulasharingapp'; // production database

async function main() {
  const uid = process.argv[2];
  const revoke = process.argv.includes('--revoke');
  if (!uid) {
    console.error('Usage: npx tsx scripts/grant-admin.ts <uid> [--revoke]');
    process.exit(1);
  }

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore(DATABASE_ID);

  const user = await auth.getUser(uid);
  console.log(`Target: ${user.displayName || '(no name)'} <${user.email || 'no email'}> (${uid})`);

  await auth.setCustomUserClaims(uid, revoke ? { admin: null } : { admin: true });
  console.log(`Custom claim admin=${!revoke} set.`);

  await db.collection('users').doc(uid).set(
    revoke
      ? { isAdmin: false }
      : {
          isAdmin: true,
          hasCompletedOnboarding: true,
          onboardingStep: 'COMPLETE',
          hostStatus: 'APPROVED',
          updatedAt: FieldValue.serverTimestamp(),
        },
    { merge: true }
  );
  console.log(`Profile isAdmin=${!revoke} written to ${DATABASE_ID}/users/${uid}.`);
  console.log('Done. The user must sign out/in for the claim to take effect.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
