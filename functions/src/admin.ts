/**
 * FILE: admin.ts
 * ROLE: Admin-only aggregation endpoints for the Guardian Dashboard.
 *
 * WHY SERVER-SIDE:
 *   The dashboard used to download EVERY user, vouch, gratitude note, and
 *   comment into the browser to compute funnel/milestone stats — unbounded
 *   client memory and read costs that grow with the community. The same
 *   numbers are now computed here with field-masked queries (only the 2-3
 *   fields each aggregate needs cross the wire into the function), and the
 *   client receives a few hundred bytes of finished stats.
 *
 * SECURITY: gated on the `admin` custom claim (scripts/grant-admin.ts) —
 * the same gate firestore.rules use. Profile.isAdmin is UI-only.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDb } from "./utils";

const ONBOARDING_SEQUENCE = ['PHILOSOPHY', 'HOWTO', 'CIRCLES', 'PROFILE', 'FIRST_ACT', 'COMPLETE'];

export const getGuardianStats = onCall({ maxInstances: 5 }, async (request) => {
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Guardian access requires the admin claim.");
  }

  const db = getDb();

  const [usersSnap, vouchesSnap, gratitudeSnap, commentsSnap] = await Promise.all([
    db.collection("users").select("onboardingStep", "hasCompletedOnboarding").get(),
    db.collection("vouches").where("status", "==", "ACCEPTED").select("fromUserId", "toUserId").get(),
    db.collection("gratitude_notes").select("fromUserId", "toUserId").get(),
    db.collectionGroup("comments").select("userId").get(),
  ]);

  // Onboarding funnel: a user counts for step N if they reached N or beyond.
  const totalUsers = usersSnap.size;
  const funnelCounts: Record<string, number> = Object.fromEntries(ONBOARDING_SEQUENCE.map(s => [s, 0]));
  usersSnap.forEach(doc => {
    const step: string | undefined = doc.get("onboardingStep");
    const completed: boolean = doc.get("hasCompletedOnboarding") === true;
    const reachedIndex = completed
      ? ONBOARDING_SEQUENCE.length - 1
      : (step ? ONBOARDING_SEQUENCE.indexOf(step) : -1);
    for (let i = 0; i <= reachedIndex; i++) {
      funnelCounts[ONBOARDING_SEQUENCE[i]]++;
    }
  });
  const complete = usersSnap.docs.filter(
    d => d.get("onboardingStep") === "COMPLETE" || d.get("hasCompletedOnboarding") === true
  ).length;

  // Milestone sets: which users have connected / exchanged / commented.
  const connectedUids = new Set<string>();
  vouchesSnap.forEach(d => {
    const from = d.get("fromUserId"); const to = d.get("toUserId");
    if (from) connectedUids.add(from);
    if (to) connectedUids.add(to);
  });
  const exchangedUids = new Set<string>();
  gratitudeSnap.forEach(d => {
    const from = d.get("fromUserId"); const to = d.get("toUserId");
    if (from) exchangedUids.add(from);
    if (to) exchangedUids.add(to);
  });
  const commentedUids = new Set<string>();
  commentsSnap.forEach(d => {
    const uid = d.get("userId");
    if (uid) commentedUids.add(uid);
  });

  let connected = 0, exchanged = 0, commented = 0, any = 0;
  usersSnap.forEach(d => {
    const isConnected = connectedUids.has(d.id);
    const isExchanged = exchangedUids.has(d.id);
    const isCommented = commentedUids.has(d.id);
    if (isConnected) connected++;
    if (isExchanged) exchanged++;
    if (isCommented) commented++;
    if (isConnected || isExchanged || isCommented) any++;
  });

  return {
    totalUsers,
    onboardingFunnel: {
      signup: totalUsers,
      philosophy: funnelCounts['PHILOSOPHY'],
      howto: funnelCounts['HOWTO'],
      circles: funnelCounts['CIRCLES'],
      profile: funnelCounts['PROFILE'],
      firstAct: funnelCounts['FIRST_ACT'],
      complete,
    },
    milestones: { connected, exchanged, commented, any },
  };
});
