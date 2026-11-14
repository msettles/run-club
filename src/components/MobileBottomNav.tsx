import React from 'react';
import type { AppTab } from '../types';
import { Calendar, Map, Trophy, Gift, Sparkles } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isSignedIn?: boolean;
  isStaff?: boolean;
  onQuickCheckIn: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  isSignedIn = false,
  isStaff = false,
  onQuickCheckIn,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-1 py-1 shadow-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around text-[10px] font-semibold text-stone-500">
        <button
          onClick={() => setActiveTab('runs')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg transition ${
            activeTab === 'runs' ? 'text-woodland-900 font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>Runs</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg transition ${
            activeTab === 'routes' ? 'text-woodland-900 font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Map className="w-5 h-5 mb-0.5" />
          <span>Routes</span>
        </button>

        {/* Quick Check-In Center Button */}
        <button
          onClick={onQuickCheckIn}
          className="flex flex-col items-center -mt-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 p-2.5 rounded-full shadow-lg transition ring-4 ring-white"
          title="Check In Tonight"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('milestones')}
          className={`flex flex-col items-center py-1 px-1.5 rounded-lg transition ${
            activeTab === 'milestones' ? 'text-woodland-900 font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Gift className="w-5 h-5 mb-0.5 text-amber-500" />
          <span>Milestones</span>
        </button>

        {isSignedIn ? (
          <button
            onClick={() => setActiveTab(isStaff ? 'organizer' : 'leaderboard')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg transition ${
              activeTab === (isStaff ? 'organizer' : 'leaderboard') ? 'text-woodland-900 font-bold' : 'hover:text-stone-900'
            }`}
          >
            <Trophy className="w-5 h-5 mb-0.5 text-stone-400" />
            <span>{isStaff ? 'Run Night' : 'Standings'}</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
};
