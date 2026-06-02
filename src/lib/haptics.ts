/**
 * FILE: haptics.ts
 * ROLE IN KULA: The "Touch Feedback Engine" — provides subtle vibrations
 * on native devices to make interactions feel alive and premium.
 *
 * WHY HAPTICS MATTER FOR RETENTION:
 *   - Micro-vibrations create a subconscious "reward" feeling when users
 *     complete actions (giving, matching, sharing).
 *   - Apps like Instagram, Tinder, and Apple Pay all use haptics heavily.
 *   - It transforms a "web app in a wrapper" into something that *feels* native.
 *
 * HOW IT WORKS:
 *   - On NATIVE (iOS/Android): Calls the device's vibration motor via @capacitor/haptics.
 *     On iPhones, this uses the Taptic Engine (the same hardware that powers 3D Touch).
 *   - On WEB (browser): Does nothing silently. No errors, no crashes.
 *
 * USAGE:
 *   import { hapticLight, hapticMedium, hapticSuccess } from '../lib/haptics';
 *   <button onClick={() => { hapticLight(); doSomething(); }}>Tap me</button>
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

/**
 * hapticLight():
 * A very subtle tap — like tapping a key on the keyboard.
 * Use for: Button presses, toggling filters, navigating between tabs.
 */
export async function hapticLight() {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (_) {
    // Silently fail on simulators or devices without haptic hardware
  }
}

/**
 * hapticMedium():
 * A noticeable but pleasant tap — like pulling to refresh.
 * Use for: Confirming an action, selecting a circle, opening a sheet.
 */
export async function hapticMedium() {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (_) {}
}

/**
 * hapticHeavy():
 * A strong, definitive tap — like dropping something into place.
 * Use for: Major actions like posting an item, completing onboarding.
 */
export async function hapticHeavy() {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (_) {}
}

/**
 * hapticSuccess():
 * A special "success" pattern — two quick taps.
 * Use for: Successful matches, trust connections, item bridges.
 */
export async function hapticSuccess() {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (_) {}
}

/**
 * hapticWarning():
 * A cautionary tap pattern.
 * Use for: Destructive action confirmations, errors.
 */
export async function hapticWarning() {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (_) {}
}
