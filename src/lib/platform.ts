/**
 * FILE: platform.ts
 * ROLE IN KULA: The "Platform Detector" — tells the app whether it's running
 * in a web browser or inside a native iOS/Android Capacitor shell.
 *
 * WHY THIS MATTERS:
 *   Some features work differently on native vs. web:
 *   - Sign-In: Web uses popups, native uses the Google Sign-In SDK.
 *   - Geolocation: Web uses navigator.geolocation, native uses CoreLocation.
 *   - Sharing: Web uses navigator.share, native uses the Share Sheet plugin.
 *   - Haptics: Only available on native (phones have vibration motors, browsers don't).
 *
 * HOW IT WORKS:
 *   Capacitor injects a global object `window.Capacitor` into the WebView.
 *   We check for its presence and the `isNativePlatform()` method.
 *   If running in Safari/Chrome on a laptop → isNative = false.
 *   If running inside the Capacitor iOS shell → isNative = true.
 */
import { Capacitor } from '@capacitor/core';

/**
 * isNative():
 * Returns true when the app is running inside a Capacitor native shell
 * (i.e., on a real iPhone or Android device via the compiled app).
 * Returns false when running in a web browser.
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * getPlatform():
 * Returns 'ios', 'android', or 'web' depending on where the app is running.
 * Useful for platform-specific UI tweaks (e.g., different safe area handling
 * on iPhones with Dynamic Island vs. Android status bars).
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}
