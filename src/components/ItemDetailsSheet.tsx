/**
 * FILE: ItemDetailsSheet.tsx
 * ROLE IN KULA: The "Item Inspection Panel" — full-screen detail view for any item.
 * 
 * CIRCUIT B (Neighborhood Pulse):
 *   When a user taps an item in Discovery.tsx, Feed.tsx, or PublicProfile.tsx,
 *   this bottom-sheet slides up to show the full item details + a comment thread.
 * 
 * CONTENT SECTIONS:
 *   1. HERO IMAGE: Full-width with fallback from artDirection.ts
 *   2. TYPE/CATEGORY BADGES: Color-coded chips (SHARE=green, ASK=blue, etc.)
 *   3. TITLE + RADAR BUTTONS: Quick-add the item's category to lookout/standby
 *   4. DESCRIPTION CARD: Full text + owner info with ConnectionBadge (trust degree)
 *   5. TEMPORAL DATA: expiresAt, eventTime, eventEndTime (if present)
 *   6. "Bridge to Profile" BUTTON: Opens owner's PublicProfile.tsx
 *   7. COMMENTS THREAD: Real-time via onSnapshot on items/{id}/comments
 *      - Top-level comments
 *      - Nested replies (single level, parentId-based)
 * 
 * OWNER ACTIONS:
 *   If the current user owns the item, a "Delete Item" button appears in the header.
 *   Deleting sets status → DELETED (soft delete, preserving data for audits).
 * 
 * DATA FLOW:
 *   READS: items/{itemId}/comments (onSnapshot, ordered by createdAt)
 *   WRITES: items/{itemId}/comments (addDoc with userId, userName, text, parentId)
 *   WRITES: users/{uid}.lookoutRules or standbyRules (radar quick-add)
 * 
 * CALLED BY: Discovery.tsx, Feed.tsx, PublicProfile.tsx, Profile.tsx
 */
import React, { useState, useEffect } from 'react';
import { Item } from '../types';
import { X, Send, Network, MessageCircle, MapPin, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { getFallbackImage } from '../lib/artDirection';
import { OwnerName } from './OwnerName';
import ConnectionBadge from './ConnectionBadge';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
  parentId?: string;
}

interface ItemDetailsSheetProps {
  item: Item;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
}

export function ItemDetailsSheet({ item, onClose, onViewProfile }: ItemDetailsSheetProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToRadar, setAddingToRadar] = useState(false);
  const [radarResponse, setRadarResponse] = useState<'success' | ''>('');

  const onAddToLookout = async (term: string) => {
    if (!user || !profile || !term) return;
    setAddingToRadar(true);
    try {
      const currentLookoutRules = profile.lookoutRules || [];
      if (!currentLookoutRules.find(r => r.keyword === term)) {
        await updateDoc(doc(db, 'users', user.uid), {
          lookoutRules: [...currentLookoutRules, { 
            id: Math.random().toString(36).substring(7), 
            keyword: term, 
            type: 'ALL', 
            reachTypes: ['VICINITY'], 
            radius: 5,
            privacy: 'PUBLIC'
          }].slice(0, 20)
        });
      }
      setRadarResponse('success');
      setTimeout(() => setRadarResponse(''), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingToRadar(false);
    }
  };

  const onAddToStandby = async (term: string) => {
    if (!user || !profile || !term) return;
    setAddingToRadar(true);
    try {
      const currentStandbyRules = profile.standbyRules || [];
      if (!currentStandbyRules.find(r => r.keyword === term)) {
        await updateDoc(doc(db, 'users', user.uid), {
          standbyRules: [...currentStandbyRules, { 
            id: Math.random().toString(36).substring(7), 
            keyword: term, 
            reachTypes: ['VICINITY'], 
            radius: 5,
            privacy: 'PUBLIC'
          }].slice(0, 20)
        });
      }
      setRadarResponse('success');
      setTimeout(() => setRadarResponse(''), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingToRadar(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'items', item.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'items/*/comments');
    });

    return () => unsub();
  }, [item.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !profile) return;

    try {
      await addDoc(collection(db, 'items', item.id, 'comments'), {
        userId: user.uid,
        userName: profile.displayName || 'Neighbor',
        text: newComment.trim(),
        parentId: replyTo?.id || null,
        createdAt: serverTimestamp()
      });
      setNewComment('');
      setReplyTo(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'items/*/comments');
    }
  };

  const mainComments = comments.filter(c => !c.parentId);
  const replies = comments.filter(c => c.parentId);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-t-[2.5rem] h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
        <div className="flex-none p-4 px-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10 rounded-t-[2.5rem]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="serif text-xl font-bold text-stone-900 leading-none">Discussion</h3>
              <p className="text-xs text-stone-500 mt-1">Join the conversation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.uid === item.ownerId && (
              <button 
                onClick={async () => {
                  if (window.confirm("Are you sure you want to remove this item from the neighborhood?")) {
                    try {
                      await updateDoc(doc(db, 'items', item.id), { status: 'DELETED' });
                      onClose();
                    } catch (err) {
                      console.error("Error deleting item:", err);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
              >
                Delete Item
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="p-6">
            {/* Item Details */}
            <div className="mb-8">
              <div className="w-full h-48 sm:h-64 rounded-3xl overflow-hidden mb-6 shadow-md border border-stone-100">
                  {item.images && item.images.length > 0 ? (
                    <img referrerPolicy="no-referrer" src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <img src={getFallbackImage(item.category)} alt={item.category || item.type} className="w-full h-full object-cover opacity-90" />
                  )}
              </div>
            
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest label-transition ${
                  item.type === 'SHARE' ? 'bg-green-100 text-green-700' : 
                  item.type === 'ASK' ? 'bg-blue-100 text-blue-700' : 
                  item.type === 'IMECE' ? 'bg-amber-100 text-amber-700' :
                  item.type === 'JOIN' ? 'bg-teal-100 text-teal-700' :
                  'bg-stone-100 text-stone-600'
                }`}>
                  {item.type}
                </span>
                {item.category && (
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest label-transition">
                    {item.category}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-2 mb-4">
                <h1 className="serif text-3xl font-bold text-stone-900 leading-tight">{item.title}</h1>
                
                {item.category && item.ownerId !== user?.uid && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAddToLookout(item.category!)}
                      disabled={addingToRadar || radarResponse === 'success' || (profile?.lookoutRules || []).some(r => r.keyword === item.category)}
                      className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      {radarResponse === 'success' ? 'Added' : (profile?.lookoutRules || []).some(r => r.keyword === item.category) ? 'On your lookout radar' : `+ Add "${item.category}" to Lookouts`}
                    </button>
                    <button
                      onClick={() => onAddToStandby(item.category!)}
                      disabled={addingToRadar || radarResponse === 'success' || (profile?.standbyRules || []).some(r => r.keyword === item.category)}
                      className="text-[10px] font-bold uppercase tracking-widest text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full hover:bg-purple-100 disabled:opacity-50 transition-colors"
                    >
                      {radarResponse === 'success' ? 'Added' : (profile?.standbyRules || []).some(r => r.keyword === item.category) ? 'On your standby radar' : `+ Add "${item.category}" to Standbys`}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="bg-stone-50 p-5 rounded-3xl border border-stone-100 mb-6 relative hover:shadow-md transition-shadow">
                <p className="text-sm md:text-base text-stone-700 leading-relaxed">{item.description}</p>
                <div className="mt-4 pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
                  <button 
                    onClick={() => onViewProfile(item.ownerId)}
                    className="flex items-center gap-2 hover:text-indigo-600 transition-colors group/name"
                  >
                    <div className="w-6 h-6 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 group-hover/name:ring-2 group-hover/name:ring-indigo-100 transition-all">
                       {item.ownerPhoto ? (
                         <img src={item.ownerPhoto} alt="Owner" className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold uppercase">
                           {item.ownerName ? item.ownerName.charAt(0) : '?'}
                         </div>
                       )}
                    </div>
                    <span className="text-xs font-bold text-stone-600 group-hover/name:text-indigo-600 underline-offset-4 decoration-2">
                      <OwnerName ownerId={item.ownerId} initialName={item.ownerName} className="group-hover/name:underline" />
                    </span>
                    <ConnectionBadge targetUserId={item.ownerId} className="ml-2" />
                  </button>
                  {item.createdAt && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                      <Calendar size={12} />
                      <span>{formatDistanceToNow(typeof item.createdAt?.toDate === 'function' ? item.createdAt.toDate() : item.createdAt, { addSuffix: true })}</span>
                    </div>
                  )}
                </div>

                {/* Temporal Elements */}
                {(item.expiresAt || item.eventTime) && (
                  <div className="mt-4 pt-4 border-t border-stone-200 flex flex-col gap-2">
                    {item.expiresAt && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                        <Calendar size={14} />
                        Available until: {new Date(typeof item.expiresAt?.toDate === 'function' ? item.expiresAt.toDate() : item.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                    {item.eventTime && (
                      <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
                        <Calendar size={14} />
                        <span>
                          Starts: {new Date(typeof item.eventTime?.toDate === 'function' ? item.eventTime.toDate() : item.eventTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {item.eventEndTime && (
                      <div className="flex items-center gap-2 text-sm text-stone-500 font-medium ml-5">
                        <span>
                          Ends: {new Date(typeof item.eventEndTime?.toDate === 'function' ? item.eventEndTime.toDate() : item.eventEndTime).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => onViewProfile(item.ownerId)}
                className="w-full py-4 bg-stone-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-stone-800 transition-all active:scale-95 group"
              >
                <Network size={16} className="group-hover:rotate-12 transition-transform" />
                Bridge to Profile
              </button>
            </div>

            <div className="w-full h-px bg-stone-100 mb-8" />

            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-stone-400">Discussion</h4>
              <span className="text-xs font-bold text-stone-400 bg-stone-100 px-2 py-1 rounded-full">{comments.length}</span>
            </div>

            {/* Comments List */}
            <div className="flex flex-col gap-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 opacity-50">
                  <div className="animate-pulse w-8 h-8 rounded-full bg-stone-200 mb-3" />
                  <p className="text-stone-400 text-sm italic">Loading comments...</p>
                </div>
              ) : mainComments.length === 0 ? (
                <div className="bg-stone-50 rounded-3xl p-8 text-center border-2 border-dashed border-stone-200">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-400 mx-auto flex items-center justify-center mb-3">
                    <MessageCircle size={20} />
                  </div>
                  <p className="text-stone-500 text-sm font-medium">No comments yet</p>
                  <p className="text-stone-400 text-xs mt-1">Be the first to start the conversation!</p>
                </div>
              ) : (
                mainComments.map(c => (
                  <div key={c.id} className="flex flex-col gap-3">
                    <div className="group flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 flex-shrink-0 border border-stone-200 shadow-sm">
                        <span className="text-xs font-bold uppercase">{c.userName.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between mb-1">
                          <button 
                            onClick={() => onViewProfile(c.userId)}
                            className="text-sm font-bold text-stone-900 hover:text-indigo-600 hover:underline decoration-2 underline-offset-2 transition-all"
                          >
                            {c.userName}
                          </button>
                          {c.createdAt && (
                            <span className="text-[10px] text-stone-400 font-medium">
                              {formatDistanceToNow(typeof c.createdAt?.toDate === 'function' ? c.createdAt.toDate() : c.createdAt, { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <div className="bg-stone-50 p-4 rounded-2xl rounded-tl-none border border-stone-100 text-sm text-stone-700 leading-relaxed shadow-sm">
                          {c.text}
                        </div>
                        <button 
                          onClick={() => setReplyTo(c)}
                          className="mt-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-indigo-600 transition-colors px-2"
                        >
                          Reply
                        </button>
                      </div>
                    </div>

                    {replies.filter(r => r.parentId === c.id).map(r => (
                      <div key={r.id} className="flex gap-4 ml-10">
                        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 flex-shrink-0 border border-stone-100 shadow-sm">
                          <span className="text-[10px] font-bold uppercase">{r.userName.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between mb-1">
                            <button 
                              onClick={() => onViewProfile(r.userId)}
                              className="text-xs font-bold text-stone-900 hover:text-indigo-600 hover:underline decoration-2 underline-offset-2 transition-all"
                            >
                              {r.userName}
                            </button>
                            {r.createdAt && (
                              <span className="text-[9px] text-stone-400 font-medium">
                                {formatDistanceToNow(typeof r.createdAt?.toDate === 'function' ? r.createdAt.toDate() : r.createdAt, { addSuffix: true })}
                              </span>
                            )}
                          </div>
                          <div className="bg-stone-100/50 p-3 rounded-2xl rounded-tl-none border border-stone-50 text-xs text-stone-600 leading-relaxed">
                            {r.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Comment Input */}
        <div className="flex-none p-4 pb-12 md:pb-6 border-t border-stone-100 bg-white">
          {replyTo && (
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 rounded-t-xl border-x border-t border-indigo-100 -mb-px mx-auto max-w-2xl">
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                Replying to <span className="text-indigo-800">{replyTo.userName}</span>
              </p>
              <button onClick={() => setReplyTo(null)} className="text-indigo-400 hover:text-indigo-600">
                <X size={14} />
              </button>
            </div>
          )}
          <form onSubmit={handlePostComment} className="flex items-end gap-2 max-w-2xl mx-auto">
            <div className={`flex-1 bg-stone-50 border border-stone-200 focus-within:border-indigo-300 focus-within:bg-white px-4 py-2 transition-all shadow-sm flex items-center ${replyTo ? 'rounded-b-2xl rounded-tr-2xl' : 'rounded-2xl'}`}>
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
                className="flex-1 bg-transparent border-transparent focus:border-transparent focus:ring-0 px-0 py-2 text-sm text-stone-800 placeholder-stone-400 min-w-0"
              />
            </div>
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="h-12 w-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all active:scale-95 shadow-md hover:bg-indigo-700 disabled:hover:bg-indigo-600 disabled:shadow-none"
            >
              <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

