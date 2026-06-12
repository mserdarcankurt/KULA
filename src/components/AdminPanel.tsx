import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, limit, onSnapshot, orderBy, doc, deleteDoc, updateDoc, getCountFromServer, where } from 'firebase/firestore';
import { Item, UserProfile } from '../types';
import { Shield, Trash2, CheckCircle, Sliders } from 'lucide-react';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'MODERATION' | 'ANALYTICS'>('MODERATION');
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Analytics State
  const [totalItems, setTotalItems] = useState<number | null>(null);
  const [activeAsks, setActiveAsks] = useState<number | null>(null);
  const [activeShares, setActiveShares] = useState<number | null>(null);
  const [activeJoins, setActiveJoins] = useState<number | null>(null);
  const [activeFlows, setActiveFlows] = useState<number | null>(null);
  const [totalCircles, setTotalCircles] = useState<number | null>(null);
  const [pendingReports, setPendingReports] = useState<number | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    // Fetch latest items for moderation
    const itemsQ = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(50));
    const unsubItems = onSnapshot(itemsQ, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Item[];
      // Filter out shelved types
      setItems(fetched.filter(item => !['IMECE', 'MISSION'].includes(item.type)));
    });

    // Fetch latest users
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(20));
    const unsubUsers = onSnapshot(usersQ, async (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[]);
      setLoading(false);
      try {
        const countSnap = await getCountFromServer(collection(db, 'users'));
        setTotalUsers(countSnap.data().count);
      } catch (err) {
        console.error('Error fetching total user count:', err);
      }
    });

    return () => {
      unsubItems();
      unsubUsers();
    };
  }, []);

  // Fetch detailed aggregates when Admin Tab switches to Analytics
  useEffect(() => {
    if (activeTab !== 'ANALYTICS') return;

    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const [
          itemsSnap,
          asksSnap,
          sharesSnap,
          joinsSnap,
          flowsSnap,
          circlesSnap,
          reportsSnap
        ] = await Promise.all([
          getCountFromServer(query(collection(db, 'items'), where('type', 'in', ['ASK', 'SHARE', 'JOIN', 'FLOW']))),
          getCountFromServer(query(collection(db, 'items'), where('type', '==', 'ASK'), where('status', '==', 'ACTIVE'))),
          getCountFromServer(query(collection(db, 'items'), where('type', '==', 'SHARE'), where('status', '==', 'ACTIVE'))),
          getCountFromServer(query(collection(db, 'items'), where('type', '==', 'JOIN'), where('status', '==', 'ACTIVE'))),
          getCountFromServer(query(collection(db, 'items'), where('type', '==', 'FLOW'), where('status', '==', 'ACTIVE'))),
          getCountFromServer(collection(db, 'circles')),
          getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'PENDING')))
        ]);

        setTotalItems(itemsSnap.data().count);
        setActiveAsks(asksSnap.data().count);
        setActiveShares(sharesSnap.data().count);
        setActiveJoins(joinsSnap.data().count);
        setActiveFlows(flowsSnap.data().count);
        setTotalCircles(circlesSnap.data().count);
        setPendingReports(reportsSnap.data().count);
      } catch (err) {
        console.error('Error fetching analytics aggregates:', err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [activeTab]);

  const deleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteDoc(doc(db, 'items', id));
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'items', id), { isFeatured: !current });
  };

  return (
    <div className="h-full flex flex-col pt-4 px-6 overflow-y-auto pb-20 text-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-stone-900 rounded-xl text-white">
          <Shield size={24} />
        </div>
        <h2 className="serif text-3xl font-bold text-stone-900">Admin Panel</h2>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-[#F3F1EB] p-1 rounded-2xl border border-stone-350 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] w-fit mb-6">
        {[
          { id: 'MODERATION', label: 'Content Moderation' },
          { id: 'ANALYTICS', label: 'Analytics & Pulse' }
        ].map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id as 'MODERATION' | 'ANALYTICS')}
              className={`py-1.5 px-4 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider ${
                isActive 
                  ? 'bg-brand text-white shadow-sm font-black' 
                  : 'text-stone-500 hover:text-stone-850'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'MODERATION' ? (
        <div className="space-y-8">
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="serif text-xl font-bold">Content Moderation</h3>
              <span className="text-[10px] font-black bg-stone-100 px-2 py-1 rounded uppercase tracking-widest text-stone-500">
                {items.length} Recent Items
              </span>
            </div>
            
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between group">
                  <div className="flex-1 overflow-hidden pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        item.type === 'SHARE' ? 'bg-green-100 text-green-600' : 
                        item.type === 'ASK' ? 'bg-blue-100 text-blue-600' : 
                        item.type === 'JOIN' ? 'bg-teal-100 text-teal-600' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {item.type}
                      </span>
                      <h4 className="font-bold text-sm truncate">{item.title}</h4>
                    </div>
                    <p className="text-xs text-stone-400 line-clamp-1 mt-1 italic">"{item.description}"</p>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => toggleFeatured(item.id, item.isFeatured)}
                      className={`p-2 rounded-lg transition-all ${item.isFeatured ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-stone-100 text-stone-500 hover:text-amber-500 border border-stone-200 shadow-sm'}`}
                      title={item.isFeatured ? "Unfeature post" : "Feature post"}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-2 bg-stone-100 text-stone-500 hover:text-red-500 border border-stone-200 rounded-lg shadow-sm transition-all"
                      title="Delete post"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="serif text-xl font-bold">Community Pulse</h3>
            {loadingAnalytics && (
              <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider animate-pulse">
                Refreshing metrics...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Total Neighbors */}
            <div className="p-6 bg-[#EADFC9]/50 border border-[#D9D0C0] rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                Registered Neighbors
              </span>
              <div className="text-4xl font-black text-stone-900">
                {totalUsers !== null ? totalUsers : '...'}
              </div>
              <p className="text-[10px] text-stone-400">Total verified accounts in the network</p>
            </div>

            {/* Total Items */}
            <div className="p-6 bg-[#FAF8F2] border border-[#D9D0C0] rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                Total UGC Created
              </span>
              <div className="text-4xl font-black text-stone-900">
                {totalItems !== null ? totalItems : '...'}
              </div>
              <p className="text-[10px] text-stone-400">Posts, Asks, Shares & Join events</p>
            </div>

            {/* Pending Reports */}
            <div className={`p-6 border rounded-[2rem] shadow-sm flex flex-col justify-between h-40 transition-colors ${
              pendingReports && pendingReports > 0 
                ? 'bg-[#C86A51]/10 border-[#C86A51]/30' 
                : 'bg-[#FAF8F2] border-[#D9D0C0]'
            }`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                {pendingReports && pendingReports > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#C86A51] animate-pulse" />
                )}
                Pending Reports
              </span>
              <div className={`text-4xl font-black ${
                pendingReports && pendingReports > 0 ? 'text-[#C86A51]' : 'text-stone-900'
              }`}>
                {pendingReports !== null ? pendingReports : '...'}
              </div>
              <p className="text-[10px] text-stone-400">Flagged content needing resolution</p>
            </div>

            {/* Active Asks */}
            <div className="p-6 bg-[#C86A51]/5 border border-[#C86A51]/15 rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#C86A51]">
                Active Asks
              </span>
              <div className="text-4xl font-black text-[#C86A51]">
                {activeAsks !== null ? activeAsks : '...'}
              </div>
              <p className="text-[10px] text-stone-500">Neighbors asking for assistance</p>
            </div>

            {/* Active Shares */}
            <div className="p-6 bg-[#4A6B53]/5 border border-[#4A6B53]/15 rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#4A6B53]">
                Active Shares
              </span>
              <div className="text-4xl font-black text-[#4A6B53]">
                {activeShares !== null ? activeShares : '...'}
              </div>
              <p className="text-[10px] text-stone-500">Items, skills, or favors being gifted</p>
            </div>

            {/* Active Joins */}
            <div className="p-6 bg-teal-50/50 border border-teal-100 rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                Active Meet-ups (Joins)
              </span>
              <div className="text-4xl font-black text-teal-800">
                {activeJoins !== null ? activeJoins : '...'}
              </div>
              <p className="text-[10px] text-stone-500">Horizontally-organized gatherings</p>
            </div>

            {/* Active Flows */}
            <div className="p-6 bg-brand/5 border border-brand/15 rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand">
                Hopescrolling Updates
              </span>
              <div className="text-4xl font-black text-brand">
                {activeFlows !== null ? activeFlows : '...'}
              </div>
              <p className="text-[10px] text-stone-500">Recent status updates & photos</p>
            </div>

            {/* Total Circles */}
            <div className="p-6 bg-[#D4A373]/5 border border-[#D4A373]/20 rounded-[2rem] shadow-sm flex flex-col justify-between h-40">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#B38F4F]">
                Active Circles
              </span>
              <div className="text-4xl font-black text-[#B38F4F]">
                {totalCircles !== null ? totalCircles : '...'}
              </div>
              <p className="text-[10px] text-stone-500">Mutual aid trust networks & interest groups</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
