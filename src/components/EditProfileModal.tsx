import React, { useId, useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { Modal } from './Modal';
import { calculateAge, localYmd } from '../utils/dateUtils';
import { X } from 'lucide-react';

interface EditProfileModalProps {
  user: UserProfile;
  onSave: (changes: {
    firstName: string;
    lastName: string;
    shirtSize: string;
    birthday?: string;
    city?: string;
    zipCode?: string;
    preferredPace?: string;
    emergencyContact?: { name: string; phone: string };
  }) => Promise<unknown>;
  onClose: () => void;
}

const PACES = [
  { value: '< 9:30 /mi', text: 'Pace 1 (< 9:30 /mi)' },
  { value: '9:30 - 11:00 /mi', text: 'Pace 2 (9:30 - 11:00 /mi)' },
  { value: '11:00+ /mi', text: 'Pace 3 (11:00+ /mi, jog/walk)' },
];

const SIZES: [string, string][] = [
  ['Not specified', 'Not specified'],
  ['Youth', 'Youth'],
  ['XS', 'Adult XS'],
  ['S', 'Adult S'],
  ['M', 'Adult M'],
  ['L', 'Adult L'],
  ['XL', 'Adult XL'],
  ['2XL', 'Adult 2XL'],
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onSave, onClose }) => {
  const id = useId();
  const [shirtSize, setShirtSize] = useState(user.shirtSize || 'Not specified');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [city, setCity] = useState(user.city || '');
  const [zipCode, setZipCode] = useState(user.zipCode || '');
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [contactName, setContactName] = useState(user.emergencyContact?.name || '');
  const [contactPhone, setContactPhone] = useState(user.emergencyContact?.phone || '');
  const [preferredPace, setPreferredPace] = useState(user.preferredPace || PACES[1].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const age = useMemo(() => calculateAge(birthday), [birthday]);

  const input = 'w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white';
  const label = 'block text-xs font-bold text-stone-700 mb-1';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ firstName, lastName, shirtSize, birthday: birthday || undefined, city, zipCode, preferredPace, emergencyContact: { name: contactName, phone: contactPhone } });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose} className="fixed inset-0 z-[1000] overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <form onSubmit={submit} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] px-6 py-5 text-white relative">
          <button type="button" aria-label="Close window" onClick={onClose} className="absolute top-4 right-4 p-2 text-stone-300 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-extrabold font-display">Edit profile</h2>
          <p className="text-xs text-woodland-200 mt-1">{user.displayName} · {user.email}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-first`} className={label}>First name *</label>
              <input id={`${id}-first`} required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor={`${id}-last`} className={label}>Last name *</label>
              <input id={`${id}-last`} required value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-stone-500">Your name shows on the leaderboard. Past check-ins keep the name you used at the time.</p>

          <div>
            <label htmlFor={`${id}-shirt`} className={label}>Shirt size (milestone gear)</label>
            <select id={`${id}-shirt`} value={shirtSize} onChange={(e) => setShirtSize(e.target.value)} className={`${input} font-bold`}>
              {SIZES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-stone-500">Your current size, used by organizers whenever club gear is handed out.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor={`${id}-birthday`} className="text-xs font-bold text-stone-700">Birthday</label>
              {age !== undefined && <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono">Age: {age}</span>}
            </div>
            <input id={`${id}-birthday`} type="date" value={birthday} max={localYmd()} onChange={(e) => setBirthday(e.target.value)} className={input} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-city`} className={label}>City</label>
              <input id={`${id}-city`} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Woodland" className={input} />
            </div>
            <div>
              <label htmlFor={`${id}-zip`} className={label}>Zip code</label>
              <input id={`${id}-zip`} value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="95695" className={input} />
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-pace`} className={label}>Preferred pace</label>
            <select id={`${id}-pace`} value={preferredPace} onChange={(e) => setPreferredPace(e.target.value)} className={`${input} font-bold`}>
              {!PACES.some((p) => p.value === preferredPace) && <option value={preferredPace}>{preferredPace}</option>}
              {PACES.map((p) => <option key={p.value} value={p.value}>{p.text}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-ecname`} className={label}>Emergency contact (optional)</label>
              <input id={`${id}-ecname`} value={contactName} maxLength={100} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className={input} />
            </div>
            <div>
              <label htmlFor={`${id}-ecphone`} className={label}>Contact phone</label>
              <input id={`${id}-ecphone`} type="tel" value={contactPhone} maxLength={30} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className={input} />
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-xl text-stone-700 hover:bg-stone-100">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-black rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
