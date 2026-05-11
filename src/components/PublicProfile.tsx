import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserProfile, Item } from '../types';
import { X, Star, Award, MapPin, Shield, Tag, Heart, CheckCircle2, Clock, Ban, UserMinus, UserCheck, Instagram, Target, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { getFallbackImage } from '../lib/artDirection';
import TrustMosaicComponent from './TrustMosaic';
import ConnectionBadge from './ConnectionBadge';
import { ItemDetailsSheet } from './ItemDetailsSheet';

interface PublicProfileProps {
  userId: string;
  onClose: () => void;
}

export default function PublicProfile({ userId, onClose }: PublicProfileProps) {
  const { user, profile: myProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [nestedProfileId, setNestedProfileId] = useState<string | null>(null);

  const isBlocked = myProfile?.blockedUsers?.includes(userId);

  const handleToggleBlock = async () => {
    if (!user || isBlocking) return;
    
    const confirmBlock = isBlocked 
      ? window.confirm("Do you want to unblock this neighbor?")
      : window.confirm("Block this neighbor? You won't see each other's posts and they won't be able to message you.");
    
    if (!confirmBlock) return;

    setIsBlocking(true);
    try {
      const myRef = doc(db, 'users', user.uid);
      await updateDoc(myRef, {
        blockedUsers: isBlocked ? arrayRemove(userId) : arrayUnion(userId)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsBlocking(false);
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    }

    const q = query(
      collection(db, 'items'),
      where('ownerId', '==', userId),
      where('status', '==', 'ACTIVE')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Item[];
      fetchedItems.sort((a, b) => {
         const timeA = a.createdAt?.toMillis?.() || 0;
         const timeB = b.createdAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setItems(fetchedItems);
      setLoading(false);
    });

    fetchProfile();
    return unsubscribe;
  }, [userId]);

  if (loading && !profile) {
    return (
      <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center">
        <div className="animate-pulse text-stone-300 italic serif">Getting to know your neighbor...</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
      <div className="absolute top-6 right-6 z-10">
        <button 
          onClick={onClose}
          className="p-3 bg-stone-900/5 hover:bg-stone-900/10 rounded-full text-stone-400 hover:text-stone-900 transition-all backdrop-blur-sm"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-8 pb-32 space-y-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-32 h-32 bg-stone-100 rounded-[2.5rem] overflow-hidden border-4 border-stone-50 shadow-xl">
              {profile.photoURL ? (
                <img referrerPolicy="no-referrer" src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300 text-4xl font-bold">
                  {profile.displayName.charAt(0)}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="serif text-4xl font-bold text-stone-900 leading-none">{profile.displayName}</h2>
                {profile.isOrganization && (
                  <Shield size={24} className="text-indigo-600 fill-indigo-50" />
                )}
              </div>
              
              <div className="flex justify-center mt-2">
                <ConnectionBadge targetUserId={userId} />
              </div>
              
              {user && user.uid !== userId && (
                <button
                  onClick={handleToggleBlock}
                  disabled={isBlocking}
                  className={`mt-4 px-6 py-2 rounded-full font-black uppercase tracking-[0.2em] text-[8px] flex items-center gap-2 transition-all ${
                    isBlocked 
                      ? 'bg-stone-100 text-stone-900 hover:bg-stone-200' 
                      : 'bg-stone-900 text-stone-100 hover:bg-red-500 hover:text-white'
                  }`}
                >
                  {isBlocked ? (
                    <><UserCheck size={12} /> Unblock Neighbor</>
                  ) : (
                    <><Ban size={12} /> Block Neighbor</>
                  )}
                </button>
              )}

              <div className="flex items-center justify-center gap-2 text-stone-400 font-bold text-[10px] uppercase tracking-widest mt-4">
                {profile.isOrganization ? (
                  <>
                    <MapPin size={12} className="text-indigo-600" />
                    <span className="text-indigo-600">Verified Organization • {profile.orgType}</span>
                  </>
                ) : (
                  <>
                    <MapPin size={12} className="text-[--color-brand]" />
                    <span>Local Neighbor</span>
                  </>
                )}
              </div>
            </div>

            <p className="max-w-xs text-stone-500 italic leading-relaxed">
              {profile.bio || "A friendly neighbor contributing to the community!"}
            </p>

            {profile.instagramHandle && (
              <a 
                href={`https://instagram.com/${profile.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-full font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all w-max mx-auto"
              >
                <Instagram size={18} />
                <span>@{profile.instagramHandle}</span>
              </a>
            )}

            <TrustMosaicComponent
              userId={userId}
              mosaic={profile.trustMosaic}
              memberSince={profile.createdAt}
              compact
            />

            {((profile.lookoutFor?.length || 0) > 0 || (profile.thePersonFor?.length || 0) > 0 || (profile.lookoutRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0 || (profile.standbyRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0) && (
              <div className="space-y-6 w-full text-left pt-4">
                {((profile.lookoutFor?.length || 0) > 0 || (profile.lookoutRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0) && (
                  <div className="bg-emerald-50 rounded-[2rem] p-6 sm:p-8 border border-emerald-100/50">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800 mb-4">
                      <Target size={16} /> I am on the lookout for...
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {profile.lookoutFor?.map((item, i) => (
                        <span key={i} className="px-5 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-full shadow-sm border border-emerald-100">
                          {item}
                        </span>
                      ))}
                      {profile.lookoutRules?.filter(r => r.privacy !== 'PRIVATE').map(r => (
                        <span key={r.id} className="px-5 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-full shadow-sm border border-emerald-100">
                          {r.keyword} 
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {((profile.thePersonFor?.length || 0) > 0 || (profile.standbyRules?.filter(r => r.privacy !== 'PRIVATE').length || 0) > 0) && (
                  <div className="bg-purple-50 rounded-[2rem] p-6 sm:p-8 border border-purple-100/50">
                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-800 mb-4">
                      <Sparkles size={16} /> I am the person for...
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {profile.thePersonFor?.map((item, i) => (
                        <span key={i} className="px-5 py-2.5 bg-white text-purple-700 font-bold text-sm rounded-full shadow-sm border border-purple-100">
                          {item}
                        </span>
                      ))}
                      {profile.standbyRules?.filter(r => r.privacy !== 'PRIVATE').map(r => (
                        <span key={r.id} className="px-5 py-2.5 bg-white text-purple-700 font-bold text-sm rounded-full shadow-sm border border-purple-100">
                          {r.keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="serif text-2xl font-bold text-stone-800">Current Shares</h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{items.length} items</span>
            </div>

            <div className="space-y-4">
              {items.length > 0 ? (
                items.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => setSelectedItem(item)}
                    className={`w-full p-4 border rounded-2xl flex items-center gap-4 transition-all text-left hover:shadow-md hover:scale-[1.01] active:scale-[0.99] ${
                      item.type === 'IMECE' ? 'bg-amber-50/30 border-amber-100' : 
                      item.type === 'MISSION' ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-stone-100'
                    }`}
                  >
                    <div className="w-16 h-16 bg-stone-50 rounded-xl flex-shrink-0 overflow-hidden">
                      {item.images?.[0] ? (
                        <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <img src={getFallbackImage(item.category)} alt="" className="w-full h-full object-cover opacity-80" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-bold text-sm truncate ${
                        item.type === 'IMECE' ? 'text-amber-900' : 
                        item.type === 'MISSION' ? 'text-indigo-900' : 'text-stone-900'
                      }`}>
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-stone-400 mt-1 line-clamp-1 italic">{item.description}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-12 text-center text-stone-400 font-serif italic text-sm">
                  This neighbor is currently taking a break.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedItem && (
        <ItemDetailsSheet 
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onViewProfile={(targetId) => {
            if (targetId !== userId) {
              setNestedProfileId(targetId);
            }
            setSelectedItem(null);
          }}
        />
      )}

      {nestedProfileId && (
        <PublicProfile 
          userId={nestedProfileId} 
          onClose={() => setNestedProfileId(null)} 
        />
      )}
    </div>
  );
}
