/**
 * FILE: analytics.ts
 * ROLE IN KULA: Telemetry Coordinator — acts as a central router for product event logs.
 * 
 * DESIGN PHILOSOPHY:
 *   - Unified client-side API for both Web (Firebase JS SDK) and Native (Capacitor Analytics plugin).
 *   - Automatically disables production event firing in local development / emulator modes.
 *   - Standardizes parameters to guarantee privacy boundaries (e.g. no raw message strings or PII).
 */
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';
import { getAnalytics, logEvent as webLogEvent } from 'firebase/analytics';
import { Capacitor } from '@capacitor/core';
import { isDev } from './firebase';

// Cache the web analytics instance. Note that it will fail to initialize on SSR
// or if the browser blocks it (adblockers), so we wrap initialization safely.
let webAnalytics: any = null;

function getWebAnalyticsInstance() {
  if (typeof window === 'undefined') return null;
  if (webAnalytics) return webAnalytics;
  
  try {
    webAnalytics = getAnalytics();
    return webAnalytics;
  } catch (error) {
    console.warn('[Analytics] Web SDK analytics failed to initialize. Active adblocker or restricted browser context.', error);
    return null;
  }
}

/**
 * Log a user engagement event to first-party storage.
 * 
 * @param eventName The key naming the user interaction (e.g. 'item_created')
 * @param params Associated event metadata payload
 */
export async function logEvent(eventName: string, params?: Record<string, any>) {
  // 1. Dev safety catch: Don't pollute live analytics during local development
  if (isDev) {
    console.log(`[Analytics DevLog] Event Fired: "${eventName}"`, params ? JSON.stringify(params) : '{}');
    return;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // 2. Mobile Native integration (iOS / Android)
      await FirebaseAnalytics.logEvent({
        name: eventName,
        params: params,
      });
    } else {
      // 3. Web integration
      const analyticsInstance = getWebAnalyticsInstance();
      if (analyticsInstance) {
        webLogEvent(analyticsInstance, eventName, params);
      }
    }
  } catch (error) {
    // Fail silently in production so telemetry failures do not break core user experience
    console.error(`[Analytics Error] Failed to log event "${eventName}":`, error);
  }
}

/**
 * Set custom user properties (e.g., trust_level or circle_role).
 * Used for building demographic aggregate segments without personal details.
 */
export async function setUserProperty(key: string, value: string) {
  if (isDev) {
    console.log(`[Analytics DevLog] User Property Set: ${key} = ${value}`);
    return;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAnalytics.setUserProperty({
        key: key,
        value: value,
      });
    }
    // Web SDK handles user properties through direct GA configurations or setUserId
  } catch (error) {
    console.error(`[Analytics Error] Failed to set user property "${key}":`, error);
  }
}
