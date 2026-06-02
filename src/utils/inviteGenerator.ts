/**
 * FILE: inviteGenerator.ts
 * ROLE IN KULA: The "Passcode Scribe" — generates cozy, neighborhood-themed invite codes.
 * 
 * BRADING & ART DIRECTION ALIGNMENT:
 *   Instead of generic, cold hexadecimal codes (like "A7F93X"), this generator compiles
 *   everyday neighborhood words related to KULA's Altbau, urban garden, and sharing philosophy.
 *   Examples: "warm-zucchini-47", "cozy-elevator-12", "sunny-balcony-89".
 */

const COZY_ADJECTIVES = [
  'warm', 'cozy', 'sunny', 'green', 'fresh', 'sweet', 'trusty', 'golden',
  'wild', 'local', 'bright', 'soft', 'kind', 'open', 'vouched', 'analog',
  'ripe', 'shared', 'helpful', 'earthy', 'blooming', 'sprouted', 'gardened',
  'dusty', 'dreamy', 'lively', 'gentle', 'rustic', 'vintage', 'cracked',
  'composted', 'handcrafted', 'wooden', 'shadowy', 'hidden', 'friendly'
];

const NEIGHBORHOOD_NOUNS = [
  'zucchini', 'handshake', 'elevator', 'balcony', 'backyard', 'altbau',
  'sprout', 'sugar', 'ladder', 'bicycle', 'teapot', 'garden', 'bench',
  'courtyard', 'honey', 'drill', 'key', 'cup', 'toolbox', 'basement',
  'roof', 'parsley', 'tomato', 'mauerpark', 'bikepump', 'wheelbarrow',
  'compost', 'coffee', 'cookie', 'spatula', 'sunflower', 'pigeon', 'streetart',
  'doorbell', 'doorknob', 'easel', 'plunger', 'shovel', 'wateringcan', 'guitar',
  'vinyl', 'cactus', 'nest', 'breeze', 'shadow', 'blanket', 'candle', 'lantern'
];

const WHIMSICAL_WORDS = [
  'teapot', 'bicycle', 'rooftop', 'guitar', 'balcony', 'coffee', 'cookie',
  'sunflower', 'nest', 'breeze', 'shadow', 'lantern', 'spatula', 'yarn',
  'socks', 'easel', 'keychain', 'toolbox', 'cactus', 'pigeon', 'sprout',
  'honey', 'blanket', 'candle', 'shovel', 'plunger', 'doorknob', 'doorbell',
  'jump', 'wave', 'paint', 'seed', 'grow', 'bake', 'sip', 'hum', 'float',
  'knit', 'mend', 'craft', 'share', 'give', 'vibe', 'chat', 'walk', 'smile'
];

import { runTransaction, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Generates a friendly, thematic invite passcode.
 * E.g., "cozy-zucchini-teapot-47"
 */
export function generateThematicCode(): string {
  const adj = COZY_ADJECTIVES[Math.floor(Math.random() * COZY_ADJECTIVES.length)];
  const noun = NEIGHBORHOOD_NOUNS[Math.floor(Math.random() * NEIGHBORHOOD_NOUNS.length)];
  const whimsical = WHIMSICAL_WORDS[Math.floor(Math.random() * WHIMSICAL_WORDS.length)];
  const num = Math.floor(10 + Math.random() * 90); // 2-digit number for absolute uniqueness
  
  return `${adj}-${noun}-${whimsical}-${num}`;
}

/**
 * Creates a unique invitation record in Firestore invites collection using the code as doc ID.
 * Runs in a transaction to prevent duplicate entries or collisions.
 */
export async function createUniqueInvite(
  code: string,
  hostUid: string,
  hostName: string,
  hostPhoto: string,
  memo: string
): Promise<string> {
  return await runTransaction(db, async (transaction) => {
    const inviteRef = doc(db, 'invites', code.toLowerCase().trim());
    const inviteSnap = await transaction.get(inviteRef);

    if (inviteSnap.exists()) {
      throw new Error('This invitation passcode already exists. Please shuffle and try a different one.');
    }

    transaction.set(inviteRef, {
      code: code.toLowerCase().trim(),
      createdBy: hostUid,
      createdByName: hostName,
      createdByPhoto: hostPhoto,
      createdAt: serverTimestamp(),
      status: 'PENDING',
      memo: memo.trim()
    });

    return code;
  });
}
