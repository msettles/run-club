import { useEffect, useRef, useState } from 'react';
import type { GPXRoute } from '../types';
import { planRouteImport, type RouteImportPlan } from '../utils/routeImport';
import { generateRouteDirectionsFromGpx } from '../utils/routeEngine';
import { Modal } from './Modal';

interface Props {
  onClose(): void;
  onImport(id: string, route: Omit<GPXRoute, 'id'>): Promise<boolean>;
}

export function RouteImportModal({ onClose, onImport }: Props) {
  const [csv, setCsv] = useState<File>();
  const [files, setFiles] = useState<File[]>([]);
  const [plan, setPlan] = useState<RouteImportPlan>();
  const [busy, setBusy] = useState(false);
  const [generateDirections, setGenerateDirections] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const stop = useRef(false);
  const active = useRef(false);
  const job = useRef<AbortController>();

  useEffect(() => {
    return () => { stop.current = true; job.current?.abort(); };
  }, []);

  const reset = () => { setPlan(undefined); setResults({}); setError(''); setProgress(''); };
  const preview = async () => {
    if (!csv || active.current) return;
    active.current = true; setBusy(true); setError(''); setProgress('Checking CSV and GPX files…');
    try {
      if (csv.size > 2 * 1024 * 1024) throw new Error('The CSV must be smaller than 2 MB.');
      const next = await planRouteImport(await csv.text(), files);
      setPlan(next); setResults({}); setProgress('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read the files.'); setProgress(''); }
    finally { active.current = false; setBusy(false); }
  };

  const upload = async () => {
    if (!plan || plan.errors.length || active.current) return;
    active.current = true; stop.current = false; setBusy(true); setError('');
    const controller = new AbortController(); job.current = controller;
    try {
      for (const [index, entry] of plan.entries.entries()) {
        if (stop.current || controller.signal.aborted) break;
        if (results[entry.id] === 'Saved' || results[entry.id] === 'Already imported') continue;
        setProgress(`${index + 1} of ${plan.entries.length}: ${entry.route.name}`);
        setResults((previous) => ({ ...previous, [entry.id]: 'Processing…' }));
        try {
          let route = entry.route;
          if (generateDirections) {
            const generated = await generateRouteDirectionsFromGpx(entry.xml, entry.path, {
              parsed: entry.route, signal: controller.signal,
              onProgress: (status) => setProgress(`${index + 1} of ${plan.entries.length}: ${entry.route.name} — ${status}`),
            });
            route = { ...route, directions: generated.directions, geoJson: generated.geoJson };
          }
          if (controller.signal.aborted) break;
          const created = await onImport(entry.id, route);
          setResults((previous) => ({ ...previous, [entry.id]: created ? 'Saved' : 'Already imported' }));
        } catch (cause) {
          if (controller.signal.aborted) break;
          setResults((previous) => ({ ...previous, [entry.id]: `Failed: ${cause instanceof Error ? cause.message : 'Please retry.'}` }));
        }
      }
      setProgress(stop.current ? 'Stopped. Saved routes are kept; you can resume.' : 'Finished. Saved routes are kept; you can retry any failures.');
    } finally { active.current = false; setBusy(false); }
  };

  const saved = Object.values(results).filter((value) => value === 'Saved').length;
  const skipped = Object.values(results).filter((value) => value === 'Already imported').length;
  const completed = Boolean(plan && saved + skipped === plan.entries.length);
  const button = 'px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50';
  return (
    <Modal title="Import routes" onClose={() => { if (!active.current) onClose(); }} className="fixed inset-0 z-[1000] bg-stone-950/60 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90dvh] overflow-y-auto p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="route-import-title" className="font-display text-xl font-bold">Import routes</h2>
          <button type="button" disabled={busy} onClick={onClose} className={`${button} border border-stone-300`}>Close</button>
        </div>
        <p className="text-sm text-stone-600">Select the route CSV and all its GPX files. Preview checks every row before saving. Routes previously imported from the same Garmin course are skipped; existing routes are never replaced.</p>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-bold">Route CSV
            <input type="file" accept=".csv,text/csv" className="block mt-2 w-full text-sm" onChange={(event) => { reset(); setCsv(event.target.files?.[0]); }} />
          </label>
          <label className="block text-sm font-bold">GPX files (select all)
            <input type="file" accept=".gpx" multiple className="block mt-2 w-full text-sm" onChange={(event) => { reset(); setFiles(Array.from(event.target.files || [])); }} />
          </label>
          <p className="text-xs text-stone-600">{files.length} GPX files selected. Paths in the CSV are matched to filenames.</p>
          <button type="button" disabled={!csv || !files.length || busy} onClick={() => void preview()} className={`${button} border border-woodland-800 text-woodland-800`}>Preview import</button>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        {plan && <>
          {plan.errors.length > 0 && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800"><p className="font-bold">Fix these issues and preview again:</p><ul className="list-disc pl-5">{plan.errors.map((message) => <li key={message}>{message}</li>)}</ul></div>}
          <p className="text-sm">{plan.entries.length} valid routes. Surface defaults to Pavement; distance and elevation are measured from each GPX. Collection names, creation dates, loop settings and links are preserved.</p>
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={generateDirections} disabled={busy || saved + skipped > 0} onChange={(event) => setGenerateDirections(event.target.checked)} /><span>Generate turn-by-turn directions during import. This may take several minutes. If unchecked, maps still work and directions can be generated later in the route editor.</span></label>
          <div tabIndex={0} role="region" aria-label="Route import preview" className="overflow-auto max-h-80 border border-stone-200 rounded-xl">
            <table className="w-full text-left text-sm"><thead className="bg-stone-100"><tr>{['Run name', 'Collection', 'Created', 'Miles', 'Loop', 'Status'].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
              <tbody>{plan.entries.map((entry) => <tr key={entry.id} className="border-t border-stone-100"><td className="p-2">{entry.route.name}</td><td className="p-2">{entry.route.collectionName}</td><td className="p-2 whitespace-nowrap">{entry.route.createdAt.slice(0, 10)}</td><td className="p-2">{entry.route.distanceMiles}</td><td className="p-2">{entry.route.isLoop ? 'Yes' : 'No'}</td><td className="p-2">{results[entry.id] || 'Ready'}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-sm" aria-live="polite">{saved} saved · {skipped} already imported</p>
          <div className="flex gap-3">
            <button type="button" disabled={busy || completed || Boolean(plan.errors.length)} onClick={() => void upload()} className={`${button} bg-woodland-800 text-white`}>{completed ? 'Import complete' : saved + skipped ? 'Resume / retry import' : 'Import routes to library'}</button>
            {busy && <button type="button" className={`${button} border border-stone-300`} onClick={() => { stop.current = true; }}>Stop after current route</button>}
          </div>
        </>}
        <p role="status" className="text-sm text-stone-600">{progress}</p>
      </div>
    </Modal>
  );
}
