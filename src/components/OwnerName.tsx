/**
 * FILE: OwnerName.tsx
 * ROLE IN KULA: A "Smart Label" — resolves a user's UID to their first name.
 * 
 * WHY THIS EXISTS:
 *   Items in Firestore store `ownerId` (a UID like "abc123xyz"), but the UI needs
 *   to show "Alice" or "Bob". This component takes an ownerId and fetches the
 *   display name from the `users` collection.
 * 
 * OPTIMIZATION: If `initialName` is already provided (e.g., from the item's cached
 *   `ownerName` field), it skips the Firestore fetch entirely. This avoids an extra
 *   database read for every item card in the feed.
 * 
 * FIRST NAME ONLY: `fullName.split(' ')[0]` extracts just the first name.
 *   This is a deliberate design choice for the Berlin analog vibe — "Alice" feels
 *   more neighborly than "Alice Chen". It also protects privacy.
 * 
 * USED BY:
 *   - Feed.tsx — shows poster's name on each item card
 *   - ItemDetailsSheet.tsx — shows poster's name in the detail view
 *   - ChatRoom.tsx — shows sender names in channel messages
 * 
 * CLICKABLE: The component supports an `onClick` handler so parent components
 *   can navigate to the user's PublicProfile when the name is clicked.
 */
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface OwnerNameProps {
  ownerId: string;       // The UID to resolve
  initialName?: string;  // Pre-fetched name (avoids Firestore call if provided)
  className?: string;    // CSS classes from parent
  onClick?: (e: React.MouseEvent) => void; // Navigate to PublicProfile on click
}

export function OwnerName({ ownerId, initialName, className, onClick }: OwnerNameProps) {
  // Start with the first name from initialName, or fallback to 'Neighbor'
  const [name, setName] = useState(initialName ? initialName.split(' ')[0] : 'Neighbor');

  useEffect(() => {
    // Skip the fetch if we already have a real name
    if (initialName && initialName !== 'Neighbor') return;

    // Fetch the user's profile from Firestore to get their displayName
    const fetchName = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', ownerId));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          const fullName = profile.displayName || 'Neighbor';
          setName(fullName.split(' ')[0]); // First name only
        }
      } catch (err) {
        console.error('Error fetching owner name', err);
      }
    };
    fetchName();
  }, [ownerId, initialName]);

  return (
    <span 
      onClick={onClick}
      className={`${className} cursor-pointer hover:underline`}
    >
      {name || 'Neighbor'}
    </span>
  );
}
