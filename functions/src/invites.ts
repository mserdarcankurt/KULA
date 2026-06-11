/**
 * FILE: invites.ts
 * ROLE: Server-side invite code lookup + redemption.
 *
 * WHY SERVER-SIDE:
 *   The old flow let the client read any invite doc (world-readable rules)
 *   and write its own hostId/hostStatus='APPROVED' — which also required a
 *   hardcoded 'tester' backdoor for App Store reviewers. Both are gone:
 *   - lookupInvite(code): returns a host preview without exposing the
 *     invites collection to reads.
 *   - applyInviteCode(code): atomically validates the code, marks it USED,
 *     and sets hostId/hostStatus on the caller's profile with Admin SDK
 *     privileges (firestore.rules now block client writes to those fields).
 *
 * REVIEWER / MULTI-USE CODES:
 *   An invite doc with `reusable: true` (set manually via the Firebase
 *   console or a script — clients cannot create reusable codes, see
 *   firestore.rules) can be redeemed any number of times. Create one with a
 *   long random code and put it in App Store Connect review notes.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "./utils";

function normalizeCode(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new HttpsError("invalid-argument", "Invite code required.");
  }
  const code = raw.trim().toLowerCase();
  if (code.length < 4 || code.length > 64) {
    throw new HttpsError("invalid-argument", "Invalid invite code.");
  }
  return code;
}

export const lookupInvite = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const db = getDb();
  const code = normalizeCode(request.data?.code);

  const inviteSnap = await db.collection("invites").doc(code).get();
  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "This invite code is invalid.");
  }
  const invite = inviteSnap.data()!;
  const reusable = invite.reusable === true;
  if (!reusable && invite.status !== "PENDING") {
    throw new HttpsError("failed-precondition", "This invite code has already been used or expired.");
  }

  const hostUid: string = invite.createdBy;
  const hostSnap = await db.collection("users").doc(hostUid).get();
  const host = hostSnap.exists ? hostSnap.data()! : {};

  return {
    host: {
      uid: hostUid,
      name: invite.createdByName || host.displayName || "A neighbor",
      photo: invite.createdByPhoto || host.photoURL || null,
      // Millis so the client can format the join date locally.
      joinedAtMillis: host.createdAt?.toMillis ? host.createdAt.toMillis() : null,
      helpedCount: host.trustMosaic?.completedExchanges || 0,
    },
  };
});

export const createInvite = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const uid = request.auth.uid;
  const db = getDb();
  const code = normalizeCode(request.data?.code);
  if (!/^[a-z0-9-]+$/.test(code)) {
    throw new HttpsError("invalid-argument", "Invite codes may only contain letters, numbers and dashes.");
  }
  const memoRaw = request.data?.memo;
  const memo = typeof memoRaw === "string" ? memoRaw.trim().slice(0, 200) : "";

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? userSnap.data()! : {};

  await db.runTransaction(async (tx) => {
    const inviteRef = db.collection("invites").doc(code);
    const existing = await tx.get(inviteRef);
    if (existing.exists) {
      throw new HttpsError("already-exists", "This invitation passcode already exists. Please shuffle and try a different one.");
    }
    tx.set(inviteRef, {
      code,
      createdBy: uid,
      createdByName: user.displayName || "A neighbor",
      createdByPhoto: user.photoURL || null,
      createdAt: FieldValue.serverTimestamp(),
      status: "PENDING",
      memo,
    });
  });

  return { code };
});

export const applyInviteCode = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const uid = request.auth.uid;
  const db = getDb();
  const code = normalizeCode(request.data?.code);

  return db.runTransaction(async (tx) => {
    const inviteRef = db.collection("invites").doc(code);
    const userRef = db.collection("users").doc(uid);
    const [inviteSnap, userSnap] = await Promise.all([tx.get(inviteRef), tx.get(userRef)]);

    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "This invite code is invalid.");
    }
    const invite = inviteSnap.data()!;
    const reusable = invite.reusable === true;
    if (!reusable && invite.status !== "PENDING") {
      throw new HttpsError("failed-precondition", "This invite code has already been used or expired.");
    }
    if (invite.createdBy === uid) {
      throw new HttpsError("failed-precondition", "You cannot redeem your own invite code.");
    }

    const user = userSnap.exists ? userSnap.data()! : {};

    const profileUpdate: Record<string, unknown> = {
      hostId: invite.createdBy,
      hostStatus: "APPROVED",
    };
    // First-time onboarding continues to the philosophy step; users who
    // already completed onboarding (Profile → host code) keep their state.
    if (user.hasCompletedOnboarding !== true) {
      profileUpdate.onboardingStep = "PHILOSOPHY";
    }
    tx.set(userRef, profileUpdate, { merge: true });

    if (reusable) {
      tx.update(inviteRef, {
        usedCount: FieldValue.increment(1),
        lastUsedBy: uid,
        lastUsedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(inviteRef, {
        status: "USED",
        usedBy: uid,
        usedByName: user.displayName || "Anonymous User",
        usedAt: FieldValue.serverTimestamp(),
      });
    }

    return { hostId: invite.createdBy };
  });
});
