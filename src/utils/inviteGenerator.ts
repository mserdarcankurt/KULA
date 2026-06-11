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

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

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
 * Creates a unique invitation record via the createInvite Cloud Function
 * (functions/src/invites.ts). Server-side so that clients never read or
 * write the invites collection directly — codes can't be probed or forged.
 * The host's name/photo are derived server-side from the caller's profile.
 */
export async function createUniqueInvite(
  code: string,
  _hostUid: string,
  _hostName: string,
  _hostPhoto: string,
  memo: string
): Promise<string> {
  const createInviteFn = httpsCallable<{ code: string; memo: string }, { code: string }>(functions, 'createInvite');
  try {
    const { data } = await createInviteFn({ code: code.toLowerCase().trim(), memo: memo.trim() });
    return data.code;
  } catch (err: any) {
    if ((err?.code || '').includes('already-exists')) {
      throw new Error('This invitation passcode already exists. Please shuffle and try a different one.');
    }
    throw err;
  }
}
