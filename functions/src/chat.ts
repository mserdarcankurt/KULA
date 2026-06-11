/**
 * FILE: chat.ts
 * ROLE: Server-validated chat interactions.
 *
 * votePoll: poll votes used to be a wholesale client overwrite of
 * poll.options — any chat member could zero out other people's votes or
 * stuff ballots (firestore.rules can check WHICH field changes, not how).
 * Votes now apply server-side in a transaction: the caller's UID is removed
 * from every option and added to exactly one, and nothing else can change.
 * firestore.rules no longer allow clients to write the poll field at all.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getDb } from "./utils";

function requireString(value: unknown, field: string, maxLen = 256): string {
  if (typeof value !== "string" || !value || value.length > maxLen) {
    throw new HttpsError("invalid-argument", `${field} must be a non-empty string.`);
  }
  return value;
}

export const votePoll = onCall({ maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const uid = request.auth.uid;
  const chatId = requireString(request.data?.chatId, "chatId");
  const messageId = requireString(request.data?.messageId, "messageId");
  const optionKey = requireString(request.data?.optionKey, "optionKey", 64);

  const db = getDb();

  // Membership check mirrors firestore.rules canAccessChatData:
  // DIRECT = participant; CHANNEL = member of the chat's circle.
  const chatSnap = await db.collection("chats").doc(chatId).get();
  if (!chatSnap.exists) {
    throw new HttpsError("not-found", "Chat not found.");
  }
  const chat = chatSnap.data()!;
  const isParticipant = (chat.participants || []).includes(uid);
  let isMember = isParticipant;
  if (!isMember && chat.type === "CHANNEL" && chat.circleId) {
    const memberSnap = await db.collection("circles").doc(chat.circleId)
      .collection("members").doc(uid).get();
    isMember = memberSnap.exists;
  }
  if (!isMember) {
    throw new HttpsError("permission-denied", "You are not a member of this chat.");
  }
  // Blocked users cannot interact (mirrors the message-create rule).
  if ((chat.blockedUids || []).includes(uid)) {
    throw new HttpsError("permission-denied", "Interaction unavailable.");
  }

  const msgRef = db.collection("chats").doc(chatId).collection("messages").doc(messageId);
  await db.runTransaction(async (tx) => {
    const msgSnap = await tx.get(msgRef);
    if (!msgSnap.exists) {
      throw new HttpsError("not-found", "Message not found.");
    }
    const poll = msgSnap.get("poll");
    if (!poll?.options || !poll.options[optionKey]) {
      throw new HttpsError("failed-precondition", "No such poll option.");
    }
    // One vote per member: remove the caller everywhere, add to the choice.
    const newOptions: Record<string, any> = {};
    for (const [key, opt] of Object.entries<any>(poll.options)) {
      const votes: string[] = (opt.votes || []).filter((v: string) => v !== uid);
      if (key === optionKey) votes.push(uid);
      newOptions[key] = { ...opt, votes };
    }
    tx.update(msgRef, { "poll.options": newOptions });
  });

  return { ok: true };
});
