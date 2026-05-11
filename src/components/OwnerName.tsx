import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface OwnerNameProps {
  ownerId: string;
  initialName?: string;
  className?: string;
}

export function OwnerName({ ownerId, initialName, className }: OwnerNameProps) {
  const [name, setName] = useState(initialName ? initialName.split(' ')[0] : 'Neighbor');

  useEffect(() => {
    // If we have a name and it's not 'Neighbor', we can use it.
    if (initialName && initialName !== 'Neighbor') return;

    const fetchName = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', ownerId));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          const fullName = profile.displayName || 'Neighbor';
          setName(fullName.split(' ')[0]);
        }
      } catch (err) {
        console.error('Error fetching owner name', err);
      }
    };
    fetchName();
  }, [ownerId, initialName]);

  return <span className={className}>{name || 'Neighbor'}</span>;
}
