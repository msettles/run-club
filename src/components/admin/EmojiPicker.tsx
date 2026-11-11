import React from 'react';
import { emojiKey, emojiTakenMessage } from '../../utils/emoji';

const GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Mascot/Run:', emojis: ['🦫', '🐕', '🐶', '🐾', '🏃', '🚶', '👟', '🎽', '⏱️', '🏅', '🏆', '🥇', '🥈', '🥉'] },
  { label: 'Gear:', emojis: ['👕', '🧢', '🧦', '🧥', '🍶', '🥤', '🎒', '📌', '🎁', '🪙', '📏'] },
  { label: 'Themes:', emojis: ['🦃', '🎃', '🎂', '🍀', '🎄', '🎅', '🎆', '🐰', '🇺🇸', '💘', '🤠', '🕶️'] },
  { label: 'Routes:', emojis: ['1️⃣', '3️⃣', '5️⃣', '🗺️', '🧭', '🌲', '🏔️', '🛣️', '🏙️', '🌉', '🌊', '☀️'] },
  { label: 'Brewery:', emojis: ['🍺', '🍻', '🥂', '🍷', '🍕', '🌮', '🥨', '🍩', '☕', '🍔', '🌭'] },
  { label: 'Streaks:', emojis: ['🔥', '⚡', '🌟', '⭐', '💥', '🚀', '🦾', '👑', '🎉'] },
];

/** Emoji chooser used by the badge and milestone forms: tap a quick pick, or type / paste your own. */
export const EmojiPicker: React.FC<{
  value: string;
  onChange: (emoji: string) => void;
  title: string;
  fallback?: string;
  required?: boolean;
  placeholder?: string;
  /** Emoji already used by another badge or milestone (key -> who). Those quick picks are disabled. */
  taken?: Map<string, string>;
}> = ({ value, onChange, title, fallback = '🏅', required = false, placeholder = 'e.g. 🍀, 🎽, 🎄', taken = new Map() }) => (
  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
        <span>🎨</span>
        <span>{title}</span>
      </span>
      <span className="text-[11px] text-stone-500">Tap any emoji below or type custom</span>
    </div>

    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-white border-2 border-amber-400 flex items-center justify-center text-3xl shadow-sm shrink-0">
        {value || fallback}
      </div>
      <div className="flex-1">
        <label className="block text-[11px] font-bold text-stone-600 mb-0.5" htmlFor="emoji-picker-input">
          Selected Emoji (or paste from phone)
        </label>
        <input
          id="emoji-picker-input"
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-bold bg-white outline-none focus:border-amber-500"
          maxLength={8}
        />
        {value && emojiTakenMessage(value, taken) && (
          <p role="alert" className="mt-1 text-[11px] font-semibold text-amber-900">{emojiTakenMessage(value, taken)}</p>
        )}
      </div>
    </div>

    <div className="pt-2 border-t border-stone-200 space-y-1.5">
      <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider block">Quick picks:</span>
      {GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-stone-500 w-16 shrink-0">{group.label}</span>
          {group.emojis.map((emoji) => {
            const owner = taken.get(emojiKey(emoji));
            return (
            <button
              key={`${group.label}${emoji}`}
              type="button"
              aria-label={owner ? `${emoji} is used by ${owner}` : `Use ${emoji}`}
              title={owner ? `Used by ${owner}` : undefined}
              disabled={Boolean(owner)}
              onClick={() => onChange(emoji)}
              className={`w-7 h-7 text-base rounded-lg border flex items-center justify-center transition ${
                owner ? 'opacity-30 cursor-not-allowed bg-stone-100 border-stone-200' : 'cursor-pointer'
              } ${
                value === emoji ? 'bg-amber-300 border-amber-500 scale-110 shadow-xs' : owner ? '' : 'bg-white border-stone-200 hover:bg-stone-100'
              }`}
            >
              {emoji}
            </button>
            );
          })}
        </div>
      ))}
    </div>
  </div>
);
