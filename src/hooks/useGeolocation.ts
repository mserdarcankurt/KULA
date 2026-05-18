/**
 * FILE: useGeolocation.ts
 * ROLE IN KULA: The "Compass" — reads the phone/browser's GPS coordinates.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   This hook is the STARTING POINT of the location-based features.
 *   It feeds coordinates into App.tsx → which passes them down to:
 *     - Explore.tsx → which passes them to useItems.ts for distance sorting
 *     - PostItem.tsx → which attaches them to new posts as the item's location
 *     - MapView.tsx → which uses them to center the map on the user's position
 * 
 * FLOW:
 *   1. On first render, asks the browser for GPS permission.
 *   2. If granted, stores { lat, lng } in state.
 *   3. If denied, stores an error message (app still works, just without distance sorting).
 * 
 * WHY ONLY ONCE?
 *   The empty dependency array [] means this runs once on mount.
 *   We don't continuously track the user — that would drain their battery.
 *   For a neighborhood app, knowing their position at app-open is sufficient.
 * 
 * ALSO EXPORTS: getDistance() — the Haversine formula for calculating
 *   "as the crow flies" distance between two GPS coordinates.
 *   Used by: useItems.ts to sort feed items by proximity.
 */
import { useState, useEffect } from 'react';

export function useGeolocation() {
  // State: the user's current GPS coordinates, or null if not yet available
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  // State: error message if GPS is denied or unavailable
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if the browser supports geolocation (it won't on very old browsers)
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    // Request the user's current position.
    // This triggers the browser's "Allow location?" popup on first visit.
    // SUCCESS: We store the coordinates.
    // FAILURE: We store the error (user denied, or GPS unavailable).
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        setError(err.message);
      }
    );
  }, []); // Empty array = run once when the component mounts

  return { location, error };
}

/**
 * getDistance():
 * Calculates the distance between two points on Earth using the Haversine formula.
 * 
 * WHY HAVERSINE?
 *   The Earth is a sphere (roughly). You can't just subtract coordinates like
 *   on a flat grid — that would give wildly wrong distances at different latitudes.
 *   Haversine accounts for the curvature of the Earth.
 * 
 * USED BY: useItems.ts → for each item in the feed, we calculate the distance
 *   from the user's GPS position to the item's posted location. Items are then
 *   sorted by distance, so the closest ones appear first.
 * 
 * ALSO USED BY: Discovery.tsx → for filtering items within a specific radius (e.g., 5km).
 * 
 * @param lat1 - User's latitude
 * @param lon1 - User's longitude
 * @param lat2 - Item's latitude
 * @param lon2 - Item's longitude
 * @returns Distance in kilometers
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in kilometers
  
  // Convert degree differences to radians (math requires radians)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  // The Haversine formula — calculates the "great-circle distance"
  // between two points on a sphere given their latitudes and longitudes
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Result in km
}
