import { app } from './firebase';
import type { SocialPlatform, SocialPostStatus, SocialPostImage } from '../utils/socialPost';

export async function socialPublishingRequest(runId: string, post?: { caption: string; images: SocialPostImage[]; platforms: SocialPlatform[] }): Promise<SocialPostStatus> {
  if (!app) throw new Error('Social publishing requires the connected club app. Local previews do not publish.');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<{ runId: string; post?: typeof post }, SocialPostStatus>(getFunctions(app, 'us-central1'), 'runSocialPost', { timeout: 360000 });
  return (await call({ runId, ...(post ? { post } : {}) })).data;
}
