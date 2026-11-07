import React from 'react';
import { Calendar, Map, Trophy, Award, Shield } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'runs' | 'routes' | 'leaderboard' | 'admin';
  setActiveTab: (tab: 'runs' | 'routes' | 'leaderboard' | 'admin') => void;
  isAdmin: boolean;
  onQuickCheckIn: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  isAdmin,
  onQuickCheckIn,
}) => {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-2 py-1 shadow-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around text-[10px] font-semibold text-stone-500">
        <button
          onClick={() => setActiveTab('runs')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
            activeTab === 'runs' ? 'text-woodland-800 font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>Runs</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
            activeTab === 'routes' ? 'text-woodland-800 font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Map className="w-5 h-5 mb-0.5" />
          <span>Routes</span>
        </button>

        {/* Quick Check-In Center Button */}
        <button
          onClick={onQuickCheckIn}
          className="flex flex-col items-center -mt-4 bg-woodland-600 text-white p-2.5 rounded-full shadow-lg hover:bg-woodland-700 transition ring-4 ring-white"
        >
          <Award className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
            activeTab === 'leaderboard' ? 'text-woodland-800 font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Trophy className="w-5 h-5 mb-0.5" />
          <span>Roster</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
              activeTab === 'admin' ? 'text-woodland-800 font-bold' : 'hover:text-stone-900'
            }`}
          >
            <Shield className="w-5 h-5 mb-0.5" />
            <span>Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
};
