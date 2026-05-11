import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { Search, X, Tag, ArrowRight, Target, Sparkles, Plus, Check, User as UserIcon, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Joyride, Step, EventData, STATUS } from 'react-joyride';
import { Item, UserProfile, KulaReachType } from '../types';
import { useAuth } from '../hooks/useAuth';

interface SearchOverlayProps {
  onClose: () => void;
}

export default function SearchOverlay({ onClose }: SearchOverlayProps) {
  const { user, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [userResults, setUserResults] = useState<{uid: string; name: string; matchType: 'lookout' | 'person', tags: string[]}[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingToRadar, setAddingToRadar] = useState(false);
  const [radarSuccess, setRadarSuccess] = useState(false);
  const [ruleReachVicinity, setRuleReachVicinity] = useState(true);
  const [ruleReachAllCircles, setRuleReachAllCircles] = useState(false);
  const [ruleRadius, setRuleRadius] = useState(5);
  const [rulePrivacy, setRulePrivacy] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    if (profile?.hasCompletedOnboarding && !profile?.hasCompletedSearchTour) {
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const handleJoyrideCallback = async (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      try {
        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            hasCompletedSearchTour: true
          });
        }
      } catch (e) {
        console.error('Error updating tour status:', e);
      }
    }
  };

  const tourSteps: Step[] = [
    {
      target: '#tour-search-input',
      content: 'Search for anything you need, any neighbor, or any circle!',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-search-radar',
      content: 'This is your Radar. You can set up alerts here.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-search-lookout',
      content: 'When you are "On the lookout" for something, KULA will notify you when a neighbor matches your need.',
      skipBeacon: true,
      skipScroll: true,
    },
    {
      target: '#tour-search-standby',
      content: 'When you declare "I am the person for" something (like a drill or gardening), neighbors looking for that will find you instantly!',
      skipBeacon: true,
      skipScroll: true,
    }
  ];

  const getRuleReachTypes = () => {
    const types: KulaReachType[] = [];
    if (ruleReachVicinity) types.push('VICINITY');
    if (ruleReachAllCircles) types.push('ALL_CIRCLES');
    return types;
  };

  const addToLookout = async (term: string) => {
    if (!user || !profile || !term) return;
    setAddingToRadar(true);
    try {
      const currentLookoutRules = profile.lookoutRules || [];
      if (!currentLookoutRules.find(r => r.keyword === term)) {
        const newRule: any = { 
          id: Math.random().toString(36).substring(7), 
          keyword: term, 
          type: 'ALL',
          reachTypes: getRuleReachTypes(),
          privacy: rulePrivacy
        };
        if (ruleReachVicinity) {
          newRule.radius = ruleRadius;
        }

        await updateDoc(doc(db, 'users', user.uid), {
          lookoutRules: [...currentLookoutRules, newRule].slice(0, 20)
        });
      }
      setRadarSuccess(true);
      setTimeout(() => setRadarSuccess(false), 2000);
    } catch (err) {
      console.error('Error adding to array', err);
    } finally {
      setAddingToRadar(false);
    }
  };

  const addToStandby = async (term: string) => {
    if (!user || !profile || !term) return;
    setAddingToRadar(true);
    try {
      const currentStandbyRules = profile.standbyRules || [];
      if (!currentStandbyRules.find(r => r.keyword === term)) {
        const newRule: any = { 
          id: Math.random().toString(36).substring(7), 
          keyword: term, 
          reachTypes: getRuleReachTypes(),
          privacy: rulePrivacy
        };
        if (ruleReachVicinity) {
          newRule.radius = ruleRadius;
        }

        await updateDoc(doc(db, 'users', user.uid), {
          standbyRules: [...currentStandbyRules, newRule].slice(0, 20)
        });
      }
      setRadarSuccess(true);
      setTimeout(() => setRadarSuccess(false), 2000);
    } catch (err) {
      console.error('Error adding to array', err);
    } finally {
      setAddingToRadar(false);
    }
  };

  const removeFromLookout = async (term: string) => {
    if (!user || !profile) return;
    try {
      const updates: any = {};
      if (profile.lookoutFor) {
        updates.lookoutFor = profile.lookoutFor.filter(t => t !== term);
      }
      if (profile.lookoutRules) {
        updates.lookoutRules = profile.lookoutRules.filter(r => r.keyword !== term);
      }
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      setUserResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        // Simple search logic: match categories or start of titles (Firestore limitations)
        const itemsRef = collection(db, 'items');
        const q = query(
          itemsRef,
          where('status', '==', 'ACTIVE'),
          limit(50)
        );
        
        const snapshot = await getDocs(q);
        const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
        
        const filtered = allItems.filter(item => 
          item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        setResults(filtered.slice(0, 10));

        // Let's also fetch users who have this term in their radar (client-side filter for MVP)
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(query(usersRef, limit(100)));
        const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

        const matchedUsers: {uid: string; name: string; matchType: 'lookout' | 'person', tags: string[]}[] = [];
        
        allUsers.forEach(u => {
          if (u.uid === user?.uid) return; // skip self
          const termLower = searchTerm.toLowerCase();
          
          let lookoutMatches: string[] = [];
          if (u.lookoutFor) {
            lookoutMatches = u.lookoutFor.filter(tag => tag?.toLowerCase().includes(termLower));
          }
          if (u.lookoutRules) {
            lookoutMatches.push(...u.lookoutRules.filter(r => r?.keyword?.toLowerCase().includes(termLower)).map(r => r.keyword));
          }
          
          let personMatches: string[] = [];
          if (u.thePersonFor) {
            personMatches = u.thePersonFor.filter(tag => tag?.toLowerCase().includes(termLower));
          }
          if (u.standbyRules) {
            personMatches.push(...u.standbyRules.filter(r => r?.keyword?.toLowerCase().includes(termLower)).map(r => r.keyword));
          }

          if (personMatches.length > 0) {
             matchedUsers.push({ uid: u.uid, name: u.displayName || 'Neighbor', matchType: 'person', tags: personMatches });
          } else if (lookoutMatches.length > 0) {
             matchedUsers.push({ uid: u.uid, name: u.displayName || 'Neighbor', matchType: 'lookout', tags: lookoutMatches });
          }
        });

        setUserResults(matchedUsers.slice(0, 5));

      } catch (err) {
        console.error('Error searching:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, user]);

  const AddRuleCard = (
    <div className="mt-8 p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl w-full max-w-sm mx-auto">
      <div className="flex justify-center mb-3">
        <Sparkles size={24} className="text-emerald-500" />
      </div>
      <h4 className="text-sm font-bold text-emerald-900 mb-2">Can't find exactly what you need?</h4>
      <p className="text-xs text-emerald-700/80 mb-4 leading-relaxed">
        Put it on your radar! We'll notify you when a neighbor lists an item matching "{searchTerm}". Or declare yourself as a standby for this need.
      </p>
      <div className="space-y-3 mb-4 text-left">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 cursor-pointer">
            <input type="checkbox" checked={ruleReachVicinity} onChange={(e) => setRuleReachVicinity(e.target.checked)} className="accent-emerald-600 rounded" />
            Within Distance
          </label>
          {ruleReachVicinity && (
            <div className="flex items-center gap-2 ml-6">
              <input 
                type="range"
                min="1"
                max="50"
                value={ruleRadius}
                onChange={(e) => setRuleRadius(Number(e.target.value))}
                className="flex-1 accent-emerald-600"
              />
              <span className="text-xs font-bold text-emerald-900 w-10 text-right">{ruleRadius} km</span>
            </div>
          )}
          
          <label className="flex items-center gap-2 text-xs font-bold text-emerald-900 cursor-pointer">
            <input type="checkbox" checked={ruleReachAllCircles} onChange={(e) => setRuleReachAllCircles(e.target.checked)} className="accent-emerald-600 rounded" />
            All My Circles
          </label>
        </div>
        
        <div className="pt-2 border-t border-emerald-100/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 mb-1 block">Privacy Preference</span>
          <select 
            value={rulePrivacy}
            onChange={(e) => setRulePrivacy(e.target.value as 'PUBLIC' | 'PRIVATE')}
            className="w-full bg-white border border-emerald-200/50 rounded-xl px-3 py-2 text-xs font-bold text-emerald-800 outline-none focus:border-emerald-400"
          >
            <option value="PUBLIC">Public (Available for others to contact me)</option>
            <option value="PRIVATE">Private (Only notify me when matched)</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <button
          onClick={() => addToLookout(searchTerm)}
          disabled={addingToRadar || radarSuccess || (profile?.lookoutRules || []).some(r => r.keyword === searchTerm) || (profile?.lookoutFor || []).includes(searchTerm)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-900 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {radarSuccess ? (
            <>
              <Check size={16} />
              Added to Radar
            </>
          ) : ((profile?.lookoutRules || []).some(r => r.keyword === searchTerm) || (profile?.lookoutFor || []).includes(searchTerm)) ? (
            <>
              <Check size={16} />
              Already on Radar
            </>
          ) : addingToRadar ? (
            'Adding...'
          ) : (
            <>
              <Plus size={16} />
              Add to "Lookout For"
            </>
          )}
        </button>
        <button
          onClick={() => addToStandby(searchTerm)}
          disabled={addingToRadar || radarSuccess || (profile?.standbyRules || []).some(r => r.keyword === searchTerm) || (profile?.thePersonFor || []).includes(searchTerm)}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm"
        >
          {radarSuccess ? (
            <>
              <Check size={16} />
              Added to Standby
            </>
          ) : ((profile?.standbyRules || []).some(r => r.keyword === searchTerm) || (profile?.thePersonFor || []).includes(searchTerm)) ? (
            <>
              <Check size={16} />
              Already a Standby
            </>
          ) : addingToRadar ? (
            'Adding...'
          ) : (
            <>
              <Plus size={16} />
              I am the person for "{searchTerm}"
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[200] p-6 pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        locale={{ last: 'Done' }}
        onEvent={handleJoyrideCallback}
        options={{
          showProgress: false,
          buttons: ['back', 'skip', 'primary'],
          arrowColor: '#f5f5f4', // stone-100
          backgroundColor: '#f5f5f4',
          overlayColor: 'rgba(28, 25, 23, 0.7)', // stone-900 / 0.7
          primaryColor: '#c1a077',
          textColor: '#292524', // stone-800
          zIndex: 1000,
        }}
        styles={{
          floater: {
            textAlign: 'left',
            borderRadius: '1rem',
            padding: '1rem',
          },
          buttonPrimary: {
            backgroundColor: '#292524',
            borderRadius: '1rem',
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '10px',
            padding: '12px 20px',
            color: '#ffffff',
          },
          buttonBack: {
            marginRight: 10,
            color: '#292524',
            fontFamily: 'sans-serif',
            fontSize: '12px',
          },
          buttonSkip: {
            color: '#78716c',
            fontFamily: 'sans-serif',
            fontSize: '12px',
          }
        }}
      />
      <motion.div 
        initial={{ y: 20, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.95 }}
        className="max-w-md mx-auto bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative z-[201]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 pb-4">
          <div className="relative" id="tour-search-input">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              autoFocus
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by keyword, category, or need..."
              className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl py-3.5 pl-12 pr-12 focus:outline-none focus:border-stone-900 transition-all font-medium text-stone-900"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-200 rounded-full text-stone-400"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[60vh] no-scrollbar px-6 pb-6">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-stone-400 serif italic text-sm">Searching the rings...</p>
            </div>
          ) : results.length > 0 || userResults.length > 0 ? (
            <div className="space-y-6">
              {results.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Found {results.length} items</h4>
                  {results.map(item => (
                    <div key={item.id} className="p-4 bg-stone-50 border border-stone-100 rounded-2xl flex items-center gap-4 group cursor-pointer hover:bg-white hover:border-stone-200 hover:shadow-md transition-all">
                      <div className="w-12 h-12 bg-white rounded-xl flex-shrink-0 flex items-center justify-center border border-stone-100 overflow-hidden">
                        {item.images?.[0] ? (
                          <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Tag size={20} className="text-stone-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-sm text-stone-900 truncate uppercase tracking-tight">{item.title}</h5>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400">
                           <span className="font-black uppercase tracking-widest text-[#d4af37]">{item.type}</span>
                           <span>•</span>
                           <span className="italic">{item.category}</span>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-stone-300 group-hover:translate-x-1 group-hover:text-stone-900 transition-all" />
                    </div>
                  ))}
                </div>
              )}

              {userResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Neighbors Near You</h4>
                  {userResults.map(u => (
                    <div key={u.uid} onClick={() => window.location.href = `/?u=${u.uid}`} className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl flex items-center gap-4 group cursor-pointer hover:bg-purple-50 hover:shadow-md transition-all">
                      <div className="w-12 h-12 bg-purple-100/50 rounded-xl flex-shrink-0 flex items-center justify-center border border-purple-200/50 text-purple-500">
                         <UserIcon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-sm text-purple-900 truncate tracking-tight">{u.name}</h5>
                        <div className="flex items-center gap-1 text-[10px] mt-0.5">
                           {u.matchType === 'person' ? (
                              <span className="text-purple-600 font-bold">The person for: {u.tags.join(', ')}</span>
                           ) : (
                              <span className="text-emerald-600 font-bold">Looking for: {u.tags.join(', ')}</span>
                           )}
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-purple-300 group-hover:translate-x-1 group-hover:text-purple-700 transition-all" />
                    </div>
                  ))}
                </div>
              )}
              {searchTerm.length >= 2 && AddRuleCard}
            </div>
          ) : searchTerm.length >= 2 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-200">
                <Search size={32} />
              </div>
              <p className="text-stone-500 font-serif font-bold">No matches found</p>
              
              {AddRuleCard}
            </div>
          ) : (
            <div className="py-6 space-y-8">
              {profile && (
                <div className="space-y-6" id="tour-search-radar">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={16} className="text-emerald-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800">My Radar</h4>
                  </div>
                  
                  <div className="space-y-3" id="tour-search-lookout">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">On the lookout for...</h5>
                    <div className="flex flex-wrap gap-2">
                      {profile.lookoutFor?.map(tag => (
                        <span key={tag} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-1">
                          {tag}
                          <button onClick={() => removeFromLookout(tag)} className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors ml-1">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {profile.lookoutRules?.map(rule => (
                        <span key={rule.id} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 flex items-center gap-1">
                          {rule.privacy === 'PRIVATE' && <Shield size={10} className="text-emerald-500" />}
                          {rule.type !== 'ALL' && <span className="uppercase text-[8px] bg-emerald-200 px-1 py-0.5 rounded text-emerald-900">{rule.type}</span>}
                          {rule.keyword} 
                          {rule.reachTypes?.includes('VICINITY') ? ` (${rule.radius}km)` : rule.reachTypes?.includes('ALL_CIRCLES') ? ' (All Circles)' : ' (Spec. Circle)'}
                          <button onClick={() => removeFromLookout(rule.keyword)} className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors ml-1">
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <span className="px-3 py-1.5 bg-stone-50 text-stone-400 rounded-full text-xs font-medium border border-stone-100 border-dashed flex items-center gap-1 italic">
                        Type above & hit 'Add' when empty
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3" id="tour-search-standby">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">I am the person for...</h5>
                    <div className="flex flex-wrap gap-2">
                      {profile.thePersonFor?.map(tag => (
                        <span key={tag} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-100 flex items-center gap-1">
                          {tag}
                        </span>
                      ))}
                      {profile.standbyRules?.map(rule => (
                        <span key={rule.id} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-bold border border-purple-100 flex items-center gap-1">
                          {rule.privacy === 'PRIVATE' && <Shield size={10} className="text-purple-500" />}
                          {rule.keyword} 
                          {rule.reachTypes?.includes('VICINITY') ? ` (${rule.radius}km)` : rule.reachTypes?.includes('ALL_CIRCLES') ? ' (All Circles)' : ' (Spec. Circle)'}
                        </span>
                      ))}
                      <button onClick={() => {
                        onClose(); // In a real app we might focus a specific input or redirect to profile
                      }} className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 hover:text-stone-600 text-stone-400 text-xs font-bold transition-colors border border-stone-100 rounded-full">
                        Manage in Profile
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Popular Searches</h4>
                <div className="flex flex-wrap gap-2">
                  {['İmece', 'Tools', 'Gardening', 'Sugar', 'Moving'].map(tag => (
                    <button 
                      key={tag}
                      onClick={() => setSearchTerm(tag)}
                      className="px-4 py-2 bg-stone-50 hover:bg-stone-100 text-stone-600 rounded-full text-xs font-bold transition-colors border border-stone-100"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-center">
           <button onClick={onClose} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">
             Close Search
           </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
