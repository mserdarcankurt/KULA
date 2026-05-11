import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Bell, X, Check, Info, HeartHandshake, MessageSquare, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationsOverlayProps {
  onClose: () => void;
}

export default function NotificationsOverlay({ onClose }: NotificationsOverlayProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      fetched.sort((a, b) => {
         const timeA = a.createdAt?.toMillis?.() || 0;
         const timeB = b.createdAt?.toMillis?.() || 0;
         return timeB - timeA;
      });
      setNotifications(fetched.slice(0, 20));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return unsubscribe;
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-16 right-6 w-80 bg-white border border-stone-100 shadow-2xl rounded-3xl z-[100] overflow-hidden"
    >
      <div className="p-4 border-b border-stone-50 flex justify-between items-center bg-stone-50/50">
        <h3 className="serif font-bold text-lg text-stone-900">Notifications</h3>
        <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-full transition-colors">
          <X size={18} className="text-stone-400" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="p-10 text-center text-stone-400 italic text-sm">Loading alerts...</div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-stone-50">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 flex gap-3 transition-colors hover:bg-stone-50 cursor-pointer ${!notif.isRead ? 'bg-amber-50/20' : ''}`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  notif.type === 'MESSAGE' ? 'bg-blue-100 text-blue-600' : 
                  notif.type === 'IMECE' ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-600'
                }`}>
                  {notif.type === 'MESSAGE' ? <MessageSquare size={14} /> : 
                   notif.type === 'IMECE' ? <HeartHandshake size={14} /> : <Info size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-800 leading-snug">{notif.content}</p>
                  <div className="flex items-center gap-1 text-[9px] text-stone-400 mt-1 font-bold uppercase tracking-tighter">
                    <Clock size={10} />
                    <span>
                      {notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                    </span>
                  </div>
                </div>
                {!notif.isRead && (
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shadow-sm"></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-3 text-stone-200">
              <Bell size={24} />
            </div>
            <p className="text-sm text-stone-400 serif italic">All quiet for now</p>
          </div>
        )}
      </div>
      
      {notifications.length > 0 && (
        <div className="p-3 bg-stone-50 border-t border-stone-50 text-center">
          <button className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">
            View All Activity
          </button>
        </div>
      )}
    </motion.div>
  );
}
