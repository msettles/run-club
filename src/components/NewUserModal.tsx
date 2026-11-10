import { Modal } from './Modal';
import React, { useState, useMemo } from 'react';
import { X, CheckCircle, ShieldCheck, Sparkles, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { LegacyMember, UserProfile } from '../types';
import { calculateAge, localYmd } from '../utils/dateUtils';
import { isLegacyClaimed, matchLegacyNames } from '../utils/legacy';

interface NewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  initialDisplayName?: string;
  legacyMembers: LegacyMember[];
  onRegisterUser: (
    profileData: {
      email: string;
      firstName: string;
      lastName: string;
      shirtSize: string;
      birthday?: string;
      age?: number;
      city?: string;
      zipCode?: string;
      preferredPace?: string;
    },
    claimedLegacyIds: string[]
  ) => Promise<UserProfile>;
  onSuccess: (user: UserProfile) => void;
}

export const NewUserModal: React.FC<NewUserModalProps> = ({
  isOpen,
  onClose,
  email,
  initialDisplayName = '',
  legacyMembers,
  onRegisterUser,
  onSuccess,
}) => {
  // Parse initial names from displayName
  const parsedNames = useMemo(() => {
    const parts = (initialDisplayName || '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return { first: parts[0], last: parts.slice(1).join(' ') };
    }
    if (parts.length === 1 && parts[0]) {
      return { first: parts[0], last: '' };
    }
    return { first: '', last: '' };
  }, [initialDisplayName]);

  const [firstName, setFirstName] = useState<string>(parsedNames.first);
  const [lastName, setLastName] = useState<string>(parsedNames.last);
  const [shirtSize, setShirtSize] = useState<string>('L');
  const [preferredPace, setPreferredPace] = useState<string>('9:30 - 11:00 /mi');
  const [birthday, setBirthday] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('95695');

  const computedAge = useMemo(() => calculateAge(birthday), [birthday]);

  // Search query for legacy names (defaults to the full name; matching is typo tolerant)
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return `${parsedNames.first} ${parsedNames.last}`.trim();
  });

  // Selected legacy records to merge (keyed on legacy member ID)
  const [selectedRecords, setSelectedRecords] = useState<Map<string, LegacyMember>>(new Map());

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fuzzy matches among unclaimed legacy names (e.g. "Matt Settles" also finds MATT SETTLED)
  const searchResults = useMemo(
    () => matchLegacyNames(searchQuery, legacyMembers.filter((m) => !isLegacyClaimed(m))),
    [searchQuery, legacyMembers]
  );

  if (!isOpen) return null;

  const handleToggleRecord = (record: LegacyMember) => {
    setSelectedRecords((prev) => {
      const next = new Map(prev);
      if (next.has(record.id)) {
        next.delete(record.id);
      } else {
        next.set(record.id, record);
      }
      return next;
    });
  };

  const handleRemoveRecord = (id: string) => {
    setSelectedRecords((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedList = Array.from(selectedRecords.values());
  const totalRunsToClaim = selectedList.reduce((sum, r) => sum + r.totalRuns, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Please enter your first and last name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const claimedIds = selectedList.map((r) => r.id);
      const newUser = await onRegisterUser(
        {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          shirtSize,
          birthday: birthday || undefined,
          age: computedAge,
          city: 'Woodland',
          zipCode: zipCode.trim() || '95695',
          preferredPace,
        },
        claimedIds
      );

      onSuccess(newUser);
      onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err?.user) {
        // Profile was created; only some old profiles couldn't be claimed.
        onSuccess(err.user);
        onClose();
        window.alert(err.message);
        return;
      }
      setErrorMsg(err.message || 'Failed to complete profile registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Runner profile" onClose={onClose} className="fixed inset-0 z-[1000] overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] px-6 py-5 text-white relative">
          <button aria-label="Close window"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-stone-300 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Welcome Runner!</span>
          </div>
          <h2 className="text-xl font-display font-black tracking-wide uppercase text-white">
            Create Your Woodchucker Profile
          </h2>
          <p className="text-xs text-woodland-200 mt-0.5">
            Set up your club account to log runs, earn milestone awards, and join the leaderboard.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Verified Email Badge */}
          <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Verified Account Email
                </span>
                <span className="text-xs font-bold font-mono text-emerald-950">{email}</span>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
              Authenticated
            </span>
          </div>

          {/* First & Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Matt"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Settles"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Shirt Size & Pace Preference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Shirt Size (Milestones) *</label>
              <select
                value={shirtSize}
                onChange={(e) => setShirtSize(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
              >
                <option value="Youth">Youth</option>
                <option value="XS">Adult XS</option>
                <option value="S">Adult S</option>
                <option value="M">Adult M</option>
                <option value="L">Adult L</option>
                <option value="XL">Adult XL</option>
                <option value="2XL">Adult 2XL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Preferred Pace</label>
              <select
                value={preferredPace}
                onChange={(e) => setPreferredPace(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
              >
                <option value="< 9:30 /mi">Pace 1 (&lt; 9:30 /mi)</option>
                <option value="9:30 - 11:00 /mi">Pace 2 (9:30 - 11:00 /mi)</option>
                <option value="11:00+ /mi">Pace 3 (11:00+ /mi, jog/walk)</option>
              </select>
            </div>
          </div>

          {/* Optional Birthday & Zip Code */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-stone-700">Birthday (Optional)</label>
                {computedAge !== undefined && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                    Age: {computedAge}
                  </span>
                )}
              </div>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={localYmd()}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Zip Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="95695"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          {/* HISTORICAL RUN MERGE SECTION */}
          <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                  Historical Run Records &amp; Merge
                </h4>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Claim your past group runs from our 2021–2026 club records to unlock milestone shirts &amp; badges.
                </p>
              </div>
            </div>

            {/* Pinned Selected Records Box */}
            {selectedList.length > 0 && (
              <div className="bg-amber-100/90 border-2 border-amber-400 rounded-2xl p-3 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-black text-amber-950">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    <span>Selected to Merge ({selectedList.length} records):</span>
                  </span>
                  <span className="bg-amber-300 text-stone-950 font-mono text-[11px] font-black px-2.5 py-0.5 rounded-full">
                    +{totalRunsToClaim} past runs
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedList.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white border border-amber-300 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black">✓</span>
                        <span className="font-bold text-stone-900">{rec.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-600 text-[11px] font-mono font-bold">
                          {rec.totalRuns} runs
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRecord(rec.id)}
                          className="text-stone-400 hover:text-red-600 p-1 hover:bg-stone-100 rounded transition cursor-pointer"
                          title="Remove from merge list"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Input for Historical Records */}
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">
                Search Historical Names Pool
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type your name or variations (e.g. Settles, Matt)..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
                />
              </div>
            </div>

            {/* Search Results List */}
            {searchResults.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {searchResults.map((rec) => {
                  const isChecked = selectedRecords.has(rec.id);
                  return (
                    <label
                      key={rec.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-amber-100 border-amber-400 font-bold text-stone-900'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRecord(rec)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 cursor-pointer"
                        />
                        <span>{rec.name}</span>
                      </div>
                      <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded-md font-bold text-stone-700">
                        {rec.totalRuns} past runs
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : searchQuery.trim().length >= 2 ? (
              <div className="text-center py-3 text-stone-400 text-xs italic bg-white rounded-xl border border-stone-200">
                No unclaimed records matching &quot;{searchQuery}&quot; found.
              </div>
            ) : (
              <p className="text-[11px] text-stone-400 italic">
                Enter at least 2 characters to search the historical pool.
              </p>
            )}
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs rounded-xl shadow-sm transition active:scale-98 font-display uppercase tracking-wider cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <span>Complete Profile &amp; Join Club</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
