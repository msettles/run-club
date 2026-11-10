import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  CheckCircle, 
  Send, 
  Trash2,
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';

export const NotificationsTab: React.FC<AdminDashboardProps> = (props) => {
  const {
    notifications,
    onSendBroadcast,
    onCountPushDevices,
    onDeleteAnnouncement,
  } = props;
  const [notifTitle, setNotifTitle] = useState<string>('🦫 Run Tonight: Wednesday Code Word!');
  const [notifBody, setNotifBody] = useState<string>('Meet at 6:00 PM on Blue Note Brewing patio. Check-in is live!');
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);
  const [pushCountError, setPushCountError] = useState(false);
  const [pushDeviceCount, setPushDeviceCount] = useState<number | null>(null);
  useEffect(() => {
    if (!onCountPushDevices) return;
    onCountPushDevices()
      .then(setPushDeviceCount)
      .catch((err) => {
        console.warn('Counting push devices failed:', err);
        setPushCountError(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    Promise.resolve(onSendBroadcast(notifTitle, notifBody))
      .then(() => {
        setBroadcastSent(true);
        setTimeout(() => setBroadcastSent(false), 4000);
      })
      .catch((err: any) => {
        console.error('Announcement failed:', err);
        alert(
          err?.code === 'permission-denied'
            ? 'Not posted: only admins can post announcements.'
            : "The announcement couldn't be posted. Please check your connection and try again."
        );
      });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2 bg-amber-50 rounded-2xl p-6 border border-amber-200 space-y-3 text-xs text-stone-700">
        <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-amber-600" />
          <span>Phone notifications</span>
        </h4>
        <p>
          {pushCountError ? 'Notification device registrations could not be loaded.' : <><strong>{pushDeviceCount === null ? '…' : pushDeviceCount}</strong> registered notification device{pushDeviceCount === 1 ? '' : 's'}</>}
          (signed-in runners only). Being signed in isn&apos;t enough: each runner turns them on per device with{' '}
          <strong>Enable Alerts</strong> in the top banner, or in their profile menu under <strong>Notifications on this device</strong>.
          iPhones must add the app to their Home Screen first.
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Open{' '}
            <a
              href="https://console.firebase.google.com/project/woodland-woodchuckers/messaging"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-woodland-700 underline"
            >
              Firebase console → Messaging
            </a>{' '}
            and click <strong>New campaign → Notifications</strong>.
          </li>
          <li>Enter the title and text, then <strong>Next</strong>.</li>
          <li>Under <strong>Target</strong>, choose <strong>User segment</strong> and select the Woodchuckers <strong>web</strong> app.</li>
          <li>Schedule <strong>Now</strong> and <strong>Review → Publish</strong>.</li>
        </ol>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
        <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
          <Send className="w-4 h-4 text-woodland-600" />
          <span>Post Announcement</span>
        </h4>
        <p className="text-xs text-stone-500">
          Posts to the in-app announcement feed. To reach phones, also send it from the Firebase console (see below).
        </p>

        {broadcastSent && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Posted to the in-app announcement feed.</span>
          </div>
        )}

        <form onSubmit={handleSendBroadcast} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Notification Title:
            </label>
            <input
              type="text"
              required
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 border rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Alert Message:
            </label>
            <textarea
              rows={3}
              required
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              className="w-full text-sm px-3 py-2 border rounded-xl outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              <Send className="w-4 h-4" />
              <span>Post Announcement</span>
            </button>
          </div>
        </form>
      </div>

      {/* Broadcast History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-3">
        <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-amber-500" />
          <span>Announcement Feed</span>
        </h4>

        <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-stone-400 py-4 text-center">No announcements posted yet.</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-stone-900 font-bold">{n.title}</strong>
                  <span className="flex items-center gap-2 text-[10px] text-stone-400">
                    {new Date(n.timestamp).toLocaleDateString()}
                    {onDeleteAnnouncement && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete "${n.title}" from everyone's announcements?`)) return;
                          onDeleteAnnouncement(n.id).catch((err) => {
                            console.error('Deleting announcement failed:', err);
                            window.alert("Couldn't delete that announcement. Please try again.");
                          });
                        }}
                        aria-label={`Delete announcement ${n.title}`}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="text-stone-600 leading-relaxed">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
