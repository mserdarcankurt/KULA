/**
 * FILE: AdminPanel.tsx
 * ROLE IN KULA: The "Moderation Console" — content management for admins.
 * 
 * ACCESS CONTROL:
 *   Only visible when UserProfile.isAdmin is true. Navigation.tsx conditionally
 *   adds the admin tab, and App.tsx renders this component for the 'admin' tab.
 *   Firestore security (firestore.rules → isAdmin()) enforces server-side.
 * 
 * FEATURES:
 *   1. Content Moderation: Lists the 50 most recent items. Admins can:
 *      - Toggle "Featured" status (boosts visibility in the feed)
 *      - Delete items (removes harmful/spam content)
 *   2. Community Activity: Shows total user count from live Firestore data.
 * 
 * LIVE DATA:
 *   Both items and users use onSnapshot for real-time updates.
 *   If another admin deletes an item, it disappears from your panel instantly.
 * 
 * CONNECTION TO firestore.rules:
 *   deleteDoc(doc(db, 'items', id)) — allowed by: isAdmin() check in rules
 *   updateDoc(doc(db, 'items', id), { isFeatured }) — allowed by: isSignedIn() (open update)
 */
import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, limit, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Item, UserProfile } from '../types';
import { Shield, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AdminPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest items for moderation
    const itemsQ = query(collection(db, 'items'), orderBy('createdAt', 'desc'), limit(50));
    const unsubItems = onSnapshot(itemsQ, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Item[]);
    });

    // Fetch latest users
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(20));
    const unsubUsers = onSnapshot(usersQ, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as unknown as UserProfile[]);
      setLoading(false);
    });

    return () => {
      unsubItems();
      unsubUsers();
    };
  }, []);

  const deleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteDoc(doc(db, 'items', id));
    }
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await updateDoc(doc(db, 'items', id), { isFeatured: !current });
  };

  return (
    <div className="h-full flex flex-col pt-4 px-6 overflow-y-auto pb-20">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-stone-900 rounded-xl text-white">
          <Shield size={24} />
        </div>
        <h2 className="serif text-3xl font-bold text-stone-900">Admin Panel</h2>
      </div>

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
                    <span className={`text-[8px] font-black uppercase px-1 rounded ${item.type === 'SHARE' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
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
                  >
                    <CheckCircle size={16} />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 bg-stone-100 text-stone-500 hover:text-red-500 border border-stone-200 rounded-lg shadow-sm transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="serif text-xl font-bold mb-4">Community Activity</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-brand text-white rounded-3xl text-center space-y-1">
              <span className="text-3xl font-black">{users.length}</span>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-60">Total Users</p>
            </div>
            <div className="p-6 bg-stone-100 text-stone-900 rounded-3xl text-center space-y-1">
              <span className="text-3xl font-black">2.4k</span>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-40">Monthly Gifting</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
