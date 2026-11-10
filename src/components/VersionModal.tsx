import { Modal } from './Modal';
import React, { useState } from 'react';
import { X, RefreshCw, CheckCircle2, GitCommit, Calendar, Tag } from 'lucide-react';
import { VERSION_LABEL, COMMIT_HASH, BUILD_TIME, forceAppUpdate } from '../utils/version';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose }) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    await forceAppUpdate();
  };

  const handleCopyCommit = () => {
    navigator.clipboard.writeText(COMMIT_HASH);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="App version" onClose={onClose} className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 relative overflow-hidden space-y-5 animate-in zoom-in-95 duration-200">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-woodland-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-woodchuck-500 to-amber-600 p-1 flex items-center justify-center shadow-md border border-amber-300/80">
              <img
                src="/Woodchucker2026.png"
                alt="Woodchuck Mascot"
                className="w-full h-full object-contain filter drop-shadow-xs"
              />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 font-display text-base">Woodchuckers App</h3>
              <p className="text-xs text-stone-500 font-medium">Build &amp; Version Information</p>
            </div>
          </div>
          <button aria-label="Close window"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Version Details Card */}
        <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200/60 font-sans">
            <span className="text-stone-500 flex items-center gap-1.5 font-medium">
              <Tag className="w-3.5 h-3.5 text-woodland-600" /> Release Version
            </span>
            <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded-md border border-stone-200 shadow-2xs">
              {VERSION_LABEL}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-stone-200/60 font-sans">
            <span className="text-stone-500 flex items-center gap-1.5 font-medium">
              <GitCommit className="w-3.5 h-3.5 text-amber-600" /> Git Commit
            </span>
            <button
              onClick={handleCopyCommit}
              title="Click to copy commit hash"
              className="font-mono font-bold text-woodland-700 hover:text-woodland-900 bg-white px-2 py-0.5 rounded-md border border-stone-200 shadow-2xs flex items-center gap-1 hover:border-woodland-400 transition"
            >
              <span>{COMMIT_HASH}</span>
              {copied && <span className="text-[10px] text-emerald-600">✓ copied</span>}
            </button>
          </div>

          <div className="flex items-center justify-between font-sans">
            <span className="text-stone-500 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Build Timestamp
            </span>
            <span className="font-mono font-semibold text-stone-800 text-[11px]">
              {BUILD_TIME}
            </span>
          </div>
        </div>

        {/* PWA Cache Status */}
        <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Latest Code Verification</p>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              If your screen matches this commit number, you are running the newest deployed build!
            </p>
          </div>
        </div>

        {/* Action Button: Check for updates and force reload */}
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-woodland-700 hover:bg-woodland-800 active:scale-98 text-white rounded-2xl font-bold text-xs transition shadow-md disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>{isUpdating ? 'Purging Cache & Reloading...' : 'Check for Updates & Refresh App'}</span>
        </button>
      </div>
    </Modal>
  );
};
