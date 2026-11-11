import React, { useState } from 'react';
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
export const UnifiedImportPanel: React.FC<{ specialEvents?: { id: string; name: string }[] }> = ({ specialEvents }) => {
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
              <p className="text-stone-500">This only checks the file. Importing in this format isn&apos;t switched on yet.</p>
            </div>
          )}
        </div>
      </div>
    </details>
  );
};
