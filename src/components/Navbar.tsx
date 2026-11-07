import React, { useState } from 'react';
import { UserProfile } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  Calendar, 
  Map, 
  Trophy, 
  Plus, 
  UploadCloud, 
  Info, 
  RefreshCw, 
  Shield, 
  Bell, 
  Palette,
  LogIn,
  LogOut,
  Shirt,
  Flame,
  ChevronDown
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'runs' | 'routes' | 'leaderboard' | 'admin';
  setActiveTab: (tab: 'runs' | 'routes' | 'leaderboard' | 'admin') => void;
  currentUser: UserProfile;
  firebaseUser: FirebaseUser | null;
  isFirebaseConfigured: boolean;
  isSyncing: boolean;
  unreadNotifsCount?: number;
  onOpenNewRun: () => void;
  onOpenUploadGpx: () => void;
  onOpenSetupGuide: () => void;
  onOpenBrandAssets?: () => void;
  onToggleNotifications?: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  firebaseUser,
  isFirebaseConfigured,
  isSyncing,
  unreadNotifsCount = 0,
  onOpenNewRun,
  onOpenUploadGpx,
  onOpenSetupGuide,
  onOpenBrandAssets,
  onToggleNotifications,
  onOpenAuthModal,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const isAdmin = currentUser.role === 'admin' || currentUser.email === 'woodlandwoodchuckers@gmail.com';

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

          {/* Action Tools & User Profile / Login */}
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

            {/* USER LOGIN / PROFILE AREA */}
            {firebaseUser ? (
              /* LOGGED IN RUNNER PILL */
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 transition text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-woodland-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {currentUser.firstName?.[0] || firebaseUser.email?.[0]?.toUpperCase() || 'W'}
                  </div>
                  <div className="hidden sm:block">
                    <span className="block text-xs font-bold text-stone-900 leading-tight">
                      {currentUser.firstName || 'Runner'}
                    </span>
                    <span className="block text-[10px] text-amber-700 font-bold leading-none">
                      {currentUser.totalRuns} Runs
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 p-4 space-y-3 z-[100] animate-in fade-in duration-150">
                    <div className="border-b border-stone-100 pb-2">
                      <div className="font-bold text-stone-900 text-sm">{currentUser.displayName}</div>
                      <div className="text-xs text-stone-500 font-mono truncate">{currentUser.email}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs bg-stone-50 rounded-xl p-2">
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block">Runs</span>
                        <span className="text-sm font-black text-amber-700">{currentUser.totalRuns}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase font-bold block">Miles</span>
                        <span className="text-sm font-black text-emerald-700">{currentUser.totalMiles} mi</span>
                      </div>
                    </div>

                    <div className="text-xs space-y-1.5 text-stone-600">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Shirt className="w-3.5 h-3.5 text-amber-500" />
                          <span>Shirt Size:</span>
                        </span>
                        <span className="font-bold font-mono text-stone-900">{currentUser.shirtSize}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          <span>Status:</span>
                        </span>
                        <span className="font-bold text-stone-900 capitalize">{currentUser.role}</span>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-2 space-y-1">
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            setActiveTab('admin');
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg flex items-center gap-2"
                        >
                          <Shield className="w-3.5 h-3.5 text-woodland-600" />
                          <span>Admin Portal</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* GUEST - SIGN IN BUTTON */
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs rounded-xl transition shadow-xs font-display uppercase tracking-wider cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
