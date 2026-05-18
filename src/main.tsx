/**
 * FILE: main.tsx
 * ROLE IN KULA: The "Ignition Key" — the very first code that runs.
 * 
 * CIRCUIT: This file is the entry point for the entire application.
 * When a user opens kula.community in their browser, the browser loads index.html,
 * which loads this file. Everything else in the app cascades from here.
 * 
 * FLOW:
 *   1. Import global styles (index.css) — this sets up fonts, colors, CSS variables.
 *   2. Test the Firebase connection — an early warning system if the database is down.
 *   3. Register the Service Worker — enables offline caching and future PWA capabilities.
 *   4. Mount the React app onto the DOM — this is where <App /> takes over.
 * 
 * DOWNSTREAM EFFECTS:
 *   - index.css sets CSS custom properties (--color-brand, --color-brand-light) that
 *     are used by EVERY component in the app for consistent theming.
 *   - testConnection() pings Firestore immediately so we know within milliseconds
 *     if the backend is reachable. If not, useAuth will show a loading spinner forever
 *     without this early diagnostic.
 *   - The Service Worker (/sw.js) is registered AFTER the page loads (inside 'load' event)
 *     so it doesn't compete with the initial render for network bandwidth.
 */
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testConnection } from './lib/firebase';

// Immediately test if we can reach the Firestore database.
// This runs before any UI renders. If it fails, check the console for
// "CRITICAL: Firestore unreachable" — that means the app will be non-functional.
// See: src/lib/firebase.ts → testConnection() for the implementation.
testConnection();

// Register the Service Worker for offline support and PWA features.
// The SW intercepts network requests and can serve cached versions of the app
// when the user has no internet — critical for a neighborhood app where people
// might be in basements, parks, or areas with poor signal.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

// Mount the app. document.getElementById('root') refers to the <div id="root">
// in index.html. The '!' is a TypeScript assertion that it won't be null.
// <StrictMode> enables extra development warnings (double-renders, deprecated APIs).
// <App /> is defined in src/App.tsx — it wraps everything in <AuthProvider> first.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
