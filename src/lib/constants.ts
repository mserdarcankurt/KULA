/**
 * FILE: constants.ts
 * ROLE IN KULA: Default configuration for the Discovery/Explore feature.
 * 
 * DOWNSTREAM: These values are read by Discovery.tsx as initial filter settings.
 * When a user opens the Explore tab for the first time, they see items within
 * a 50km radius, all types, and all scopes. They can then narrow these filters.
 * 
 * WHY 50km? Berlin is roughly 40km across. A 50km radius captures the entire city
 * while allowing for suburban neighborhoods on the edges.
 */
export const DISCOVERY_DEFAULTS = {
  localOnly: false,          // false = show items from circles too, not just GPS vicinity
  radius: 50,               // in km — default search radius
  scope: 'ALL' as const,    // 'ALL' means show both VICINITY and CIRCLE items
  typeFilter: 'ALL' as const, // Show all item types (ASK, SHARE, IMECE, etc.)
};
