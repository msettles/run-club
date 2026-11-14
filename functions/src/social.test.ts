import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  post: vi.fn(), get: vi.fn(), config: { accessToken: 'synthetic-token', facebookPageId: '12', instagramUserId: '34' },
}));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => {
  const ref = (path: string) => ({ path,
    get: async () => ({ exists: fake.docs.has(path), data: () => fake.docs.get(path) }),
    update: async (value: Record<string, unknown>) => { fake.docs.set(path, { ...fake.docs.get(path), ...value }); },
  });
  return {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async (fn: (tx: unknown) => unknown) => fn({ get: (r: ReturnType<typeof ref>) => r.get(), set: (r: ReturnType<typeof ref>, data: Record<string, unknown>) => fake.docs.set(r.path, data) }),
  };
} }));
vi.mock('firebase-functions/params', () => ({ defineSecret: () => ({ value: () => JSON.stringify(fake.config) }) }));
vi.mock('./socialGraph', async (original) => ({ ...await original<typeof import('./socialGraph')>(), metaGraphClient: () => ({ post: fake.post, get: fake.get }) }));
import { runSocialPost } from './social';
import { MetaRejected } from './socialGraph';
const jpeg = 'data:image/jpeg;base64,/9j/2Q=='; // Synthetic header/footer; no real photo is sent.
const request = (post?: unknown, role = 'organizer') => {
  fake.docs.set('users/staff@example.test', { email: 'staff@example.test', role });
  return { auth: { uid: 'staff', token: { email: 'staff@example.test', email_verified: true } }, data: { runId: 'run-123', ...(post ? { post } : {}) } };
};
const post = { caption: 'Synthetic run', images: [{ routeId: 'route-1', name: 'Short route', image: jpeg }, { routeId: 'route-2', name: 'Long route', image: jpeg }], platforms: ['facebook', 'instagram'] };
const invoke = (value: unknown) => runSocialPost.run(value as Parameters<typeof runSocialPost.run>[0]);
beforeEach(() => {
  fake.docs.clear(); fake.post.mockReset(); fake.get.mockReset();
  fake.docs.set('runs/run-123', { title: 'Synthetic run', routeChoices: [{ routeId: 'route-1' }, { routeId: 'route-2' }] }); fake.docs.set('meetup_events/run-123', { codeWordSet: true });
  process.env.GCLOUD_PROJECT = 'demo-social';
});
describe('run social publishing authorization and durable results', () => {
  it('denies guests, unverified accounts and ordinary runners before contacting Meta', async () => {
    await expect(invoke({ data: { runId: 'run-123', post } })).rejects.toMatchObject({ code: 'unauthenticated' });
    const unverified = request(post); unverified.auth.token.email_verified = false;
    await expect(invoke(unverified)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(invoke(request(post, 'member'))).rejects.toMatchObject({ code: 'permission-denied' });
    expect(fake.post).not.toHaveBeenCalled();
  });
  it('refuses nonexistent/unpublished runs and paused organizer writes', async () => {
    fake.docs.delete('runs/run-123');
    await expect(invoke(request(post))).rejects.toMatchObject({ code: 'failed-precondition' });
    fake.docs.set('runs/run-123', {}); fake.docs.set('meetup_events/run-123', { codeWordSet: false });
    await expect(invoke(request(post))).rejects.toMatchObject({ code: 'failed-precondition' });
    fake.docs.set('meetup_events/run-123', {}); fake.docs.set('settings/maintenance', { active: true });
    await expect(invoke(request(post))).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(fake.post).not.toHaveBeenCalled();
  });
  it('returns no credentials or captions in status and performs no social writes during preview', async () => {
    const value = await invoke(request());
    expect(JSON.stringify(value)).not.toMatch(/synthetic-token|accessToken/);
    expect(fake.post).not.toHaveBeenCalled();
    expect([...fake.docs.keys()].some((key) => key.startsWith('social_'))).toBe(false);
  });
  it('retries only a definitely failed destination and preserves successful posts', async () => {
    fake.post.mockResolvedValueOnce({ id: '11' }).mockResolvedValueOnce({ id: '22' }).mockResolvedValueOnce({ id: '12_56' }).mockRejectedValueOnce(new MetaRejected(190));
    const first = await invoke(request(post));
    expect(first.results.facebook?.state).toBe('published'); expect(first.results.instagram?.state).toBe('failed');
    fake.post.mockResolvedValueOnce({ id: '78' }).mockResolvedValueOnce({ id: '79' }).mockResolvedValueOnce({ id: '80' }).mockResolvedValueOnce({ id: '90' });
    fake.get.mockResolvedValue({ status_code: 'FINISHED' });
    const second = await invoke(request(post));
    expect(second.results.instagram?.state).toBe('published');
    expect(fake.post.mock.calls.filter(([path]) => path.endsWith('/photos'))).toHaveLength(2);
  });
  it('blocks automatic duplicate posts after timeout, refresh and repeat submission', async () => {
    fake.post.mockResolvedValueOnce({ id: '11' }).mockResolvedValueOnce({ id: '22' }).mockRejectedValueOnce(new Error('Timeout'));
    const onePlatform = { ...post, platforms: ['facebook'] };
    expect((await invoke(request(onePlatform))).results.facebook?.state).toBe('uncertain');
    await invoke(request()); await invoke(request(onePlatform));
    expect(fake.post).toHaveBeenCalledTimes(3);
  });
});

it('refuses missing or reordered route photos before any platform write', async () => {
  await expect(invoke(request({ ...post, images: [post.images[0]] }))).rejects.toMatchObject({ code: 'failed-precondition' });
  await expect(invoke(request({ ...post, images: [...post.images].reverse() }))).rejects.toMatchObject({ code: 'failed-precondition' });
  expect(fake.post).not.toHaveBeenCalled();
});
