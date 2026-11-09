import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const analytics = vi.hoisted(() => ({ loaded: vi.fn(), getAnalytics: vi.fn(), isSupported: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [] }));
vi.mock('firebase/auth', () => ({ getAuth: () => ({}) }));
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}) }));
vi.mock('firebase/analytics', () => { analytics.loaded(); return analytics; });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  analytics.isSupported.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('waits for page load and idle time before importing Analytics', async () => {
  const onLoad = vi.fn();
  const onIdle = vi.fn();
  vi.stubGlobal('window', { addEventListener: onLoad, requestIdleCallback: onIdle });
  vi.stubGlobal('document', { readyState: 'loading' });
  const { app, db, auth } = await import('./firebase');
  expect(app && db && auth).toBeTruthy();
  expect(analytics.loaded).not.toHaveBeenCalled();
  expect(onLoad).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
  onLoad.mock.calls[0][1]();
  expect(analytics.loaded).not.toHaveBeenCalled();
  onIdle.mock.calls[0][0]();
  await vi.waitFor(() => expect(analytics.getAnalytics).toHaveBeenCalledWith(app));
});

it('keeps Analytics optional on unsupported browsers', async () => {
  analytics.isSupported.mockResolvedValue(false);
  const onIdle = vi.fn();
  vi.stubGlobal('window', { requestIdleCallback: onIdle });
  vi.stubGlobal('document', { readyState: 'complete' });
  await import('./firebase');
  onIdle.mock.calls[0][0]();
  await vi.waitFor(() => expect(analytics.isSupported).toHaveBeenCalledOnce());
  expect(analytics.getAnalytics).not.toHaveBeenCalled();
});

it('does not import Analytics without a Firebase configuration', async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', '');
  vi.stubGlobal('window', {});
  expect((await import('./firebase')).isFirebaseConfigured).toBe(false);
  expect(analytics.loaded).not.toHaveBeenCalled();
});
