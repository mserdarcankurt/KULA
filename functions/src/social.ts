/**
 * FILE: social.ts
 * ROLE: Server-side maintenance of derived social state that clients used to
 * write directly — and that firestore.rules now (correctly) deny them.
 *
 * 1. Circle member counts:
 *    Clients used to read-modify-write circles.memberCount on join/leave,
 *    which (a) raced under concurrency and (b) required a rules exception
 *    that let ANYONE corrupt the count. The member docs are the source of
 *    truth: on every membership change we RECOMPUTE the count with an
 *    aggregate query instead of blind +1/-1 — naturally idempotent under
 *    Cloud Functions' at-least-once event delivery, and self-healing.
 *    When the last member leaves, the circle is hidden (privacy: 'HIDDEN'),
 *    matching the old client-side leave logic in Circles.tsx.
 *
 * 2. Trust mosaic counters:
 *    GratitudeFlow used to increment trustMosaic.* on BOTH user docs from
 *    the client — forgeable reputation. Now:
 *    - itemType is derived from the referenced ITEM DOC, never trusted from
 *      the client payload.
 *    - The exchange must be verifiable: the item must exist and one of the
 *      two parties must be its owner.
 *    - Each (item, giver, recipient) tuple counts exactly ONCE, enforced by
 *      a transaction marker in gratitude_counted/ — which also makes the
 *      trigger idempotent under event redelivery.
 *    Notes that fail validation still exist as messages; they just don't
 *    move reputation counters.
 */
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, getDatabaseId } from "./utils";

const databaseId = getDatabaseId();

/** Recompute memberCount from the members subcollection (idempotent). */
async function syncCircleMemberCount(circleId: string): Promise<void> {
  const db = getDb();
  const circleRef = db.collection("circles").doc(circleId);
  const agg = await circleRef.collection("members").count().get();
  const count = agg.data().count;
  const update: Record<string, unknown> = { memberCount: count };
  // Empty circles disappear from discovery (old client behavior, kept).
  if (count === 0) update.privacy = "HIDDEN";
  try {
    await circleRef.update(update);
  } catch (err) {
    // Circle doc already deleted — nothing to sync.
    console.warn(`[syncCircleMemberCount] skipped for ${circleId}:`, err);
  }
}

export const onCircleMemberCreated = onDocumentCreated(
  { document: "circles/{circleId}/members/{memberId}", database: databaseId, region: "us-central1" },
  async (event) => syncCircleMemberCount(event.params.circleId)
);

export const onCircleMemberDeleted = onDocumentDeleted(
  { document: "circles/{circleId}/members/{memberId}", database: databaseId, region: "us-central1" },
  async (event) => syncCircleMemberCount(event.params.circleId)
);

/** Per-type counter buckets, mirroring the old GratitudeFlow.tsx logic. */
function mosaicUpdateFor(itemType: string): Record<string, FieldValue> {
  const update: Record<string, FieldValue> = {
    "trustMosaic.completedExchanges": FieldValue.increment(1),
  };
  if (itemType === "ASK") {
    update["trustMosaic.completedAsks"] = FieldValue.increment(1);
  } else if (itemType === "SHARE") {
    update["trustMosaic.completedShares"] = FieldValue.increment(1);
  } else if (itemType === "JOIN" || itemType === "IMECE" || itemType === "MISSION") {
    update["trustMosaic.completedJoins"] = FieldValue.increment(1);
    if (itemType === "IMECE") {
      update["trustMosaic.imeceParticipations"] = FieldValue.increment(1);
    }
  }
  return update;
}

/**
 * approveJoinRequest: PRIVATE circles promise "requires approval" — and
 * firestore.rules deny self-joining them, so admission MUST happen here.
 * Only the circle creator can approve. The Admin SDK writes the member doc
 * (bypassing the PRIVATE self-join rule by design), onCircleMemberCreated
 * maintains memberCount, and the requester gets a notification.
 */
export const approveJoinRequest = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const callerUid = request.auth.uid;
  const circleId = typeof request.data?.circleId === "string" ? request.data.circleId : "";
  const requesterId = typeof request.data?.requesterId === "string" ? request.data.requesterId : "";
  if (!circleId || !requesterId || circleId.length > 256 || requesterId.length > 128) {
    throw new HttpsError("invalid-argument", "circleId and requesterId are required.");
  }

  const db = getDb();
  const circleRef = db.collection("circles").doc(circleId);
  const requestRef = circleRef.collection("joinRequests").doc(requesterId);

  const [circleSnap, requestSnap] = await Promise.all([circleRef.get(), requestRef.get()]);
  if (!circleSnap.exists) {
    throw new HttpsError("not-found", "Circle not found.");
  }
  if (circleSnap.get("creatorId") !== callerUid) {
    throw new HttpsError("permission-denied", "Only the circle creator can approve requests.");
  }
  if (!requestSnap.exists) {
    throw new HttpsError("not-found", "Join request not found (it may have been withdrawn).");
  }

  // Admit: member doc (count maintained by trigger), requester's joinedCircles,
  // remove the request, notify the requester.
  await db.collection("circles").doc(circleId).collection("members").doc(requesterId).set({
    joinedAt: FieldValue.serverTimestamp(),
    approvedBy: callerUid,
  });
  await db.collection("users").doc(requesterId).set(
    { joinedCircles: FieldValue.arrayUnion(circleId) },
    { merge: true }
  );
  await requestRef.delete();
  await db.collection("notifications").add({
    userId: requesterId,
    actorId: callerUid,
    type: "CIRCLE_REQUEST_APPROVED",
    content: `You're in! Your request to join "${circleSnap.get("name") || "a circle"}" was approved.`,
    link: `/circles/${circleId}`,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

export const onGratitudeCreated = onDocumentCreated(
  { document: "gratitude_notes/{noteId}", database: databaseId, region: "us-central1" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const fromUserId: unknown = data.fromUserId;
    const toUserId: unknown = data.toUserId;
    const itemId: unknown = data.itemId;
    if (
      typeof fromUserId !== "string" || typeof toUserId !== "string" ||
      !fromUserId || !toUserId || fromUserId === toUserId ||
      typeof itemId !== "string" || !itemId
    ) {
      return; // No verifiable exchange — note stays, reputation unchanged.
    }

    const db = getDb();

    // Validate the exchange against the referenced item. itemType comes from
    // the item doc — the client-supplied field on the note is ignored.
    const itemSnap = await db.collection("items").doc(itemId).get();
    if (!itemSnap.exists) return;
    const item = itemSnap.data()!;
    if (item.ownerId !== fromUserId && item.ownerId !== toUserId) {
      console.warn(`[onGratitudeCreated] note ${event.params.noteId}: neither party owns item ${itemId} — skipping counters.`);
      return;
    }
    const itemType: string = typeof item.type === "string" ? item.type : "";

    // One reputation credit per (item, giver, recipient) tuple, ever.
    // The transaction marker also de-duplicates redelivered events.
    const markerRef = db.collection("gratitude_counted").doc(`${itemId}_${fromUserId}_${toUserId}`);
    const update = mosaicUpdateFor(itemType);

    await db.runTransaction(async (tx) => {
      const [marker, toSnap, fromSnap] = await Promise.all([
        tx.get(markerRef),
        tx.get(db.collection("users").doc(toUserId)),
        tx.get(db.collection("users").doc(fromUserId)),
      ]);
      if (marker.exists) return; // already counted (duplicate note or retry)
      tx.set(markerRef, {
        itemId,
        fromUserId,
        toUserId,
        noteId: event.params.noteId,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (toSnap.exists) tx.update(toSnap.ref, update);
      if (fromSnap.exists) tx.update(fromSnap.ref, update);
    });
  }
);
