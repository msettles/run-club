import { useEffect, useRef, useState } from 'react';
import type { RunEvent, GPXRoute } from '../types';
import { Modal } from './Modal';
import { runPostCaption, type SocialPlatform, type SocialPostStatus, type SocialPostImage } from '../utils/socialPost';
import { runPostGraphics } from '../utils/socialGraphic';
import { socialPublishingRequest } from '../services/socialPublishing';

const platforms: SocialPlatform[] = ['facebook', 'instagram'];
const name = (platform: SocialPlatform) => platform === 'facebook' ? 'Facebook' : 'Instagram';

export function RunSocialPostModal({ run, onClose, loadRoute, request = socialPublishingRequest }: { run: RunEvent; onClose: () => void; loadRoute: (id: string) => Promise<GPXRoute>; request?: typeof socialPublishingRequest }) {
  const [caption, setCaption] = useState(() => runPostCaption(run));
  const [images, setImages] = useState<SocialPostImage[]>([]);
  const [imageError, setImageError] = useState('');
  const [generating, setGenerating] = useState(true);
  const imageSequence = useRef(0);
  const [status, setStatus] = useState<SocialPostStatus>({ accounts: {}, results: {} });
  const [selected, setSelected] = useState<SocialPlatform[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const requestSequence = useRef(0);
  const field = 'w-full rounded-lg border border-stone-300 p-3 text-sm';
  const retryable = (platform: SocialPlatform, data = status) => !data.results[platform] || data.results[platform]?.state === 'failed';
  const refresh = async () => {
    const sequence = ++requestSequence.current;
    setError(''); setLoading(true);
    try {
      const data = await request(run.id);
      if (sequence !== requestSequence.current) return;
      setStatus(data);
      setSelected(platforms.filter((p) => data.accounts[p] && retryable(p, data)));
    } catch { if (sequence === requestSequence.current) setError('Social publishing is not connected. The club admin needs to configure the publishing service and club accounts. Your run is saved.'); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  };
  const generate = async () => {
    const sequence = ++imageSequence.current;
    setGenerating(true); setImageError(''); setImages([]);
    try {
      const graphics = await runPostGraphics(run, loadRoute);
      if (sequence === imageSequence.current) setImages(graphics);
    } catch (err) {
      if (sequence === imageSequence.current) setImageError(err instanceof Error ? err.message : 'Route images could not be created. Please retry.');
    } finally { if (sequence === imageSequence.current) setGenerating(false); }
  };
  useEffect(() => {
    void generate(); void refresh();
    const pending = { images: imageSequence, status: requestSequence };
    return () => { pending.images.current++; pending.status.current++; };
    // The dialog is keyed by run ID, retaining one reviewed snapshot until reopened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);
  const submit = async () => {
    if (sending.current || loading || !images.length || generating || !selected.length) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const data = await request(run.id, { caption, images, platforms: selected });
      setStatus(data); setSelected(selected.filter((p) => retryable(p, data)));
    } catch {
      // The callable itself can time out after a remote post succeeded. Refresh persisted status, never resend blindly.
      setError('Could not confirm the result. Refresh publishing status before trying again. Your run is saved.');
      setSelected([]);
    } finally { sending.current = false; setBusy(false); }
  };
  return <Modal title="Post run to social media" onClose={() => { if (!sending.current) onClose(); }} className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 p-4">
    <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div><h2 className="text-xl font-bold text-stone-900">Post this run</h2><p className="text-sm text-stone-600">Your run is saved. Review this post before publishing to the club accounts.</p></div>
        <button type="button" onClick={onClose} disabled={busy} className="p-2 text-sm font-bold disabled:opacity-50" aria-label="Close social post preview">Close</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-bold">{images.length ? `${images.length} route photo${images.length === 1 ? '' : 's'} in one post` : 'Route photos'}</p>
          {generating && <p role="status">Creating route maps…</p>}
          {images.map((image, i) => <figure key={image.routeId} className="space-y-1"><img src={image.image} alt={`Route map ${i + 1}: ${image.name}`} className="w-full rounded-xl" /><figcaption className="text-xs text-stone-600">{i + 1}. {image.name}</figcaption></figure>)}
          {imageError && <p role="alert" className="text-sm text-red-700">{imageError}</p>}
          {!generating && <button type="button" disabled={busy} onClick={() => void generate()} className="text-sm font-semibold underline">Retry route images</button>}
        </div>
        <div className="space-y-2">
          <label htmlFor="social-caption" className="text-sm font-bold">Post caption</label>
          <textarea id="social-caption" value={caption} maxLength={2200} rows={12} disabled={busy} onChange={(e) => setCaption(e.target.value)} className={field} />
          <p className="text-xs text-stone-500">{caption.length}/2,200 characters. Instagram captions show the run URL as text.</p>
        </div>
      </div>
      <fieldset disabled={busy || loading} className="space-y-2">
        <legend className="font-bold text-sm mb-2">Publish to</legend>
        {platforms.map((p) => <div key={p} className="rounded-lg border border-stone-200 p-3 space-y-1">
          <label className="flex flex-wrap gap-2 text-sm items-center"><input type="checkbox" checked={selected.includes(p)} disabled={!status.accounts[p] || !retryable(p)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, p] : current.filter((value) => value !== p))} />
            <span className="font-bold">{name(p)}</span><span className="w-full min-w-0 break-words text-stone-600">{loading ? 'Checking connection…' : status.accounts[p] || 'Not configured'}</span>
          </label>
          {status.results[p] && <p role="status" className="text-sm text-stone-700">{status.results[p]?.message}{status.results[p]?.url && <> <a href={status.results[p]?.url} target="_blank" rel="noopener noreferrer" className="underline">View post</a></>}</p>}
        </div>)}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-stone-600">Publishing sends these route photos together in one post with the caption. Later run edits do not update existing social posts. Keep check-in code words and private runner details out of the post.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy || loading} onClick={() => void refresh()} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Refresh status</button>
        <button type="button" disabled={busy || loading || !images.length || generating || !selected.length || !caption.trim()} onClick={() => void submit()} className="rounded-lg bg-woodland-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Publishing…' : `Publish to ${selected.map(name).join(' & ') || 'selected accounts'}`}</button>
      </div>
    </div>
  </Modal>;
}
