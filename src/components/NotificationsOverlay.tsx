/**
 * FILE: NotificationsOverlay.tsx
 * ROLE IN KULA: The "Alert Panel" — shows system notifications in a dropdown overlay.
 */
import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { markNotificationRead } from '../lib/notifications';
import { Bell, X, CheckCircle, Info, HeartHandshake, MessageSquare, Clock, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationsOverlayProps {
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  setSelectedChatId?: (chatId: string | null) => void;
}

export default function NotificationsOverlay({ onClose, setActiveTab, setSelectedChatId }: NotificationsOverlayProps) {
  const { notifications, unreadCount, loading, markAllAsRead } = useNotifications();

  const handleNotificationClick = async (notif: any) => {
    await markNotificationRead(notif.id);
    onClose();

    if (notif.link) {
      if (notif.link.startsWith('/chats')) {
        const match = notif.link.match(/\/chats\/([^/]+)/);
        if (match && match[1]) {
          setSelectedChatId?.(match[1]);
        }
        setActiveTab('chats');
      } else if (notif.link.startsWith('/profile')) {
        setActiveTab('profile');
      } else if (notif.link.startsWith('/circles')) {
        setActiveTab('circles');
      } else if (notif.link.startsWith('/explore') || notif.link.startsWith('/home')) {
        setActiveTab('home');
      }
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
        <div className="flex items-center gap-2">
          <h3 className="serif font-bold text-lg text-stone-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              {unreadCount} new
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-full transition-colors">
          <X size={18} className="text-stone-400" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="p-10 text-center text-stone-400 italic text-sm">Loading alerts...</div>
        ) : notifications.length > 0 ? (
          <div className="divide-y divide-stone-50">
            {notifications.map((notif) => {
              const isVouch = notif.type === 'VOUCH_REQUEST' || notif.type === 'VOUCH_ACCEPTED';
              const isJoin = notif.type === 'JOIN' || notif.type === 'item_match';
              
              return (
                <div 
                  key={notif.id} 
                  className={`p-4 flex gap-3 transition-colors hover:bg-stone-50 cursor-pointer ${!notif.isRead ? 'bg-amber-50/10' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    notif.type === 'MESSAGE' || notif.type === 'new_message' ? 'bg-blue-100 text-blue-600' : 
                    isJoin ? 'bg-teal-100 text-teal-600' :
                    isVouch ? 'bg-emerald-100 text-emerald-600' :
                    'bg-stone-100 text-stone-600'
                  }`}>
                    {notif.type === 'MESSAGE' || notif.type === 'new_message' ? <MessageSquare size={14} /> : 
                     isJoin ? <HeartHandshake size={14} /> :
                     isVouch ? <Sparkles size={14} /> :
                     <Info size={14} />}
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
              );
            })}
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
      
      {unreadCount > 0 && (
        <div className="p-3 bg-stone-50 border-t border-stone-100 text-center flex justify-center">
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5"
          >
            <CheckCircle size={12} />
            Mark all as read
          </button>
        </div>
      )}
    </motion.div>
  );
}
