/**
 * Creates a reusable App Store reviewer invite in Firestore.
 * Usage: npx tsx scripts/create-reviewer-invite.ts <code> <createdBy-uid>
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'gen-lang-client-0207804941';
const DATABASE_ID = 'kulasharingapp';

async function main() {
  const code = process.argv[2];
  const createdBy = process.argv[3];
  if (!code || !createdBy) {
    console.error('Usage: npx tsx scripts/create-reviewer-invite.ts <code> <uid>');
    process.exit(1);
  }

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore(DATABASE_ID);

  const ref = db.collection('invites').doc(code);
  const existing = await ref.get();
  if (existing.exists) {
    console.error(`Invite "${code}" already exists.`);
    process.exit(1);
  }

  await ref.set({
    code,
    createdBy,
    createdByName: 'KULA Team',
    createdByPhoto: null,
    createdAt: FieldValue.serverTimestamp(),
    status: 'PENDING',
    reusable: true,
    memo: 'App Store reviewer code',
  });

  console.log(`\nReviewer invite created!`);
  console.log(`  Code: ${code}`);
  console.log(`  Doc:  invites/${code}`);
  console.log(`\nPaste this code into your App Store Connect review notes.`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
