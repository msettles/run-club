import { createHash, randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { isAdminProfile, isStaffProfile } from '../../src/utils/roles';
import type { UserProfile } from '../../src/types';
import { MAX_SOCIAL_ROUTES, socialRouteIds } from '../../src/utils/socialPost';
import type { SocialPostImage, SocialPlatform, SocialPostResult, SocialPostStatus } from '../../src/utils/socialPost';
import { metaGraphClient, MetaRejected, publishInstagram, publishFacebook } from './socialGraph';

const configSecret = defineSecret('META_SOCIAL_CONFIG');
interface Config { accessToken?: string; graphVersion?: string; facebookPageId?: string; instagramUserId?: string; facebookPageName?: string; instagramUsername?: string }
const platforms: SocialPlatform[] = ['facebook', 'instagram'];
function config(): Config {
  try {
    const value: Config = JSON.parse(configSecret.value());
    if (value.graphVersion && !/^v\d+\.\d+$/.test(value.graphVersion)) throw new Error();
    for (const id of [value.facebookPageId, value.instagramUserId]) if (id && !/^\d+$/.test(id)) throw new Error();
    return value;
  } catch { throw new HttpsError('failed-precondition', 'Social accounts need to be configured by the club admin.'); }
}
function validRunId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 300 && !value.includes('/') && value !== '.' && value !== '..';
}
function documentKey(runId: string, platform: SocialPlatform) { return createHash('sha256').update(`${runId}:${platform}`).digest('hex'); }
async function staff(request: CallableRequest) {
  const email = request.auth?.token.email;
  if (!request.auth || request.auth.token.email_verified !== true || typeof email !== 'string') throw new HttpsError('unauthenticated', 'Sign in with a verified staff account.');
  const profile = (await getFirestore().collection('users').doc(email.toLowerCase()).get()).data();
  if (!profile || profile.deleting) throw new HttpsError('permission-denied', 'An active staff profile is required.');
  const user = { ...profile, email } as UserProfile;
  if (!isStaffProfile(user)) throw new HttpsError('permission-denied', 'Only organizers and admins can publish run posts.');
  return user;
}
function publicResult(data: Record<string, unknown> | undefined): SocialPostResult | undefined {
  if (!data) return;
  return { state: data.state as SocialPostResult['state'], message: String(data.message || ''),
    ...(typeof data.postId === 'string' ? { postId: data.postId } : {}), ...(typeof data.url === 'string' ? { url: data.url } : {}) };
}
async function status(runId: string, cfg: Config): Promise<SocialPostStatus> {
  const accounts: SocialPostStatus['accounts'] = {};
  if (cfg.accessToken && cfg.facebookPageId) accounts.facebook = cfg.facebookPageName || `Facebook Page ${cfg.facebookPageId}`;
  if (cfg.accessToken && cfg.instagramUserId) accounts.instagram = cfg.instagramUsername || `Instagram ${cfg.instagramUserId}`;
  const docs = await Promise.all(platforms.map((platform) => getFirestore().collection('social_posts').doc(documentKey(runId, platform)).get()));
  const results: SocialPostStatus['results'] = {};
  docs.forEach((doc, i) => { const result = publicResult(doc.data()); if (result) results[platforms[i]] = result; });
  return { accounts, results };
}

export const runSocialPost = onCall({ region: 'us-central1', secrets: [configSecret], timeoutSeconds: 300, maxInstances: 3, memory: '256MiB' }, async (request) => {
  const user = await staff(request);
  const { runId, post } = request.data || {};
  if (!validRunId(runId)) throw new HttpsError('invalid-argument', 'Choose a saved run.');
  const cfg = config();
  if (!post) return status(runId, cfg);
  if (typeof post.caption !== 'string' || !post.caption.trim() || post.caption.length > 2200 ||
      !Array.isArray(post.platforms) || post.platforms.length < 1 || post.platforms.length > 2 ||
      new Set(post.platforms).size !== post.platforms.length || post.platforms.some((p: SocialPlatform) => !platforms.includes(p))) {
    throw new HttpsError('invalid-argument', 'Choose platforms and a caption of 1–2,200 characters.');
  }
  if (!Array.isArray(post.images) || post.images.length < 1 || post.images.length > MAX_SOCIAL_ROUTES) throw new HttpsError('invalid-argument', `Include 1–${MAX_SOCIAL_ROUTES} route photos.`);
  const images = post.images.map((item: SocialPostImage) => {
    if (!item || !validRunId(item.routeId) || typeof item.image !== 'string' || item.image.length > 800000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(item.image)) throw new HttpsError('invalid-argument', 'Each route needs a valid JPEG map image.');
    const bytes = Buffer.from(item.image.split(',')[1], 'base64');
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new HttpsError('invalid-argument', 'Invalid JPEG image.');
    return { routeId: item.routeId, bytes, id: createHash('sha256').update(bytes).digest('hex') };
  }) as { routeId: string; bytes: Buffer; id: string }[];
  if (new Set(images.map((item) => item.routeId)).size !== images.length) throw new HttpsError('invalid-argument', 'Include each route once.');
  const project = process.env.GCLOUD_PROJECT;
  if (!project) throw new HttpsError('failed-precondition', 'Social image hosting is not configured.');
  const available = (await status(runId, cfg)).accounts;
  for (const platform of post.platforms as SocialPlatform[]) if (!available[platform]) throw new HttpsError('failed-precondition', `${platform === 'facebook' ? 'Facebook' : 'Instagram'} is not configured.`);
  const db = getFirestore();
  // Both destinations use the same ordered, reviewed images, each kept in its own bounded document.
  const imageUrls = images.map((image) => `https://us-central1-${project}.cloudfunctions.net/socialImage?id=${image.id}`);
  const graph = metaGraphClient(cfg.accessToken!, cfg.graphVersion || 'v27.0');
  for (const platform of post.platforms as SocialPlatform[]) {
    const ref = db.collection('social_posts').doc(documentKey(runId, platform));
    const attempt = randomUUID();
    const acquired = await db.runTransaction(async (tx) => {
      const [previous, run, event, maintenance, fence] = await Promise.all([
        tx.get(ref), tx.get(db.collection('runs').doc(runId)), tx.get(db.collection('meetup_events').doc(runId)),
        tx.get(db.collection('settings').doc('maintenance')), tx.get(db.collection('settings').doc('legacy_import')),
      ]);
      // A failed request with a definite rejection can be retried explicitly. Pending/uncertain writes cannot.
      if (previous.exists && previous.data()?.state !== 'failed') return false;
      if (!run.exists || run.data()?.deleting || !event.exists || event.data()?.codeWordSet === false) throw new HttpsError('failed-precondition', 'Only a published, available run can be posted.');
      if (fence.data()?.active || (maintenance.data()?.active && !isAdminProfile(user))) throw new HttpsError('failed-precondition', 'Club changes are paused. Try again after maintenance.');
      const expected = socialRouteIds(run.data() as Parameters<typeof socialRouteIds>[0]);
      if (expected.length !== images.length || expected.some((id, i) => images[i].routeId !== id)) throw new HttpsError('failed-precondition', 'The run routes changed or a route photo is missing. Reopen the post preview.');
      for (const image of images) tx.set(db.collection('social_images').doc(image.id), { jpeg: image.bytes.toString('base64') });
      tx.set(ref, { runId, platform, attempt, state: 'publishing', message: 'Publishing, or awaiting verification. Refresh status before retrying.',
        caption: post.caption, imageIds: images.map((image) => image.id), routeIds: images.map((image) => image.routeId), accountId: platform === 'facebook' ? cfg.facebookPageId : cfg.instagramUserId,
        requestedBy: user.email, requestedAt: new Date().toISOString() });
      return true;
    });
    if (!acquired) continue;
    let publishStarted = false;
    try {
      let postId: string;
      if (platform === 'facebook') {
        postId = await publishFacebook(graph, cfg.facebookPageId!, imageUrls, post.caption, async (photoIds) => {
          await ref.update({ photoIds });
          publishStarted = true;
        });
      } else {
        postId = await publishInstagram(graph, cfg.instagramUserId!, imageUrls, post.caption, async (containerId) => {
          await ref.update({ containerId });
          publishStarted = true;
        });
      }
      // If storing the success fails, the durable publishing lock remains; the post must not be sent again.
      const url = platform === 'facebook' ? `https://www.facebook.com/${postId}` : undefined;
      await ref.update({ state: 'published', message: 'Published.', postId, ...(url ? { url } : {}), publishedAt: new Date().toISOString() });
    } catch (error) {
      const uncertain = publishStarted && !(error instanceof MetaRejected);
      await ref.update({ state: uncertain ? 'uncertain' : 'failed', message: uncertain
        ? 'The platform may have published this post. Check the account before asking an admin to reconcile it; automatic retry is blocked.'
        : 'Not published. Check the account connection and permissions, then retry this platform.' });
    }
  }
  return status(runId, cfg);
});

/** Only reviewed post images are public; captions, account credentials and audit records remain private. */
export const socialImage = onRequest({ region: 'us-central1', maxInstances: 3, memory: '256MiB' }, async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).send('Method not allowed'); return; }
  const id = req.query.id;
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) { res.status(404).send('Image unavailable'); return; }
  const saved = await getFirestore().collection('social_images').doc(id).get();
  if (!saved.exists) { res.status(404).send('Image unavailable'); return; }
  res.set({ 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400, immutable' });
  res.status(200).send(req.method === 'HEAD' ? '' : Buffer.from(saved.data()!.jpeg, 'base64'));
});
