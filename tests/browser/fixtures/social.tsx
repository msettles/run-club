import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RunSocialPostModal } from '../../../src/components/RunSocialPostModal';
import { isFirebaseConfigured } from '../../../src/services/firebase';
import type { RunEvent, GPXRoute } from '../../../src/types';
import type { socialPublishingRequest } from '../../../src/services/socialPublishing';
import '../../../src/index.css';
if (isFirebaseConfigured) throw new Error('Browser fixtures must never use Firebase.');
const routes: GPXRoute[] = [
  { id: 'short-route', name: 'Patio Loop', description: '', distanceMiles: 1.19, elevationGainFt: 0, surface: 'Pavement', difficulty: 'Easy', points: [{ lat: 38.678, lon: -121.771 }, { lat: 38.682, lon: -121.771 }, { lat: 38.682, lon: -121.764 }, { lat: 38.678, lon: -121.771 }], createdAt: '' },
  { id: 'long-route', name: 'Downtown Run', description: '', distanceMiles: 3.28, elevationGainFt: 0, surface: 'Pavement', difficulty: 'Easy', points: [{ lat: 38.678, lon: -121.771 }, { lat: 38.69, lon: -121.771 }, { lat: 38.69, lon: -121.746 }, { lat: 38.678, lon: -121.771 }], createdAt: '' },
];
const loadRoute = async (id: string) => { const route = routes.find((r) => r.id === id); if (!route) throw new Error('Missing route'); return route; };
const run: RunEvent = { id: 'run-123', title: 'Wednesday Community Run', date: '2026-11-18', time: '06:30 PM', locationName: 'Test Patio', address: 'Woodland, CA', description: 'Walk or run with friends.', distanceMiles: 3.28, surface: 'Pavement', elevationGainFt: 0, paceGroups: [], attendees: [], organizerName: 'Test Organizer', routeChoices: routes.map((r) => ({ routeId: r.id })) };
const request: typeof socialPublishingRequest = async (runId, post) => {
  const response = await fetch('/__test__/social', { method: 'POST', body: JSON.stringify({ runId, post }) });
  if (!response.ok) throw new Error('Synthetic service failure');
  return response.json();
};
function SocialFixture() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Prepare social post</button>{open && <RunSocialPostModal run={run} loadRoute={loadRoute} request={request} onClose={() => setOpen(false)} />}</>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><SocialFixture /></React.StrictMode>);
