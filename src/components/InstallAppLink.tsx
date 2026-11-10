import { Modal } from './Modal';
import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { promptInstall, useInstallState } from '../services/install';

/**
 * Low-key "Install app" link (page footer). Always available, unlike the top
 * banner, and hidden once the app is installed. Uses the browser's install
 * prompt when it offers one; otherwise shows how to install by hand.
 */
export const InstallAppLink: React.FC = () => {
  const { installed, isIOS } = useInstallState();
  const [showSteps, setShowSteps] = useState(false);

  if (installed) return null;

  const handleClick = async () => {
    const result = await promptInstall();
    if (result === 'unavailable') setShowSteps(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="text-woodland-700 hover:text-woodland-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install app</span>
      </button>

      {showSteps && (
        <Modal title="Install Woodchuckers" onClose={() => setShowSteps(false)}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/70 p-4"
        >
          <div className="bg-white text-stone-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h4 id="install-steps-title" className="font-bold text-base">
                📲 Install Woodchuckers
              </h4>
              <button type="button" onClick={() => setShowSteps(false)} aria-label="Close" className="text-stone-400 hover:text-stone-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {isIOS ? (
              <ol className="text-xs text-stone-600 space-y-2.5 list-decimal list-inside bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <li>In Safari, tap the <strong>Share</strong> button (the square with an arrow pointing up).</li>
                <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                <li>Tap <strong>&quot;Add&quot;</strong> in the top-right corner.</li>
              </ol>
            ) : (
              <ul className="text-xs text-stone-600 space-y-2.5 list-disc list-inside bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <li>
                  <strong>Android (Chrome):</strong> tap the <strong>⋮</strong> menu, then <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                </li>
                <li>
                  <strong>Computer (Chrome / Edge):</strong> click the install icon at the right end of the address bar, or the browser menu →{' '}
                  <strong>Install Woodchuckers</strong>.
                </li>
                <li>
                  <strong>Other browsers:</strong> open this site in Chrome, Edge or (on iPhone) Safari to install it.
                </li>
              </ul>
            )}
            <button
              type="button"
              onClick={() => setShowSteps(false)}
              className="w-full py-2 bg-woodland-600 text-white rounded-xl font-bold text-xs hover:bg-woodland-700 transition"
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};
