import React from 'react';
import { Member } from '../types';
import { Calendar, Map, Trophy, Plus, UploadCloud, Info, RefreshCw, Shield, Bell, Palette } from 'lucide-react';

interface NavbarProps {
  activeTab: 'runs' | 'routes' | 'leaderboard' | 'admin';
  setActiveTab: (tab: 'runs' | 'routes' | 'leaderboard' | 'admin') => void;
  currentMember: Member;
  isFirebaseConfigured: boolean;
  isSyncing: boolean;
  unreadNotifsCount?: number;
  onOpenNewRun: () => void;
  onOpenUploadGpx: () => void;
  onOpenSetupGuide: () => void;
  onOpenBrandAssets?: () => void;
  onToggleNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentMember,
  isFirebaseConfigured,
  isSyncing,
  unreadNotifsCount = 0,
  onOpenNewRun,
  onOpenUploadGpx,
  onOpenSetupGuide,
  onOpenBrandAssets,
  onToggleNotifications,
}) => {
  const isAdmin = currentMember.email === 'woodlandwoodchuckers@gmail.com' || currentMember.id === 'mem-admin';

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div
            onClick={() => setActiveTab('runs')}
            className="flex items-center gap-2.5 cursor-pointer select-none shrink-0 group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-woodland-700 via-woodland-800 to-woodland-950 flex items-center justify-center shadow-md p-1 border border-woodland-600/40 group-hover:scale-105 transition overflow-hidden">
              <img
                src="/Woodchucker2026.png"
                alt="Woodland Woodchuckers 2026 Mascot"
                className="w-full h-full object-contain filter drop-shadow-sm invert sm:invert-0 brightness-110"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-stone-900 tracking-wide text-base sm:text-lg uppercase">
                  Woodland Woodchuckers
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider bg-woodland-100 text-woodland-900 px-1.5 py-0.5 rounded border border-woodland-200">
                  Run Club
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-stone-500 font-medium">
                Blue Note Brewing Co. • Pounding trails &amp; pavement!
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop / Tablet) */}
          <nav className="hidden sm:flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('runs')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'runs'
                  ? 'bg-woodland-50 text-woodland-900 font-bold shadow-xs border border-woodland-200/60'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Calendar className="w-4 h-4 text-woodland-600" />
              <span>Runs</span>
            </button>

            <button
              onClick={() => setActiveTab('routes')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'routes'
                  ? 'bg-woodland-50 text-woodland-900 font-bold shadow-xs border border-woodland-200/60'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Map className="w-4 h-4 text-woodland-600" />
              <span>GPX Routes</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeTab === 'leaderboard'
                  ? 'bg-woodland-50 text-woodland-900 font-bold shadow-xs border border-woodland-200/60'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Members</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                  activeTab === 'admin'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-800 bg-stone-100 hover:bg-stone-200'
                }`}
              >
                <Shield className="w-4 h-4 text-woodland-400" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Club Brand Assets Modal Trigger */}
            {onOpenBrandAssets && (
              <button
                onClick={onOpenBrandAssets}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-woodland-800 bg-woodland-50 hover:bg-woodland-100 border border-woodland-200 rounded-xl transition shadow-2xs"
                title="View & Download Official Club Logos & Colors"
              >
                <Palette className="w-3.5 h-3.5 text-woodland-600" />
                <span>Logos</span>
              </button>
            )}

            {/* Notification Bell */}
            {onToggleNotifications && (
              <button
                onClick={onToggleNotifications}
                className="relative p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
                title="Club Announcements & Alerts"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                )}
              </button>
            )}

            {/* Firebase Status Pill */}
            <button
              onClick={onOpenSetupGuide}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                isFirebaseConfigured
                  ? 'bg-woodland-50 border-woodland-300 text-woodland-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
              title="Click for zero-credit-card setup guide"
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-woodland-600" />
              ) : isFirebaseConfigured ? (
                <span className="w-2 h-2 rounded-full bg-woodland-500 animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
              <span>{isFirebaseConfigured ? 'Firebase Spark' : 'Zero-Cost Local'}</span>
              <Info className="w-3 h-3 opacity-60" />
            </button>

            {/* Quick Actions */}
            <button
              onClick={onOpenUploadGpx}
              className="hidden xl:flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-xl transition shadow-xs"
              title="Upload GPX route"
            >
              <UploadCloud className="w-3.5 h-3.5 text-woodland-600" />
              <span>Add GPX</span>
            </button>

            <button
              onClick={onOpenNewRun}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-woodland-600 hover:bg-woodland-700 text-white rounded-xl transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule Run</span>
              <span className="sm:hidden">Run</span>
            </button>

            {/* Current Member avatar icon */}
            <button
              onClick={() => setActiveTab('leaderboard')}
              className="w-8 h-8 rounded-full overflow-hidden border-2 border-woodland-600 ring-2 ring-woodland-100 shrink-0 shadow-xs"
              title={`Logged in as ${currentMember.name}`}
            >
              {currentMember.avatarUrl ? (
                <img
                  src={currentMember.avatarUrl}
                  alt={currentMember.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-woodland-700 text-white flex items-center justify-center text-xs font-bold">
                  {currentMember.name.charAt(0)}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
