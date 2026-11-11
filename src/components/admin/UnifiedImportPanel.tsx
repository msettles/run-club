import React, { useState } from 'react';
import { buildImportCommit, type ImportCommit } from '../../utils/importCommit';
import type { ClubImportResult } from '../../services/store/clubImport';
import {
  IMPORT_EXAMPLES, IMPORT_FILES, detectImportFile, planCheckinsImport, planProfilesImport, planRunsImport,
  type CheckinsPlan, type ImportFileKind, type ImportIssue, type ProfilesPlan, type RunsPlan,
} from '../../utils/importFormat';

type Result =
  | { kind: 'profiles'; plan: ProfilesPlan }
  | { kind: 'runs'; plan: RunsPlan }
  | { kind: 'checkins'; plan: CheckinsPlan };

const download = (filename: string, csv: string) => {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const requiredLabel = (r: 'one-of' | 'always' | 'no') => (r === 'one-of' ? 'Email or Name' : r === 'always' ? 'Required' : 'Optional');

/** Admin: the import formats (three files). Download the examples, then check a file before anything is imported. */
interface PanelProps {
  specialEvents?: { id: string; name: string }[];
  onImportClubData?: (commit: ImportCommit, onProgress?: (msg: string) => void) => Promise<ClubImportResult>;
  onRecomputeRewards?: (emails?: string[], onProgress?: (msg: string) => void) => Promise<{ updated: number; failed: { email: string; reason: string }[] }>;
}

/** Admin: import the three files into the club, and recompute everyone's rewards from their check-ins. */
const ImportRunner: React.FC<PanelProps> = ({ specialEvents, onImportClubData, onRecomputeRewards }) => {
  const [files, setFiles] = useState<Record<ImportFileKind, File | null>>({ profiles: null, runs: null, checkins: null });
  const [review, setReview] = useState<{ commit: ImportCommit; errors: number; notes: string[] } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState('');
  const [problem, setProblem] = useState('');

  const reviewFiles = async () => {
    setReview(null); setConfirmed(false); setDone(''); setProblem('');
    try {
      const text = async (f: File | null) => (f ? f.text() : '');
      const [pText, rText, cText] = await Promise.all([text(files.profiles), text(files.runs), text(files.checkins)]);
      const profiles = pText ? planProfilesImport(pText) : undefined;
      const runs = rText ? planRunsImport(rText, new Date(), specialEvents) : undefined;
      const checkins = cText ? planCheckinsImport(cText, runs?.runs || []) : undefined;
      const errors = [profiles, runs, checkins].reduce((n, p) => n + (p ? p.issues.filter((i) => i.level === 'error').length : 0), 0);
      const notes = [profiles, runs, checkins].flatMap((p) => (p ? p.issues.filter((i) => i.level === 'warning').map((i) => i.message) : []));
      setReview({ commit: buildImportCommit(profiles, runs, checkins), errors, notes });
    } catch (error) { setProblem(error instanceof Error ? error.message : 'Could not read the files.'); }
  };

  const run = async (job: () => Promise<string>) => {
    setBusy(true); setDone(''); setProblem(''); setProgress('');
    try { setDone(await job()); }
    catch (error) { setProblem(error instanceof Error ? error.message : 'It did not finish.'); }
    finally { setBusy(false); setProgress(''); }
  };

  const doImport = () => run(async () => {
    const r = await onImportClubData!(review!.commit, setProgress);
    const part = (label: string, made: number, changed: number, same: number) => `${label}: ${made} new, ${changed} updated, ${same} unchanged`;
    return [
      part('Members', r.membersCreated, r.membersUpdated, r.membersUnchanged),
      part('Runs', r.runsWritten, r.runsUpdated, r.runsUnchanged + r.runsLocked),
      part('Check-ins', r.checkinsWritten, r.checkinsUpdated, r.checkinsUnchanged),
      part('Past names', r.aliasesHeld, r.aliasesUpdated, r.aliasesUnchanged),
    ].join('. ') + `. Rewards recomputed for ${r.rewards.updated} members${r.rewards.failed ? `; ${r.rewards.failed} need another try (use Recompute rewards)` : ''}.${r.codeWordsSkipped ? ` ${r.codeWordsSkipped} repeated code words were left off.` : ''}${r.runsLocked ? ` ${r.runsLocked} runs made in the app were left alone.` : ''}${r.aliasesClaimedUpdated ? ` ${r.aliasesClaimedUpdated} updated names were already claimed; their runners' totals were adjusted.` : ''} Reload the app to see everything.`;
  });
  const doRecompute = () => run(async () => {
    const r = await onRecomputeRewards!(undefined, setProgress);
    return `Rewards recomputed for ${r.updated} members${r.failed.length ? `; ${r.failed.length} could not be updated (${r.failed.slice(0, 3).map((f) => f.reason).join(' ')})` : ''}.`;
  });

  const c = review?.commit.stats;
  return (
    <div className="space-y-2 rounded-lg border border-woodland-200 bg-white p-3">
      <p className="font-bold text-stone-900">Import into the club</p>
      <p className="text-stone-600">
        Choose any of the three files (run history first if you have it), review what would happen, then import. Importing the same file again changes nothing; an edited file updates what you edited. Nothing is ever deleted.
        People with an email get a profile; people without one are held as past names until they are claimed. Totals, badges, milestones and streaks are worked out from the check-ins afterwards.
      </p>
      {(['profiles', 'runs', 'checkins'] as ImportFileKind[]).map((k) => (
        <label key={k} className="block text-[11px] text-stone-600">
          {IMPORT_FILES[k].title} file
          <input type="file" accept=".csv,text/csv" aria-label={`${IMPORT_FILES[k].title} file to import`} disabled={busy}
            onChange={(e) => { setFiles((prev) => ({ ...prev, [k]: e.target.files?.[0] || null })); setReview(null); }} className="block w-full text-[11px] mt-0.5" />
        </label>
      ))}
      <button type="button" onClick={() => { void reviewFiles(); }} disabled={busy || !Object.values(files).some(Boolean)} className="px-3 py-1.5 bg-stone-800 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer">Review import</button>
      {c && review && (
        <div className="space-y-1" aria-label="Import review">
          <ul className="list-disc pl-5">
            <li><strong>{c.members}</strong> members (new ones get a profile; existing ones are updated only where the file gives a different value).</li>
            <li><strong>{c.runs}</strong> runs{c.placeholderRuns ? ` (${c.placeholderRuns} made for check-in dates the run history does not list)` : ''}.</li>
            <li><strong>{c.checkins}</strong> check-ins for members.</li>
            <li><strong>{c.aliases}</strong> past names held to claim, with <strong>{c.heldSignIns}</strong> dated sign-ins. No profile is made for them.</li>
          </ul>
          {review.errors > 0 && <p role="alert" className="font-semibold text-red-700">{review.errors} problem{review.errors === 1 ? '' : 's'} in the files. Fix them with the checker above first.</p>}
          {review.notes.length > 0 && <p className="text-amber-900">{review.notes.length} warning{review.notes.length === 1 ? '' : 's'} (see the checker above for details).</p>}
          <label className="flex items-start gap-2 text-stone-800">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy || review.errors > 0} className="mt-0.5" />
            <span>I have reviewed this. Write it to the club database.</span>
          </label>
          <button type="button" onClick={() => { void doImport(); }} disabled={busy || !confirmed || review.errors > 0 || !onImportClubData} className="px-3 py-1.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer">Import</button>
        </div>
      )}
      <div className="border-t border-stone-200 pt-2 space-y-1">
        <p className="font-semibold text-stone-900">Recompute rewards</p>
        <p className="text-stone-600">Rebuilds every member&apos;s totals, badges, streaks and reward proofs from their check-ins. Use it after changing the badge catalog. It does not create gear alerts.</p>
        <button type="button" onClick={() => { void doRecompute(); }} disabled={busy || !onRecomputeRewards} className="px-3 py-1.5 bg-white border border-stone-300 text-stone-800 font-bold rounded-lg hover:bg-stone-100 disabled:opacity-40 cursor-pointer">Recompute rewards for everyone</button>
      </div>
      {progress && <p role="status">{progress}</p>}
      {done && <p role="status" className="font-semibold text-emerald-800">{done}</p>}
      {problem && <p role="alert" className="font-semibold text-red-700">{problem}</p>}
    </div>
  );
};

export const UnifiedImportPanel: React.FC<PanelProps> = ({ specialEvents, onImportClubData, onRecomputeRewards }) => {
  const [shown, setShown] = useState<ImportFileKind>('profiles');
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState('');
  const [runsFile, setRunsFile] = useState<File | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);

  const check = async (file: File | null, runs: File | null = runsFile) => {
    setResult(null);
    setMessage('');
    setLastFile(file);
    if (!file) return;
    setReading(true);
    try {
      const text = await file.text();
      const kind = detectImportFile(text);
      if (!kind) { setMessage('I couldn’t tell what kind of file this is. It needs an Email or Name column, a Date column, or both.'); return; }
      setShown(kind);
      if (kind === 'profiles') setResult({ kind, plan: planProfilesImport(text) });
      else if (kind === 'runs') setResult({ kind, plan: planRunsImport(text, new Date(), specialEvents) });
      else {
        const known = runs ? planRunsImport(await runs.text(), new Date(), specialEvents).runs : [];
        setResult({ kind, plan: planCheckinsImport(text, known) });
      }
    } finally {
      setReading(false);
    }
  };

  const issues: ImportIssue[] = result ? result.plan.issues : [];
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const columns = Object.values(IMPORT_FILES[shown].columns);

  return (
    <details className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs">
      <summary className="font-bold text-stone-800 cursor-pointer select-none">Import formats: three files (examples + checker)</summary>
      <div className="mt-3 space-y-3 text-stone-700">
        <p>
          History comes in as up to <strong>three CSV files</strong>: <strong>Profiles</strong> (one row per person), <strong>Run history</strong> (one row per run) and{' '}
          <strong>Check-ins</strong> (one row per person per run). Totals are never imported: runs, miles, streaks, badges and milestones are worked out from the check-ins.
          People <strong>with an email</strong> become members; people <strong>without</strong> one become past aliases a runner can claim. Blank cells are left empty or get a sensible default.
        </p>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="File type">
          {(Object.keys(IMPORT_FILES) as ImportFileKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={shown === k}
              onClick={() => setShown(k)}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${shown === k ? 'bg-woodland-700 text-white' : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'}`}
            >
              {IMPORT_FILES[k].title}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-stone-900">{IMPORT_FILES[shown].title}: {IMPORT_FILES[shown].summary}</p>
          <button type="button" onClick={() => download(IMPORT_EXAMPLES[shown].filename, IMPORT_EXAMPLES[shown].csv)} className="px-3 py-1.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold rounded-lg transition cursor-pointer">
            Download {IMPORT_FILES[shown].title.toLowerCase()} example
          </button>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-2 py-1.5">Column</th>
                  <th className="px-2 py-1.5">Required?</th>
                  <th className="px-2 py-1.5">Meaning</th>
                  <th className="px-2 py-1.5">If blank</th>
                  <th className="px-2 py-1.5">Also accepted as</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 align-top">
                {columns.map((c) => (
                  <tr key={c.header}>
                    <td className="px-2 py-1.5 font-mono font-bold text-stone-900 whitespace-nowrap">{c.header}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap"><span className={c.required === 'no' ? 'text-stone-500' : 'font-bold text-amber-800'}>{requiredLabel(c.required)}</span></td>
                    <td className="px-2 py-1.5">{c.meaning}</td>
                    <td className="px-2 py-1.5">{c.whenBlank}</td>
                    <td className="px-2 py-1.5 font-mono text-stone-500">{c.aliases.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-stone-500">Columns a file has that aren&apos;t listed are ignored (for example total runs or total miles), so this app&apos;s own exports and the old-app files can be used as they are.</p>

        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="font-bold text-amber-900">Check a file (nothing is imported or saved)</p>
          <input type="file" accept=".csv,text/csv" aria-label="File to check" onChange={(e) => { void check(e.target.files?.[0] || null); }} className="block w-full text-[11px]" />
          <label className="block text-[11px] text-stone-600">
            For a check-ins file, optionally add the run history file so its dates can be matched to runs:
            <input type="file" accept=".csv,text/csv" aria-label="Run history file (optional)" onChange={(e) => { const f = e.target.files?.[0] || null; setRunsFile(f); if (lastFile) void check(lastFile, f); }} className="block w-full text-[11px] mt-1" />
          </label>
          {reading && <p role="status">Reading…</p>}
          {message && <p role="alert" className="font-semibold text-red-700">{message}</p>}
          {result && (
            <div className="space-y-2" aria-label="Import check">
              <p className="font-semibold text-stone-900">
                {IMPORT_FILES[result.kind].title} file. {errors.length ? `${errors.length} problem${errors.length === 1 ? '' : 's'} to fix. ` : 'Looks good. '}
                {result.plan.stats.rows} rows{result.plan.stats.skippedRows ? `, ${result.plan.stats.skippedRows} skipped` : ''}.
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {result.kind === 'profiles' && (
                  <>
                    <li><strong>{result.plan.members.length}</strong> people with an email (would become members){result.plan.stats.namesFromEmail ? `, ${result.plan.stats.namesFromEmail} named from their email` : ''}.</li>
                    <li><strong>{result.plan.aliases.length}</strong> names with no email (past aliases to claim).</li>
                    <li><strong>{result.plan.stats.noCheckInRuns}</strong> runs with no check-in record (added to run totals only).</li>
                  </>
                )}
                {result.kind === 'runs' && (
                  <>
                    <li><strong>{result.plan.runs.length}</strong> runs{result.plan.stats.earliest ? ` from ${result.plan.stats.earliest} to ${result.plan.stats.latest}` : ''}.</li>
                    {result.plan.stats.duplicateRuns > 0 && <li>{result.plan.stats.duplicateRuns} repeated runs dropped.</li>}
                    {Object.keys(result.plan.specialEvents).length > 0 && (
                      <li>Special events: {Object.entries(result.plan.specialEvents).map(([name, n]) => `${name} (${n})`).join(', ')}.</li>
                    )}
                    {result.plan.stats.timesDefaulted > 0 && <li>{result.plan.stats.timesDefaulted} with no start time (18:30 used).</li>}
                  </>
                )}
                {result.kind === 'checkins' && (
                  <>
                    <li><strong>{result.plan.checkins.length}</strong> check-ins{result.plan.stats.earliest ? ` from ${result.plan.stats.earliest} to ${result.plan.stats.latest}` : ''}{result.plan.stats.duplicateCheckIns ? `; ${result.plan.stats.duplicateCheckIns} repeats dropped` : ''}.</li>
                    <li><strong>{result.plan.members}</strong> people with an email, <strong>{result.plan.aliases}</strong> names with no email (past aliases).</li>
                    <li><strong>{Math.round(result.plan.stats.miles * 10) / 10}</strong> miles across the check-ins that gave miles.</li>
                    {runsFile && result.plan.datesWithoutRun.length > 0 && <li>{result.plan.datesWithoutRun.length} dates have no run in the run history; a placeholder run would be made for each.</li>}
                    {!runsFile && <li className="text-stone-500">No run history file added: each date would get its own run.</li>}
                  </>
                )}
                {result.plan.ignoredColumns.length > 0 && <li>Ignored columns: {result.plan.ignoredColumns.join(', ')}.</li>}
              </ul>
              {errors.length + warnings.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded bg-white p-2 border border-stone-200 space-y-0.5">
                  {[...errors, ...warnings].slice(0, 25).map((i, n) => (
                    <li key={n} className={i.level === 'error' ? 'text-red-700 font-semibold' : 'text-amber-900'}>
                      {i.row ? `Row ${i.row}: ` : ''}
                      {i.message}
                    </li>
                  ))}
                  {errors.length + warnings.length > 25 && <li className="text-stone-500">…and {errors.length + warnings.length - 25} more.</li>}
                </ul>
              )}
              <p className="text-stone-500">This only checks the file. To import, use &ldquo;Import into the club&rdquo; below.</p>
            </div>
          )}
        </div>

        <ImportRunner specialEvents={specialEvents} onImportClubData={onImportClubData} onRecomputeRewards={onRecomputeRewards} />
      </div>
    </details>
  );
};
