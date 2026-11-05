import { useState } from 'react';
import { useClubStore } from './services/storage';
import { Navbar } from './components/Navbar';
import { RunCard } from './components/RunCard';
import { MapViewer } from './components/MapViewer';
import { GpxUploader } from './components/GpxUploader';
import { CheckInModal } from './components/CheckInModal';
import { NewRunModal } from './components/NewRunModal';
import { Leaderboard } from './components/Leaderboard';
import { FirebaseSetupGuide } from './components/FirebaseSetupGuide';
import { RunEvent, GPXRoute, SurfaceType } from './types';
import { 
  Plus, 
  UploadCloud, 
  Filter, 
  Compass, 
  Mountain, 
  Sparkles,
  Download,
  AlertCircle
} from 'lucide-react';
import { downloadGPXFile } from './utils/gpxParser';

export function App() {
  const {
    runs,
    routes,
    members,
    badges,
    currentMember,
    setCurrentMemberId,
    toggleRSVP,
    checkInMember,
    addRun,
    addRoute,
    isSyncing,
    isFirebaseConfigured,
  } = useClubStore();

  const [activeTab, setActiveTab] = useState<'runs' | 'routes' | 'leaderboard'>('runs');
  const [surfaceFilter, setSurfaceFilter] = useState<'All' | SurfaceType>('All');
  
  // Modals state
  const [selectedRunForCheckIn, setSelectedRunForCheckIn] = useState<RunEvent | null>(null);
  const [isNewRunOpen, setIsNewRunOpen] = useState<boolean>(false);
  const [isUploadGpxOpen, setIsUploadGpxOpen] = useState<boolean>(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState<boolean>(false);

  // Selected route for viewing
  const [selectedRoute, setSelectedRoute] = useState<GPXRoute>(routes[0]);

  // Filtered runs
  const filteredRuns = runs.filter((r) => {
    if (surfaceFilter === 'All') return true;
    return r.surface === surfaceFilter;
  });

  const handleViewRouteFromRun = (route: GPXRoute) => {
    setSelectedRoute(route);
    setActiveTab('routes');
  };

  const handleRouteUploaded = (newRouteData: Omit<GPXRoute, 'id'>) => {
    addRoute(newRouteData).then((saved) => {
      setSelectedRoute(saved);
      setIsUploadGpxOpen(false);
      setActiveTab('routes');
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentMember={currentMember}
        isFirebaseConfigured={isFirebaseConfigured}
        isSyncing={isSyncing}
        onOpenNewRun={() => setIsNewRunOpen(true)}
        onOpenUploadGpx={() => setIsUploadGpxOpen(true)}
        onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: RUN SCHEDULES */}
        {activeTab === 'runs' && (
          <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 text-white p-6 sm:p-8 shadow-md">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Spring 2026 Season • Woodland Woodchuckers</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                  Woodland Woodchuckers Run Club
                </h1>
                <p className="mt-2 text-sm sm:text-base text-emerald-100/90 leading-relaxed">
                  Join our weekly group runs, explore scenic GPX trail routes, check in to build
                  your woodchuck streaks, and earn club badges — 100% free with zero fees!
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => setIsNewRunOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule a Run</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('routes')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700/60 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl border border-emerald-500/40 transition"
                  >
                    <Compass className="w-4 h-4 text-emerald-300" />
                    <span>Explore GPX Trails</span>
                  </button>
                </div>
              </div>

              {/* Decorative Mascot illustration */}
              <div className="hidden lg:block absolute -right-6 -bottom-6 w-56 h-56 opacity-25 pointer-events-none">
                <img src="/woodchuck.svg" alt="Woodchuck mascot backdrop" className="w-full h-full" />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Surface:</span>
                {(['All', 'Trail', 'Pavement', 'Mixed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSurfaceFilter(s)}
                    className={`px-3 py-1 rounded-lg transition ${
                      surfaceFilter === s
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="text-xs text-stone-500 font-medium">
                Showing {filteredRuns.length} scheduled run{filteredRuns.length === 1 ? '' : 's'}
              </div>
            </div>

            {/* Runs Grid */}
            {filteredRuns.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                <AlertCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">No runs found for this filter</p>
                <p className="text-xs text-stone-500 mt-1">Try switching the surface filter or schedule a new run!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRuns.map((run) => {
                  const matchedRoute = routes.find((r) => r.id === run.routeId);
                  return (
                    <RunCard
                      key={run.id}
                      run={run}
                      route={matchedRoute}
                      currentMember={currentMember}
                      onToggleRSVP={toggleRSVP}
                      onOpenCheckIn={(r) => setSelectedRunForCheckIn(r)}
                      onViewRoute={handleViewRouteFromRun}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GPX ROUTES & INTERACTIVE MAPS */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-stone-900 flex items-center gap-2">
                  <span>🗺️</span> GPX Route Library & Interactive Maps
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  100% free OpenStreetMap visualization, elevation profiles, and GPX watch downloads.
                </p>
              </div>

              <button
                onClick={() => setIsUploadGpxOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Custom GPX</span>
              </button>
            </div>

            {/* Route Selector Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {routes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoute(r)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
                    selectedRoute.id === r.id
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  <span>{r.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedRoute.id === r.id ? 'bg-emerald-900 text-emerald-200' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {r.distanceMiles} mi
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Route Map Viewer */}
            {selectedRoute && (
              <MapViewer route={selectedRoute} height="480px" showElevationProfile={true} />
            )}

            {/* Route Cards Carousel / Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {routes.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoute(r)}
                  className={`p-4 rounded-xl border bg-white cursor-pointer transition ${
                    selectedRoute.id === r.id
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'border-stone-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-stone-900 leading-snug">{r.name}</h4>
                    <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      {r.surface}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-2 mb-3 leading-relaxed">
                    {r.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-100">
                    <span className="font-semibold text-emerald-800">{r.distanceMiles} miles</span>
                    <span className="flex items-center gap-1 text-stone-500">
                      <Mountain className="w-3 h-3 text-amber-600" /> +{r.elevationGainFt} ft
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadGPXFile(r);
                      }}
                      className="text-stone-400 hover:text-stone-800 p-1"
                      title="Download GPX"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MEMBERS & LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <Leaderboard
            members={members}
            badges={badges}
            currentMember={currentMember}
            onSelectMember={(id) => setCurrentMemberId(id)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="text-base">🦫</span>
            <span className="font-semibold text-stone-800">Woodland Woodchuckers Run Club</span>
            <span>• Built with Vite, React, TypeScript & Firebase Spark</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSetupGuideOpen(true)}
              className="text-emerald-700 hover:underline font-semibold"
            >
              Zero-Credit-Card Setup Guide
            </button>
            <span>•</span>
            <span className="text-stone-400">PWA Ready • Offline Enabled</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedRunForCheckIn && (
        <CheckInModal
          run={selectedRunForCheckIn}
          members={members}
          currentMember={currentMember}
          isOpen={Boolean(selectedRunForCheckIn)}
          onClose={() => setSelectedRunForCheckIn(null)}
          onCheckIn={checkInMember}
        />
      )}

      {isNewRunOpen && (
        <NewRunModal
          isOpen={isNewRunOpen}
          onClose={() => setIsNewRunOpen(false)}
          routes={routes}
          organizerName={currentMember.name}
          onAddRun={addRun}
        />
      )}

      {isUploadGpxOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl">
            <GpxUploader
              onRouteAdded={handleRouteUploaded}
              onCancel={() => setIsUploadGpxOpen(false)}
            />
          </div>
        </div>
      )}

      <FirebaseSetupGuide
        isOpen={isSetupGuideOpen}
        onClose={() => setIsSetupGuideOpen(false)}
        isConfigured={isFirebaseConfigured}
      />
    </div>
  );
}

export default App;
