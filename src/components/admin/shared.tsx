/** Shared admin-dashboard helpers: roles, runner picker, CSV download. */
import React, { useState } from 'react';
import type { UserProfile } from '../../types';
import { ADMIN_EMAILS } from '../../utils/roles';

export type AssignableRole = 'member' | 'organizer' | 'admin';

export const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'member', label: 'Runner' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'admin', label: 'Admin' },
];

export const ROLE_BADGE: Record<AssignableRole, string> = {
  member: 'bg-stone-100 text-stone-700',
  organizer: 'bg-cyan-100 text-cyan-800',
  admin: 'bg-amber-100 text-amber-800',
};

export const effectiveRole = (u: UserProfile): AssignableRole =>
  ADMIN_EMAILS.includes(u.email.toLowerCase()) || u.role === 'admin'
    ? 'admin'
    : u.role === 'organizer'
      ? 'organizer'
      : 'member';

/** Searchable runner picker (the roster can get long). */
export const RunnerPicker: React.FC<{
  users: UserProfile[];
  excludeEmail?: string;
  label: string;
  disabled?: boolean;
  onPick: (email: string) => void;
}> = ({ users, excludeEmail, label, disabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const matches = users
    .filter((u) => u.email !== excludeEmail)
    .filter((u) => !query || u.displayName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    .slice(0, 8);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="px-2 py-1 text-[11px] font-semibold border rounded-lg bg-white hover:bg-stone-50 disabled:opacity-50"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="relative w-52">
      <input
        type="search"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setQ('');
          }
        }}
        placeholder="Search runners…"
        aria-label="Search runners to assign"
        className="w-full px-2 py-1 text-[11px] border rounded-lg outline-none focus:ring-2 focus:ring-woodland-500"
      />
      <ul className="mt-1 w-full max-h-56 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg text-[11px]" role="listbox">
        {matches.length === 0 ? (
          <li className="px-2 py-1.5 text-stone-500 italic">No runners match</li>
        ) : (
          matches.map((u) => (
            <li key={u.email} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQ('');
                  onPick(u.email);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-stone-100"
              >
                <span className="font-semibold text-stone-900">{u.displayName}</span>
                <span className="block text-stone-500 truncate">{u.email}</span>
              </button>
            </li>
          ))
        )}
        <li>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQ('');
            }}
            className="w-full text-left px-2 py-1.5 text-stone-500 hover:bg-stone-100 border-t border-stone-100"
          >
            Cancel
          </button>
        </li>
      </ul>
    </div>
  );
};

type CsvCell = string | number | boolean | null | undefined;

/**
 * One CSV cell (RFC 4180): quoted when it holds a comma, quote or line break,
 * with quotes doubled. Text starting with = + - @ (or a tab/CR) gets a leading
 * apostrophe so spreadsheets show it instead of running it as a formula.
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build a CSV file (header row + rows) and download it. */
export function downloadCSV(headers: string[], rows: CsvCell[][], filename: string): void {
  const content = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  // Leading BOM so Excel reads names with accents correctly.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
