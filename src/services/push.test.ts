import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  loaded: vi.fn(), isSupported: vi.fn(), getMessaging: vi.fn(), getToken: vi.fn(), deleteToken: vi.fn(),
}));
vi.mock('./firebase', () => ({ app: {}, db: null, isFirebaseConfigured: true }));
vi.mock('firebase/messaging', () => {
  sdk.loaded();
  return sdk;
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'test-key');
  vi.stubGlobal('window', { Notification: {}, PushManager: {}, indexedDB: {}, matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('navigator', { userAgent: 'test desktop', serviceWorker: { register: vi.fn().mockResolvedValue({ scope: '/push/' }) } });
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') });
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn() });
  sdk.isSupported.mockResolvedValue(true);
  sdk.getToken.mockResolvedValue('test-token');
  sdk.deleteToken.mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('checks status at startup without loading Messaging', async () => {
  const { getPushStatus } = await import('./push');
  expect(await getPushStatus()).toBe('off');
  expect(sdk.loaded).not.toHaveBeenCalled();
  expect(sdk.isSupported).not.toHaveBeenCalled();
});

it('loads Messaging after permission is granted and registers the dedicated push worker', async () => {
  const { enablePushOnThisDevice } = await import('./push');
  expect(await enablePushOnThisDevice()).toBe('on');
  expect(sdk.loaded).toHaveBeenCalledOnce();
  expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/push/' });
  expect(sdk.getToken).toHaveBeenCalled();
  expect(localStorage.setItem).toHaveBeenCalledWith('woodchuckers_push_device_v1', '1');
});

it('does not load Messaging when permission is refused', async () => {
  vi.mocked(Notification.requestPermission).mockResolvedValue('denied');
  const { enablePushOnThisDevice } = await import('./push');
  expect(await enablePushOnThisDevice()).toBe('blocked');
  expect(sdk.loaded).not.toHaveBeenCalled();
});

it('does not report on when the Messaging SDK finds an unsupported browser', async () => {
  sdk.isSupported.mockResolvedValue(false);
  const { enablePushOnThisDevice } = await import('./push');
  expect(await enablePushOnThisDevice()).toBe('unsupported');
  expect(localStorage.setItem).not.toHaveBeenCalled();
});

it('loads Messaging to disable a device and clears its enabled flag', async () => {
  const { disablePushOnThisDevice } = await import('./push');
  await disablePushOnThisDevice();
  expect(sdk.deleteToken).toHaveBeenCalled();
  expect(localStorage.removeItem).toHaveBeenCalledWith('woodchuckers_push_device_v1');
});

it('handles a non-browser environment without loading the SDK', async () => {
  vi.stubGlobal('window', undefined);
  vi.stubGlobal('navigator', undefined);
  const { getPushStatus } = await import('./push');
  expect(await getPushStatus()).toBe('unsupported');
  expect(sdk.loaded).not.toHaveBeenCalled();
});
