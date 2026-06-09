/**
 * FILE: pushService.ts
 * ROLE IN KULA: The "Notification Engine" — handles requesting push notification
 * permissions and getting device tokens for both web and native platforms.
 *
 * HOW IT WORKS:
 *   - On WEB (browser): Uses Firebase Cloud Messaging (FCM) with a VAPID key.
 *     The browser shows its own "Allow notifications?" dialog. If granted,
 *     we get an FCM registration token that identifies this browser.
 *
 *   - On NATIVE (iOS/Android via Capacitor): Uses the @capacitor/push-notifications
 *     plugin to interface with Apple Push Notification Service (APNs) on iOS or
 *     Firebase Cloud Messaging (FCM) on Android. The native OS shows its permission
 *     dialog. We get a device token that can receive real push notifications even
 *     when the app is closed.
 *
 * TOKEN STORAGE:
 *   After getting a token, App.tsx saves it to the user's Firestore document
 *   at users/{uid}.fcmTokens[] using arrayUnion (prevents duplicates).
 *   Cloud Functions can then use these tokens to send pushes.
 *
 * CALLED BY: App.tsx (once, after login)
 */

import { isNative } from './platform';

// ─── Web-specific imports (lazy, only loaded on web) ───
let getTokenFromFCM: typeof import('firebase/messaging').getToken | null = null;
let messagingInstance: typeof import('./firebase').messaging = null;

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY || '';

/**
 * requestNotificationPermission():
 *
 * Requests permission for push notifications and returns a device token.
 *   - On iOS/Android: Calls the native APNs/FCM registration flow.
 *   - On Web: Calls Firebase Cloud Messaging browser flow.
 *
 * Returns the token string on success, or null on failure/denial.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  // ═══════════════════════════════════════════════════════
  // NATIVE PATH: iOS (APNs) / Android (FCM via Capacitor)
  // ═══════════════════════════════════════════════════════
  if (isNative()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Check current permission status
      const permResult = await PushNotifications.checkPermissions();

      if (permResult.receive === 'prompt' || permResult.receive === 'prompt-with-rationale') {
        // Ask the user — this shows the native iOS/Android permission dialog
        const requestResult = await PushNotifications.requestPermissions();
        if (requestResult.receive !== 'granted') {
          console.warn('[pushService] Native push permission denied.');
          return null;
        }
      } else if (permResult.receive !== 'granted') {
        console.warn('[pushService] Native push permission not granted:', permResult.receive);
        return null;
      }

      // Register with APNs (iOS) or FCM (Android)
      // This triggers the 'registration' event listener below
      return new Promise<string | null>((resolve) => {
        // Listen for successful registration
        PushNotifications.addListener('registration', (token) => {
          console.log('[pushService] Native push token:', token.value);
          resolve(token.value);
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error) => {
          console.error('[pushService] Native push registration failed:', error);
          resolve(null);
        });

        // Kick off the registration
        PushNotifications.register();
      });
    } catch (err) {
      console.error('[pushService] Native push error:', err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // WEB PATH: Firebase Cloud Messaging (browser)
  // ═══════════════════════════════════════════════════════
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return null;
  }

  try {
    // Lazy-load Firebase messaging to avoid importing on native
    if (!getTokenFromFCM) {
      const fcmModule = await import('firebase/messaging');
      getTokenFromFCM = fcmModule.getToken;
    }
    if (!messagingInstance) {
      const firebaseModule = await import('./firebase');
      messagingInstance = firebaseModule.messaging;
    }

    if (!messagingInstance) return null;

    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      const currentToken = await getTokenFromFCM!(messagingInstance, { vapidKey: VAPID_KEY });
      if (currentToken) {
        return currentToken;
      } else {
        console.warn('No registration token available. Request permission to generate one.');
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error requesting notification permission or FCM token:', error);
    return null;
  }
}

/**
 * showLocalNotification():
 * Shows a browser-level notification (only on web, only when tab is hidden).
 * On native, the OS handles notifications automatically via APNs/FCM.
 */
export function showLocalNotification(title: string, body: string) {
  // On native, push notifications are handled by the OS — skip this
  if (isNative()) return;

  if (!('Notification' in window) || window.Notification.permission !== 'granted') {
    return;
  }

  // Only trigger native system notification if the tab is in the background/inactive
  if (document.visibilityState === 'hidden') {
    try {
      new window.Notification(title, {
        body,
        icon: '/Circle_invite.png' // Use the present KULA asset icon
      });
    } catch (e) {
      console.error('Failed to show system notification:', e);
    }
  }
}
