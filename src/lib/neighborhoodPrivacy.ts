/**
 * FILE: neighborhoodPrivacy.ts
 * ROLE IN KULA: The "Location Shield" — protects users' exact home addresses.
 *
 * PROBLEM:
 *   If we store a user's exact home coordinates and use them as the center of their
 *   "neighborhood circle" on the map, any neighbor who sees the circle can infer
 *   the user's exact address (it's the center of the circle).
 *
 * SOLUTION:
 *   When a user saves their home address, we generate a RANDOM OFFSET center point.
 *   The circle is guaranteed to CONTAIN the home address, but the center is shifted
 *   by a random distance (10-70% of the radius) in a random direction. This means:
 *   - The home could be anywhere inside the circle
 *   - No reverse-engineering is possible from the public center
 *   - The offset distance itself is random, preventing "ring analysis"
 *
 * USED BY: Profile.tsx (when saving home location settings)
 */

/**
 * generateRandomizedCenter()
 *
 * Takes exact home coordinates and a neighborhood radius, and returns a new
 * center point that is randomly offset from the home. The home is guaranteed
 * to be inside the circle defined by (newCenter, radius).
 *
 * @param exactCoords - The user's real home coordinates { lat, lng }
 * @param radiusMeters - The neighborhood radius in meters (e.g. 500, 1000, 2000)
 * @returns A new center point { lat, lng } that is offset from the home
 *
 * MATH:
 *   1. Choose a random offset distance d ∈ [0.1R, 0.7R]
 *   2. Choose a random angle θ ∈ [0, 2π)
 *   3. Convert d from meters to latitude/longitude degrees:
 *      - 1 degree of latitude  ≈ 111,320 meters (constant everywhere)
 *      - 1 degree of longitude ≈ 111,320 * cos(lat) meters (varies by latitude)
 *   4. Shift: newCenter = exactCoords + d * (cosθ, sinθ) in degree space
 */
export function generateRandomizedCenter(
  exactCoords: { lat: number; lng: number },
  radiusMeters: number
): { lat: number; lng: number } {
  // Random offset distance: between 10% and 70% of the radius
  const minFraction = 0.1;
  const maxFraction = 0.7;
  const offsetFraction = minFraction + Math.random() * (maxFraction - minFraction);
  const offsetMeters = radiusMeters * offsetFraction;

  // Random direction: 0 to 2π radians
  const angle = Math.random() * 2 * Math.PI;

  // Convert offset from meters to degrees
  // 1 degree of latitude = ~111,320 meters
  const metersPerDegreeLat = 111320;
  // 1 degree of longitude varies by latitude
  const metersPerDegreeLng = 111320 * Math.cos(exactCoords.lat * Math.PI / 180);

  const offsetLat = (offsetMeters * Math.cos(angle)) / metersPerDegreeLat;
  const offsetLng = (offsetMeters * Math.sin(angle)) / metersPerDegreeLng;

  return {
    lat: exactCoords.lat + offsetLat,
    lng: exactCoords.lng + offsetLng,
  };
}

/**
 * Available neighborhood radius options (in meters).
 * Displayed as user-friendly labels in Profile.tsx settings.
 */
export const NEIGHBORHOOD_RADIUS_OPTIONS = [
  { value: 500, label: '500m', description: 'Close — a few blocks' },
  { value: 1000, label: '1 km', description: 'Standard — walkable neighborhood' },
  { value: 2000, label: '2 km', description: 'Broad — wider area' },
] as const;

export const DEFAULT_NEIGHBORHOOD_RADIUS = 1000; // meters
