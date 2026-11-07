import React from 'react';
import { X, CheckCircle, ShieldCheck, Zap, Sparkles } from 'lucide-react';

interface FirebaseSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

export const FirebaseSetupGuide: React.FC<FirebaseSetupGuideProps> = ({
  isOpen,
  onClose,
  isConfigured,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-woodland-800 to-woodland-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌱</span>
            <div>
              <h3 className="font-bold text-base leading-tight">100% Free & Zero-Credit-Card Setup</h3>
              <p className="text-xs text-woodland-100">Woodland Woodchuckers Run Club Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-woodland-100 hover:text-white hover:bg-woodland-600/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-stone-700 leading-relaxed">
          {/* Status Alert */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isConfigured
                ? 'bg-woodland-50 border-woodland-200 text-woodland-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {isConfigured ? (
              <CheckCircle className="w-5 h-5 text-woodland-600 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">
                {isConfigured
                  ? 'Connected to Live Firebase Spark Plan'
                  : 'Currently Running in Local-First Mode'}
              </div>
              <p className="mt-0.5 text-xs">
                {isConfigured
                  ? 'Your runs, routes, and check-ins are synced with your free Cloud Firestore database.'
                  : 'All runs, GPX routes, member check-ins, and badges are fully functional right now using browser local storage. No accounts or credit cards required!'}
              </p>
            </div>
          </div>

          {/* Zero-Cost Breakdown */}
          <div>
            <h4 className="font-bold text-stone-900 text-sm mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-woodland-600" />
              How this app stays 100% free with NO credit card:
            </h4>
            <div className="space-y-2">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-stone-900 block">1. OpenStreetMap & Leaflet (Free Maps)</strong>
                <span>
                  Uses open-source map tiles. Unlike Google Maps or Mapbox, there are no monthly fees, no API keys, and no billing accounts needed.
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-stone-900 block">2. In-Browser GPX Parsing</strong>
                <span>
                  GPX tracks and elevation profiles are calculated directly inside the browser using standard XML DOM parsing and the Haversine formula. Zero server costs!
                </span>
              </div>
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-stone-900 block">3. Firebase Spark Plan (Cloud Sync)</strong>
                <span>
                  The Spark Plan is Google Firebase's free tier. It never asks for a credit card and provides:
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-stone-600">
                    <li>Cloud Firestore: 50,000 reads & 20,000 writes every day</li>
                    <li>Firebase Hosting: 10GB storage & 360MB/day bandwidth with free SSL</li>
                    <li>Firebase Auth: Email & anonymous logins</li>
                  </ul>
                </span>
              </div>
            </div>
          </div>

          {/* Connect Firebase Spark Instructions */}
          <div>
            <h4 className="font-bold text-stone-900 text-sm mb-2 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600" />
              Want to connect live Cloud Firestore? (3 Minutes)
            </h4>
            <ol className="list-decimal list-inside space-y-2 bg-stone-50 p-4 rounded-xl border border-stone-200">
              <li>
                Visit{' '}
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-woodland-700 underline font-semibold"
                >
                  console.firebase.google.com
                </a>{' '}
                and click <strong>Add project</strong>.
              </li>
              <li>
                Choose a project name (e.g. <code className="bg-stone-200 px-1 rounded">woodland-woodchuckers</code>). Select the default <strong>Spark (No-cost)</strong> plan.
              </li>
              <li>
                Click the <strong>Web (&lt;/&gt;)</strong> icon to register a web app and copy your Firebase config values.
              </li>
              <li>
                Create a file named <code className="bg-stone-200 px-1 rounded">.env</code> in this project folder:
                <pre className="mt-1.5 p-2 bg-stone-900 text-woodland-400 rounded-lg text-[10px] overflow-x-auto">
{`VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=woodland-woodchuckers.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=woodland-woodchuckers
VITE_FIREBASE_STORAGE_BUCKET=woodland-woodchuckers.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef`}
                </pre>
              </li>
              <li>
                Under <strong>Build &gt; Firestore Database</strong>, click <strong>Create database</strong> in test mode. That's it!
              </li>
            </ol>
          </div>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-woodland-600 text-white rounded-lg hover:bg-woodland-700 transition"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
};
