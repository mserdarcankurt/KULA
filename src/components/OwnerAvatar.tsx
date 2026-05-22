/**
 * FILE: OwnerAvatar.tsx
 * ROLE IN KULA: A "Smart Avatar" — resolves a user's UID to their profile picture.
 * 
 * WHY THIS EXISTS:
 *   Like OwnerName.tsx, this component allows us to render the poster's profile picture
 *   without having to fetch user profiles for all items upfront. If cached (e.g. initialPhotoURL),
 *   it uses it immediately. Otherwise, it queries the `users` collection reactively.
 * 
 * FALLBACK:
 *   If no picture is set, it shows a clean circle with the user's first letter initial.
 * 
 * USED BY:
 *   - Feed.tsx — shows poster's avatar at the top right of item cards
 */
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface OwnerAvatarProps {
  ownerId: string;
  initialPhotoURL?: string;
  initialName?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function OwnerAvatar({ ownerId, initialPhotoURL, initialName, className = "w-8 h-8", onClick }: OwnerAvatarProps) {
  const [photoURL, setPhotoURL] = useState<string | null | undefined>(initialPhotoURL);
  const [displayName, setDisplayName] = useState<string | undefined>(initialName);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    // Skip if we already have the photo URL or have already queried
    if (initialPhotoURL || fetched) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', ownerId));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          setPhotoURL(profile.photoURL);
          setDisplayName(profile.displayName);
        }
      } catch (err) {
        console.error('Error fetching owner avatar', err);
      } finally {
        setFetched(true);
      }
    };
    fetchProfile();
  }, [ownerId, initialPhotoURL, fetched]);

  const initials = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <div 
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      className={`${className} rounded-full overflow-hidden border border-stone-100 flex items-center justify-center flex-shrink-0 bg-stone-100 text-stone-400 font-bold hover:scale-105 transition-transform`}
    >
      {photoURL ? (
        <img 
          referrerPolicy="no-referrer" 
          src={photoURL} 
          alt={displayName || 'Avatar'} 
          className="w-full h-full object-cover" 
        />
      ) : (
        <span className="text-[10px] select-none">{initials}</span>
      )}
    </div>
  );
}
