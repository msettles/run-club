import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { RunEvent, Member, Badge } from '../types';
import { CheckCircle, Award, X, Sparkles, QrCode } from 'lucide-react';

interface CheckInModalProps {
  run: RunEvent;
  members: Member[];
  currentMember: Member;
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: (payload: { runId: string; memberId: string; memberName: string }) => Promise<{ newBadges: Badge[] }>;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  run,
  members,
  currentMember,
  isOpen,
  onClose,
  onCheckIn,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentMember.id);
  const [justCheckedIn, setJustCheckedIn] = useState<boolean>(false);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  const [showQR, setShowQR] = useState<boolean>(false);

  if (!isOpen) return null;

  const isAlreadyCheckedIn = run.attendees.some(
    (a) => a.memberId === selectedMemberId && a.checkedIn
  );

  const handlePerformCheckIn = async () => {
    const member = members.find((m) => m.id === selectedMemberId) || currentMember;

    // Trigger celebratory woodchuck confetti!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#15803d', '#d97706', '#f59e0b', '#22c55e', '#84cc16'],
    });

    const result = await onCheckIn({
      runId: run.id,
      memberId: member.id,
      memberName: member.name,
    });

    setNewBadges(result.newBadges || []);
    setJustCheckedIn(true);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-woodland-900 to-woodland-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦫</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Run Day Check-In</h3>
              <p className="text-xs text-woodland-200">{run.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-woodland-200 hover:text-white hover:bg-woodland-600/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {justCheckedIn ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-woodland-100 text-woodland-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-woodland-50">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-stone-900">You&apos;re Checked In!</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Attendance &amp; +{run.distanceMiles} miles added to your Woodchuckers log.
                </p>
              </div>

              {/* Badges unlocked animation */}
              {newBadges.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>New Woodchuck Badge Earned!</span>
                  </div>
                  {newBadges.map((badge) => (
                    <div key={badge.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-100">
                      <span className="text-2xl">{badge.emoji}</span>
                      <div>
                        <div className="text-sm font-bold text-stone-900">{badge.name}</div>
                        <div className="text-xs text-stone-500">{badge.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-woodland-600 text-white rounded-xl font-semibold text-sm hover:bg-woodland-700 shadow-md transition"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Select Runner Name:
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-woodland-500 bg-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.totalRuns} runs logged)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 text-xs text-stone-600 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Run Distance:</span>
                  <span className="font-semibold text-stone-800">{run.distanceMiles} miles</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Meeting Location:</span>
                  <span className="font-semibold text-stone-800">{run.locationName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Surface:</span>
                  <span className="font-semibold text-stone-800">{run.surface}</span>
                </div>
              </div>

              {isAlreadyCheckedIn ? (
                <div className="p-3 bg-woodland-50 border border-woodland-200 rounded-xl text-woodland-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-woodland-600 shrink-0" />
                  <span>This runner is already checked in for today&apos;s run!</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePerformCheckIn}
                  className="w-full py-3 bg-woodland-600 text-white rounded-xl font-bold text-sm hover:bg-woodland-700 shadow-md transition flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  <span>Check In &amp; Log Attendance</span>
                </button>
              )}

              {/* Digital Check-In QR option */}
              <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="text-xs text-stone-500 hover:text-woodland-700 flex items-center gap-1 font-medium"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQR ? 'Hide Check-In QR' : 'Show Event Check-In QR'}</span>
                </button>
                <span className="text-[11px] text-stone-400">Zero-cost local check-in</span>
              </div>

              {showQR && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center">
                  <div className="w-32 h-32 bg-white border border-stone-300 rounded-lg mx-auto flex items-center justify-center p-2 shadow-inner">
                    {/* Simulated SVG QR Code */}
                    <svg viewBox="0 0 100 100" className="w-full h-full text-stone-800 fill-current">
                      <rect x="10" y="10" width="25" height="25" />
                      <rect x="15" y="15" width="15" height="15" fill="#fff" />
                      <rect x="18" y="18" width="9" height="9" />
                      
                      <rect x="65" y="10" width="25" height="25" />
                      <rect x="70" y="15" width="15" height="15" fill="#fff" />
                      <rect x="73" y="18" width="9" height="9" />

                      <rect x="10" y="65" width="25" height="25" />
                      <rect x="15" y="70" width="15" height="15" fill="#fff" />
                      <rect x="18" y="73" width="9" height="9" />

                      <rect x="42" y="15" width="12" height="6" />
                      <rect x="42" y="27" width="8" height="12" />
                      <rect x="15" y="42" width="18" height="6" />
                      <rect x="42" y="45" width="16" height="16" />
                      <rect x="65" y="42" width="10" height="8" />
                      <rect x="78" y="55" width="12" height="12" />
                      <rect x="42" y="68" width="10" height="16" />
                      <rect x="58" y="72" width="22" height="10" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-2">
                    Runners can scan with camera to open check-in directly!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
