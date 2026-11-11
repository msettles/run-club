import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ sendSignInLinkToEmail: vi.fn(), isSignInWithEmailLink: vi.fn(), signInWithEmailLink: vi.fn() }));
vi.mock('./firebase', () => ({ isFirebaseConfigured: true, auth: {} }));
vi.mock('firebase/auth', () => ({ ...api, GoogleAuthProvider: vi.fn(), signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), signOut: vi.fn(), onAuthStateChanged: vi.fn() }));
import { checkAndCompleteEmailLinkSignIn, sendPasswordlessEmailLink } from './authService';
let storage: Map<string, string>;
let replaceState: ReturnType<typeof vi.fn>;
const emailKey = 'woodchuckers_email_for_sign_in';
beforeEach(() => {
  vi.clearAllMocks(); storage = new Map(); replaceState = vi.fn();
  vi.stubGlobal('document', { title: 'Run Club' });
  vi.stubGlobal('window', {
    location: { href: 'https://example.test/?checkin=true', origin: 'https://example.test' },
    localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    history: { replaceState }, prompt: vi.fn().mockReturnValue(' Runner@Example.test '),
  });
  api.sendSignInLinkToEmail.mockResolvedValue(undefined);
  api.isSignInWithEmailLink.mockReturnValue(true);
  api.signInWithEmailLink.mockResolvedValue({ user: { uid: 'runner' } });
});
afterEach(() => vi.unstubAllGlobals());
it('puts QR/run return state in the email continuation URL, not just the homepage', async () => {
  await sendPasswordlessEmailLink(' Runner@Example.test ', 'https://example.test/?run=run-123&checkin=true');
  expect(api.sendSignInLinkToEmail).toHaveBeenCalledWith({}, 'runner@example.test', { url: 'https://example.test/?run=run-123&checkin=true', handleCodeInApp: true });
  expect(storage.get(emailKey)).toBe('runner@example.test');
});
it('preserves the check-in destination after redeeming the original one-time sign-in link', async () => {
  window.location.href = 'https://example.test/?run=run-123&checkin=true&mode=signIn&oobCode=secret';
  storage.set(emailKey, 'runner@example.test');
  await checkAndCompleteEmailLinkSignIn();
  expect(api.signInWithEmailLink).toHaveBeenCalledWith({}, 'runner@example.test', window.location.href);
  expect(replaceState).toHaveBeenCalledWith({}, 'Run Club', 'https://example.test/?run=run-123&checkin=true');
  expect(storage.has(emailKey)).toBe(false);
});
it('confirms email in another browser and deduplicates Strict Mode completion calls', async () => {
  let resolve!: (value: { user: { uid: string } }) => void;
  api.signInWithEmailLink.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const first = checkAndCompleteEmailLinkSignIn(); const second = checkAndCompleteEmailLinkSignIn();
  expect(window.prompt).toHaveBeenCalledOnce(); expect(api.signInWithEmailLink).toHaveBeenCalledOnce();
  resolve({ user: { uid: 'runner' } });
  await expect(first).resolves.toEqual({ uid: 'runner' }); await expect(second).resolves.toEqual({ uid: 'runner' });
  expect(replaceState).toHaveBeenCalledWith({}, 'Run Club', 'https://example.test/?checkin=true');
});
it('does not report an email-send failure solely because browser storage is blocked', async () => {
  window.localStorage.setItem = () => { throw new Error('Storage blocked'); };
  await expect(sendPasswordlessEmailLink('runner@example.test')).resolves.toBeUndefined();
});
it('leaves failed links unconsumed and permits retry without navigating to check-in', async () => {
  api.signInWithEmailLink.mockRejectedValueOnce(new Error('Expired link'));
  await expect(checkAndCompleteEmailLinkSignIn()).rejects.toThrow('Expired link');
  expect(replaceState).not.toHaveBeenCalled();
  await expect(checkAndCompleteEmailLinkSignIn()).resolves.toEqual({ uid: 'runner' });
});
