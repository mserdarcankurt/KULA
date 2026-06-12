/**
 * FILE: BridgeSheet.tsx
 * ROLE IN KULA: The "Share / Bridge" Panel — allows users to share items inside KULA
 * (to circles or direct connections) or externally via the Web Share API.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Tag, Zap, Loader2, Share2, Copy, Send, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { showToast } from '../lib/dialogs';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import { isNative } from '../lib/platform';
import { Share } from '@capacitor/share';

interface BridgeSheetProps {
  item: Item;
  onClose: () => void;
  onBridged: () => void;
}

export default function BridgeSheet({ item, onClose, onBridged }: BridgeSheetProps) {
  const { user, profile } = useAuth();
  const [circles, setCircles] = useState<any[]>([]);
  const [connections, setConnections] = useState<{chatId: string, userId: string, name: string, photoURL?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [bridgingId, setBridgingId] = useState<string | null>(null);

  interface BridgeTarget {
    type: 'CONNECTION' | 'CIRCLE';
    targetId: string;
    targetName: string;
    friendId?: string;
  }
  const [bridgeTarget, setBridgeTarget] = useState<BridgeTarget | null>(null);
  const [bridgeMessage, setBridgeMessage] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    
    // Load circles using the joinedCircles array in profile
    let unsubCircles = () => {};
    if (profile?.joinedCircles && profile.joinedCircles.length > 0) {
      const fetchJoinedCircles = async () => {
        const fetchedCircles: any[] = [];
        for (const cid of (profile.joinedCircles || []).slice(0, 30)) {
          try {
            const circleSnap = await getDoc(doc(db, 'circles', cid));
            if (circleSnap.exists()) {
              fetchedCircles.push({ id: circleSnap.id, ...circleSnap.data() });
            }
          } catch (err) {
            console.error(`Error fetching joined circle ${cid}:`, err);
          }
        }
        setCircles(fetchedCircles);
      };
      
      fetchJoinedCircles();
    } else {
      setCircles([]);
    }

    // Load recent connections (chats)
    const qChats = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    const unsubChats = onSnapshot(qChats, async (snapshot) => {
      const connPromises = snapshot.docs.map(async (docSnap) => {
        const chatData = docSnap.data();
        const otherUserId = chatData.participants.find((id: string) => id !== user.uid);
        if (!otherUserId) return null;
        
        try {
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          if (userDoc.exists()) {
            return {
              chatId: docSnap.id,
              userId: otherUserId,
              name: userDoc.data().displayName || 'Neighbor',
              photoURL: userDoc.data().photoURL
            };
          }
        } catch (e) {
          console.error('Error fetching user for connection', e);
        }
        return null;
      });
      
      const resolvedConns = (await Promise.all(connPromises)).filter(Boolean) as typeof connections;
      setConnections(resolvedConns);
      setLoading(false);
    });

    return () => {
      unsubCircles();
      unsubChats();
    };
  }, [user, profile?.joinedCircles]);

  const handleBridgeToCircle = (circleId: string, circleName: string) => {
    setBridgeTarget({
      type: 'CIRCLE',
      targetId: circleId,
      targetName: circleName
    });
    setBridgeMessage(`I'm sharing this ${item.type.toLowerCase()} with the circle!`);
  };

  const handleBridgeToConnection = (chatId: string, friendId: string, friendName: string) => {
    setBridgeTarget({
      type: 'CONNECTION',
      targetId: chatId,
      targetName: friendName,
      friendId: friendId
    });
    setBridgeMessage(`Thought this might be relevant to you: ${item.title}`);
  };

  const executeBridge = async () => {
    if (!user || !bridgeTarget) return;
    setBridgingId(bridgeTarget.targetId);
    
    try {
      if (bridgeTarget.type === 'CIRCLE') {
        const chatId = `${bridgeTarget.targetId}_general`; // Default to general channel
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          chatId: chatId,
          senderId: user.uid,
          senderName: user.displayName || 'Neighbor',
          text: bridgeMessage,
          type: 'TEXT',
          attachment: {
            type: 'ITEM_BRIDGE',
            itemId: item.id,
            title: item.title,
            image: item.images?.[0] || null
          },
          createdAt: serverTimestamp(),
          chatType: 'CHANNEL',
          circleId: bridgeTarget.targetId,
          participants: []
        });

        await addDoc(collection(db, 'notifications'), {
          userId: item.ownerId,
          actorId: user.uid,
          type: 'ITEM_BRIDGED',
          content: `Your ${item.type.toLowerCase()} was shared with circle "${bridgeTarget.targetName}"!`,
          isRead: false,
          link: `/circles/${bridgeTarget.targetId}`,
          createdAt: serverTimestamp()
        });
      } else {
        const chatId = bridgeTarget.targetId;
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          chatId: chatId,
          senderId: user.uid,
          senderName: profile?.displayName || user.displayName || 'Neighbor',
          text: bridgeMessage,
          type: 'TEXT',
          attachment: {
            type: 'ITEM_BRIDGE',
            itemId: item.id,
            title: item.title,
            image: item.images?.[0] || null
          },
          createdAt: serverTimestamp(),
          chatType: 'DIRECT',
          participants: [user.uid, bridgeTarget.targetId]
        });
        
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: `Shared an item: ${item.title}`,
          updatedAt: serverTimestamp()
        });
        
        await addDoc(collection(db, 'notifications'), {
          userId: item.ownerId,
          actorId: user.uid,
          type: 'ITEM_BRIDGED',
          content: `Your ${item.type.toLowerCase()} was shared with ${bridgeTarget.targetName}!`,
          isRead: false,
          createdAt: serverTimestamp()
        });
      }

      onBridged();
      setBridgeTarget(null);
    } catch (err) {
      console.error(`Failed to share with ${bridgeTarget.type.toLowerCase()}:`, err);
      showToast('Failed to share: ' + (err as Error).message, 'warning');
    } finally {
      setBridgingId(null);
    }
  };

  const handleExternalShare = async () => {
    const shareText = `Check out this ${item.type.toLowerCase()} on KULA: ${item.title}\n\n"${item.description}"`;
    const shareUrl = window.location.origin + `/discovery?item=${item.id}`;

    if (isNative()) {
      /**
       * NATIVE PATH (iOS / Android):
       * Uses @capacitor/share which opens the native iOS Share Sheet.
       * This gives users access to AirDrop, iMessage, WhatsApp, Instagram,
       * and every other app that supports the iOS share extension system.
       */
      try {
        await Share.share({
          title: item.title,
          text: shareText,
          url: shareUrl,
          dialogTitle: 'Share this with a neighbor',
        });
      } catch (err) {
        // User cancelled the share sheet — this is normal, not an error
        if ((err as Error).message !== 'Share cancelled') {
          console.error('Native share failed', err);
        }
      }
    } else if (navigator.share) {
      /**
       * WEB PATH (Modern browsers with Web Share API):
       */
      try {
        await navigator.share({ title: item.title, text: shareText, url: shareUrl });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed', err);
        }
      }
    } else {
      /**
       * FALLBACK (Older browsers without Web Share API):
       * Copies the share text + URL to the clipboard.
       */
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        showToast('Link copied to clipboard!', 'success');
      } catch (err) {
        console.error('Copy failed', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center px-4 pb-4 sm:pb-20">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-[1001]"
      >
        <div className="p-6 sm:p-8 border-b border-stone-100 flex items-center justify-between flex-none">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="serif text-xl sm:text-2xl font-bold text-stone-900 leading-none">Share</h3>
              <p className="text-stone-400 text-[10px] sm:text-xs mt-1 font-medium uppercase tracking-widest">Connect neighbors & needs</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400">Sharing</span>
            <div className="flex items-center gap-3 mt-2">
              {item.images?.[0] ? (
                <img src={item.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-10 h-10 bg-stone-200 rounded-lg flex items-center justify-center">
                  <Tag size={16} className="text-stone-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-900 truncate text-sm sm:text-base">{item.title}</p>
                <p className="text-[9px] sm:text-[10px] text-stone-500">By {item.ownerName || 'Neighbor'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 size={24} className="animate-spin text-stone-300" />
              </div>
            ) : (
              <>
                {/* External Share Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-900">External Share</h4>
                  </div>
                  <button
                    onClick={handleExternalShare}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Share2 size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-indigo-900 text-sm">Share outside KULA</p>
                      <p className="text-[9px] sm:text-[10px] text-indigo-400 font-medium">Text a friend, WhatsApp, or Link</p>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-indigo-100 flex items-center justify-center text-indigo-300">
                      <Copy size={14} />
                    </div>
                  </button>
                </div>

                {/* Connections Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-900">Forward to Connection</h4>
                  </div>
                  
                  {connections.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-4 flex-nowrap snap-x snap-mandatory min-h-[120px] no-scrollbar">
                      {connections.map(conn => (
                        <button
                          key={conn.chatId}
                          disabled={!!bridgingId}
                          onClick={() => handleBridgeToConnection(conn.chatId, conn.userId, conn.name)}
                          className="flex flex-col items-center gap-2 p-3 min-w-[90px] rounded-2xl border border-stone-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group shrink-0 snap-start"
                        >
                          <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 overflow-hidden relative">
                            {conn.photoURL ? (
                              <img src={conn.photoURL} alt={conn.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold text-sm">
                                {conn.name.charAt(0)}
                              </div>
                            )}
                            {bridgingId === conn.chatId ? (
                              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin text-indigo-500" />
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center">
                                <Send size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-stone-600 truncate w-full text-center">{conn.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-stone-50 rounded-2xl border border-stone-100">
                      <p className="text-xs text-stone-500 italic">No active connections yet. Start swiping to meet neighbors!</p>
                    </div>
                  )}
                </div>

                {/* Circles Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-stone-900">Forward to Circle</h4>
                  </div>
                  
                  {circles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {circles.map(circle => (
                        <button
                          key={circle.id}
                          disabled={!!bridgingId}
                          onClick={() => handleBridgeToCircle(circle.id, circle.name)}
                          className="flex items-center gap-4 p-3 sm:p-4 rounded-2xl border border-stone-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group"
                        >
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            <Users size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-stone-900 text-sm">{circle.name}</p>
                            <p className="text-[9px] sm:text-[10px] text-stone-400 font-medium mt-0.5">{circle.memberCount || 0} Members</p>
                          </div>
                          {bridgingId === circle.id ? (
                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                          ) : (
                            <Send size={16} className="text-stone-300 group-hover:text-indigo-500 transition-colors" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <p className="text-xs text-stone-500 italic">You aren't in any circles yet. Join one to share needs!</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-100 mt-auto">
          <p className="text-[9px] sm:text-[10px] text-stone-400 text-center font-medium leading-relaxed italic">
            "Sharing connects the right people to the right help."
          </p>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {bridgeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] overflow-hidden w-full max-w-md shadow-2xl relative z-[1101]"
            >
              <button onClick={() => setBridgeTarget(null)} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors z-10">
                 <X size={16} />
              </button>
              
              <div className="p-6 pb-2 mt-2">
                 <h3 className="text-xl font-bold font-display text-stone-900 mb-1">Send to {bridgeTarget.targetName}</h3>
                 <p className="text-sm text-stone-500">Add a personal message before sharing this {item.type.toLowerCase()}</p>
              </div>
              
              <div className="p-6 space-y-4">
                 <div className="flex gap-3 p-3 bg-stone-50 border border-stone-100 rounded-2xl items-center">
                   {item.images?.[0] ? (
                     <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                       <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                     </div>
                   ) : (
                     <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center shrink-0">
                       <Tag size={16} className="text-stone-400" />
                     </div>
                   )}
                   <div className="flex-1 min-w-0">
                     <p className="font-bold text-stone-900 truncate text-sm">{item.title}</p>
                     <p className="text-[10px] text-stone-500 truncate">{item.description}</p>
                   </div>
                 </div>

                 <textarea
                   value={bridgeMessage}
                   onChange={(e) => setBridgeMessage(e.target.value)}
                   className="w-full rounded-2xl border border-stone-200 p-4 min-h-[100px] text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                   placeholder="Add a message..."
                 />
              </div>

              <div className="p-6 pt-0 flex gap-3">
                 <button onClick={() => setBridgeTarget(null)} className="flex-1 py-3 px-4 bg-stone-100 text-stone-700 font-bold rounded-2xl hover:bg-stone-200 transition-colors">Cancel</button>
                 <button 
                   onClick={executeBridge}
                   disabled={!!bridgingId}
                   className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {bridgingId ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                   Confirm Send
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
