import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { buildNetworkGraph, findDegreesOfSeparation } from '../lib/network';
import { useAuth } from './useAuth';

export function useNetworkGraph() {
  const { user, profile } = useAuth();
  const [graph, setGraph] = useState<Record<string, string[]>>({});
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach(doc => {
        usersData.push(doc.data() as UserProfile);
      });
      setAllUsers(usersData);
      setGraph(buildNetworkGraph(usersData));
    });

    return () => unsubscribe();
  }, [user]);

  const getDegreesOfSeparation = (targetUid: string) => {
    if (!user || !profile) return null;
    if (profile.hostStatus !== 'APPROVED' && !profile.isAdmin) return null;
    
    return findDegreesOfSeparation(graph, user.uid, targetUid);
  };

  return { getDegreesOfSeparation, graph, allUsers };
}
