import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { query, collection, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { getOrCreateChat } from '../services/chatService';
import { useItems } from '../hooks/useItems';
import { useAuth } from '../hooks/useAuth';
import { Search, Shield, MessageSquare } from 'lucide-react';
import { UserProfile, Item } from '../types';
import { getFallbackImage } from '../lib/artDirection';

export default function Organizations({ 
  location, 
  onNavigateToChat 
}: { 
  location: { lat: number; lng: number } | null;
  onNavigateToChat?: (chatId: string) => void;
}) {
  const { user, profile } = useAuth();
  const [missionItems, setMissionItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Fetch missions explicitly across all circles
  useEffect(() => {
    const q = query(
      collection(db, 'items'),
      where('type', '==', 'MISSION'),
      where('status', '==', 'ACTIVE')
      // Note: No circleId filter, so it shows all public & circle missions
    );
    
    // Fallback: order on client side if composite index is missing initially for 'type'/'status'/'createdAt'
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      fetchedItems = fetchedItems.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setMissionItems(fetchedItems);
      setLoadingItems(false);
    }, (error) => {
      console.error("Error fetching missions:", error);
    });

    return unsubscribe;
  }, []);

  const [organizations, setOrganizations] = useState<UserProfile[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'LIST' | 'FEED'>('LIST');

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const q = query(collection(db, 'users'), where('isOrganization', '==', true));
        const snap = await getDocs(q);
        const orgs = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        setOrganizations(orgs);
      } catch (err) {
        console.error('Error fetching orgs:', err);
      } finally {
        setLoadingOrgs(false);
      }
    };
    fetchOrgs();
  }, []);

  const filteredOrgs = organizations.filter(org => 
    org.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleChat = async (orgId: string) => {
    if (!user) return;
    try {
      const chatId = await getOrCreateChat(user.uid, orgId);
      if (onNavigateToChat) {
        onNavigateToChat(chatId);
      }
    } catch (err) {
      console.error('Error starting chat:', err);
    }
  };

  return (
    <div className="h-full flex flex-col pt-4 bg-stone-50">
      <div className="px-6 space-y-4 mb-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="serif text-3xl font-bold text-indigo-900">Community Partners</h2>
            <p className="text-stone-500 text-xs italic serif">Verified organizations serving your neighborhood.</p>
          </div>
          <Shield className="text-indigo-600 mb-2" size={28} />
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={() => setView('LIST')}
             className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
               view === 'LIST' ? 'bg-indigo-900 border-indigo-900 text-white shadow-lg font-black' : 'bg-white border-stone-100 text-stone-400'
             }`}
           >
             Organizations
           </button>
           <button 
             onClick={() => setView('FEED')}
             className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
               view === 'FEED' ? 'bg-indigo-900 border-indigo-900 text-white shadow-lg font-black' : 'bg-white border-stone-100 text-stone-400'
             }`}
           >
             Mission Feed
           </button>
        </div>

        {view === 'LIST' && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Search organizations..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-none rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>
        )}
      </div>

      <div className="flex-1 px-6 space-y-4 pb-20 overflow-y-auto no-scrollbar">
        {view === 'LIST' ? (
          loadingOrgs ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white animate-pulse rounded-3xl" />)}
            </div>
          ) : filteredOrgs.length > 0 ? (
            filteredOrgs.map(org => (
              <div key={org.uid} className="bg-white p-5 rounded-[2rem] shadow-sm border border-indigo-50 flex gap-4 hover:shadow-md transition-all group">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {org.photoURL ? (
                    <img referrerPolicy="no-referrer" src={org.photoURL} alt={org.displayName} className="w-full h-full object-cover shadow-inner" />
                  ) : (
                    <Shield className="text-indigo-300" size={32} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="serif font-bold text-lg text-indigo-950">{org.displayName}</h3>
                    {org.isVerified && <Shield size={14} className="text-indigo-500 fill-indigo-50" />}
                  </div>
                  <p className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.2em]">{org.orgType} • Verified Partner</p>
                  <p className="text-xs text-stone-400 mt-1 line-clamp-1 italic serif">"Building stronger community bonds through resource sharing."</p>
                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 bg-stone-100 text-stone-600 text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl hover:bg-stone-200 transition-all">
                      View Profile
                    </button>
                    <button 
                      onClick={() => handleChat(org.uid)}
                      className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 text-stone-400 italic font-serif">No organizations found matching your search.</div>
          )
        ) : (
          loadingItems ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-48 bg-indigo-50/50 animate-pulse rounded-[2rem]" />)}
            </div>
          ) : missionItems.length > 0 ? (
            <div className="space-y-6">
               {missionItems.map(item => (
                 <div key={item.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-indigo-100 hover:shadow-md transition-all group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 group-hover:bg-indigo-100 transition-colors" />
                   
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-50 shadow-sm bg-white">
                         {item.ownerPhoto ? (
                           <img referrerPolicy="no-referrer" src={item.ownerPhoto} alt={item.ownerName} className="w-full h-full object-cover" />
                         ) : (
                           <Shield className="w-full h-full p-2 text-indigo-300" />
                         )}
                       </div>
                       <div>
                         <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-1">
                           {item.ownerName} <Shield size={12} className="text-indigo-500 fill-indigo-50" />
                         </h4>
                         <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Verified Organization</p>
                       </div>
                     </div>
                     <div className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm shadow-indigo-200">
                       Mission
                     </div>
                   </div>

                   <h3 className="serif text-xl font-bold text-stone-900 mb-2 leading-tight">
                     {item.title}
                   </h3>
                   <p className="text-sm text-stone-500 mb-6 line-clamp-3 leading-relaxed">
                     {item.description}
                   </p>

                   <div className="w-full h-48 rounded-2xl overflow-hidden mb-6 shadow-inner">
                     {item.images?.[0] ? (
                       <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                     ) : (
                       <img src={getFallbackImage(item.category)} alt="" className="w-full h-full object-cover opacity-90" />
                     )}
                   </div>

                   <div className="flex items-center justify-between border-t border-stone-100 pt-4 mt-auto">
                     <div className="flex items-center gap-4">
                       <div className="flex -space-x-2">
                         {[1, 2, 3].map(i => (
                           <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-stone-200 flex items-center justify-center overflow-hidden">
                             <img referrerPolicy="no-referrer" src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}${i}`} className="w-full h-full object-cover" />
                           </div>
                         ))}
                         <div className="w-6 h-6 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center text-[8px] font-black text-indigo-600">
                           +{(item.participants?.length || 0)}
                         </div>
                       </div>
                       <span className="text-xs font-medium text-stone-500">
                         {item.participants?.length || 0} joining
                       </span>
                     </div>
                     
                     <div className="flex gap-2">
                       <button className="px-4 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-100 transition-all">
                         Share
                       </button>
                       <button onClick={() => handleChat(item.ownerId)} className="px-6 py-2 bg-indigo-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-800 transition-all shadow-md active:scale-95">
                         Volunteer
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="text-center py-20 text-stone-400 italic font-serif">No active organizational missions.</div>
          )
        )}
      </div>
    </div>
  );
}
