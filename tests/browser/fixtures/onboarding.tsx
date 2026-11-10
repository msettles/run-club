import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NewUserModal } from '../../../src/components/NewUserModal';
import { ModalLoadBoundary } from '../../../src/components/ModalLoadBoundary';
import { useClubStore } from '../../../src/services/storage';
import { isFirebaseConfigured } from '../../../src/services/firebase';
import '../../../src/index.css';

if (isFirebaseConfigured) throw new Error('Browser fixtures must never use Firebase.');
function Broken(): React.ReactNode { throw new Error('Simulated chunk failure'); }
function Onboarding() {
  const store = useClubStore({ loadLeaderboard: false });
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [saved, setSaved] = useState('');
  return <><button onClick={() => setOpen(true)}>Set up profile</button><button onClick={() => setBroken(true)}>Open unavailable window</button><p role="status">{saved}</p>
    {open && <NewUserModal isOpen onClose={() => setOpen(false)} email="new-runner@example.test" initialDisplayName="" legacyMembers={[]} onRegisterUser={async (details, claims) => {
      const response = await fetch('/__test__/registration', { method: 'POST', body: JSON.stringify(details) });
      if (!response.ok) throw new Error('Profile could not be saved. Please retry.');
      return store.registerUser(details, claims);
    }} onSuccess={(user) => setSaved(`Profile saved: ${user.displayName}`)} />}
    <ModalLoadBoundary onClose={() => setBroken(false)}>{broken && <Broken />}</ModalLoadBoundary>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Onboarding /></React.StrictMode>);
