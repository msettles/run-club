import { Modal } from './Modal';
import React from 'react';
import { X, CheckCircle, Sparkles } from 'lucide-react';

interface FirebaseSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  isConfigured: boolean;
}

export const FirebaseSetupGuide: React.FC<FirebaseSetupGuideProps> = ({ isOpen, onClose, isConfigured }) => {
  if (!isOpen) return null;

  return (
    <Modal title="App setup guide" onClose={onClose} className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
        <div className="bg-woodland-800 text-white p-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base">App setup and help</h3>
            <p className="text-xs text-woodland-100">Woodland Woodchuckers Run Club</p>
          </div>
          <button aria-label="Close window" onClick={onClose} className="p-1 rounded-full text-woodland-100 hover:text-white hover:bg-woodland-600/50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm text-stone-700 leading-relaxed">
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${isConfigured ? 'bg-woodland-50 border-woodland-200 text-woodland-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            {isConfigured ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />}
            <div>
              <p className="font-bold">{isConfigured ? 'Connected to Firebase' : 'Local demonstration mode'}</p>
              <p className="mt-1">{isConfigured ? 'Confirmed saves use the configured club project. Members do not need to set up Firebase.' : 'Sample data is stored in this browser. This is separate from the live club, its accounts and its attendance records.'}</p>
            </div>
          </div>

          <section className="space-y-2">
            <h4 className="font-bold text-stone-900">Get started as a runner</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Join or sign in with Google or an email link, then complete your profile. Use the same email each time.</li>
              <li>Find a run and RSVP. At the event, choose Check In, enter the announced code word and confirm your route, loops and activity.</li>
              <li>Check-in opens two hours before the start and closes at midnight Pacific. Wait for save confirmation; RSVP alone does not record attendance.</li>
              <li>Open your profile menu for My Runs, Claim historical runs and Edit profile.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-stone-900">Install, notifications and updates</h4>
            <p>On iPhone/iPad, open the site in Safari and choose Share → Add to Home Screen. On Android, use Install app or the browser menu.</p>
            <p>Enable Alerts registers this device for notifications. On iPhone, use the installed Home Screen app. In-app announcements are separate from phone pushes; automatic run reminders are not available.</p>
            <p>For an old or stuck version, finish any unsaved work, open the version button, then choose Check for Updates &amp; Refresh App. Changes such as check-in need a confirmed online save.</p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-stone-900">Organizers and admins</h4>
            <p>Staff actions appear under Organizer tools. Run Night / Table Mode provides attendance, gear pickup and assisted check-in within the normal window. Admin Portal is available to admins only.</p>
            <p>Run sharing is available now. Instagram/Facebook publishing is awaiting account access and service activation.</p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-stone-900">Setting up a separate club</h4>
            <p>Deployment setup is for maintainers. Use the repository instructions for authentication, production security rules, hosting and server functions. The calendar and assisted-check-in functions require a billing-enabled Firebase project for production deployment; the app cannot determine your billing plan here.</p>
            <p>Core services have no-cost quotas, but the app does not guarantee zero cost. Maps use Leaflet and OpenStreetMap; route processing runs in the browser. Do not recreate or reset the existing club project to follow a setup guide.</p>
          </section>

          <a href="https://msettles.github.io/run-club/help/" target="_blank" rel="noopener noreferrer" className="inline-block font-bold text-woodland-800 underline underline-offset-4">Open full help and setup documentation</a>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-woodland-600 text-white rounded-lg hover:bg-woodland-700 transition">Got It!</button>
        </div>
      </div>
    </Modal>
  );
};
