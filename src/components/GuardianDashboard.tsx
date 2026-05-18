/**
 * FILE: GuardianDashboard.tsx
 * ROLE IN KULA: The "Dev Diagnostic Console" — a friendly status dashboard for developers.
 * 
 * CONNECTION TO useAuth.tsx:
 *   This component is shown when the user activates "Guardian Mode" in useAuth.tsx
 *   (the dev-only bypass that auto-creates a test profile without real Google login).
 *   It's accessible via App.tsx when the 'guardian' tab is active.
 * 
 * WHAT IT DOES:
 *   Simulates a "Neighborhood Guardian" persona that "walks through" the app
 *   and reports on the health of each feature. Currently uses MOCK data —
 *   the logs are hardcoded and delayed to simulate real-time checks.
 * 
 * FUTURE: These checks should become real:
 *   - Actually test Firestore connectivity
 *   - Count active items and users
 *   - Verify auth state
 *   - Check for stale data
 * 
 * ENVIRONMENT DETECTION:
 *   `window.location.hostname !== 'localhost'` determines if running on cloud or local.
 *   This changes the badge color and label (Cloud Instance vs Local Environment).
 * 
 * NOTE: Uses framer-motion (not motion/react) — this is a legacy import that
 * should be unified with the rest of the app's motion/react imports.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle2, AlertCircle, Heart, Map as MapIcon, MessageSquare, PlusCircle } from 'lucide-react';

interface GuardianLog {
  id: string;
  message: string;
  status: 'success' | 'warning' | 'error' | 'info';
  timestamp: Date;
}

export default function GuardianDashboard() {
  const [logs, setLogs] = useState<GuardianLog[]>([]);
  const [health, setHealth] = useState(100);
  const isCloud = window.location.hostname !== 'localhost';

  useEffect(() => {
    // Mocking the "Guardian persona" logs
    const initialLogs: GuardianLog[] = [
      {
        id: '1',
        message: 'The Neighborhood Guardian is waking up...',
        status: 'info',
        timestamp: new Date(Date.now() - 5000)
      },
      {
        id: '2',
        message: 'Checking the local soil quality (Database connectivity)...',
        status: 'success',
        timestamp: new Date(Date.now() - 4000)
      },
      {
        id: '3',
        message: 'Ensuring the community garden gates are open (Auth bypass)...',
        status: 'success',
        timestamp: new Date(Date.now() - 3000)
      }
    ];
    setLogs(initialLogs);

    // Simulate real-time checks
    const timer = setTimeout(() => {
      setLogs(prev => [
        ...prev,
        {
          id: '4',
          message: 'Walking through the Explore feed... everything looks vibrant!',
          status: 'success',
          timestamp: new Date()
        },
        {
          id: '5',
          message: 'Inspecting public profiles... trust mosaics are shining bright.',
          status: 'success',
          timestamp: new Date()
        },
        {
          id: '6',
          message: 'Testing circle exits and item deletions... boundaries are being respected.',
          status: 'success',
          timestamp: new Date()
        }
      ]);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-full bg-stone-50 p-6 overflow-y-auto">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className={`w-8 h-8 ${isCloud ? 'text-indigo-600' : 'text-emerald-700'}`} />
            <h1 className="text-3xl font-bold text-stone-800">Neighborhood Guardian</h1>
          </div>
          <p className="text-stone-600 italic">"Watching over KULA to keep our community connected."</p>
        </div>
        
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${
          isCloud 
            ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
        }`}>
          {isCloud ? 'Cloud Instance' : 'Local Environment'}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Neighborhood Health Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 flex flex-col justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold text-stone-700 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Neighborhood Health
            </h2>
            <div className="text-5xl font-bold text-emerald-600 mb-2">{health}%</div>
            <p className="text-sm text-stone-500">All features are rooted and growing well.</p>
          </div>
          <div className="mt-6 w-full bg-stone-100 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${health}%` }}
              className="bg-emerald-500 h-full"
            />
          </div>
        </motion.div>

        {/* Quick Stats Bento */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
            <MapIcon className="w-6 h-6 text-stone-400 mb-2" />
            <div className="text-xl font-bold text-stone-800">Explore</div>
            <div className="text-xs text-emerald-600 font-medium">Active</div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
            <MessageSquare className="w-6 h-6 text-stone-400 mb-2" />
            <div className="text-xl font-bold text-stone-800">Chat</div>
            <div className="text-xs text-emerald-600 font-medium">Synced</div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
            <PlusCircle className="w-6 h-6 text-stone-400 mb-2" />
            <div className="text-xl font-bold text-stone-800">Actions</div>
            <div className="text-xs text-emerald-600 font-medium">Verified</div>
          </div>
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
            <Shield className="w-6 h-6 text-stone-400 mb-2" />
            <div className="text-xl font-bold text-stone-800">Privacy</div>
            <div className="text-xs text-emerald-600 font-medium">Secure</div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-stone-700 mb-4">Guardian Logs</h2>
        <div className="space-y-3">
          {logs.slice().reverse().map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-2xl flex items-start gap-3 ${
                log.status === 'success' ? 'bg-emerald-50 border border-emerald-100' :
                log.status === 'warning' ? 'bg-amber-50 border border-amber-100' :
                log.status === 'error' ? 'bg-rose-50 border border-rose-100' :
                'bg-white border border-stone-100'
              }`}
            >
              {log.status === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />}
              {log.status === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
              {log.status === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />}
              {log.status === 'info' && <Shield className="w-5 h-5 text-stone-400 mt-0.5" />}
              
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  log.status === 'success' ? 'text-emerald-900' :
                  log.status === 'warning' ? 'text-amber-900' :
                  log.status === 'error' ? 'text-rose-900' :
                  'text-stone-800'
                }`}>
                  {log.message}
                </p>
                <p className="text-[10px] text-stone-400 mt-1">
                  {log.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="mt-auto pt-8 text-center text-xs text-stone-400">
        KULA Neighborhood Guardian v1.1 • {isCloud ? 'Firebase Instance' : 'Local Host'}
      </footer>
    </div>
  );
}
