// src/components/RemindersView.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, AlertTriangle, ClipboardCheck, Sun, X } from 'lucide-react';
import { useReminders } from '../hooks/useReminders';
import { useSessions } from '../hooks/useSessions';
import { useEnrollments } from '../hooks/useEnrollments';
import type { Reminder } from '../types';

type TabKey = 'active' | 'history';

const TYPE_ICONS: Record<Reminder['type'], React.ReactNode> = {
  pre_class: <Clock className="w-5 h-5" />,
  low_balance: <AlertTriangle className="w-5 h-5" />,
  unreviewed: <ClipboardCheck className="w-5 h-5" />,
  daily_digest: <Sun className="w-5 h-5" />,
};

const TYPE_ACCENTS: Record<Reminder['type'], { dot: string; icon: string; border: string }> = {
  pre_class: { dot: 'bg-blue-500', icon: 'text-blue-300', border: 'border-l-blue-500' },
  low_balance: { dot: 'bg-amber-500', icon: 'text-amber-300', border: 'border-l-amber-500' },
  unreviewed: { dot: 'bg-purple-500', icon: 'text-purple-300', border: 'border-l-purple-500' },
  daily_digest: { dot: 'bg-emerald-500', icon: 'text-emerald-300', border: 'border-l-emerald-500' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function RemindersView() {
  const navigate = useNavigate();
  const { reminders, history, loading, dismissReminder, dismissAll } = useReminders();
  const { sessions } = useSessions();
  const { enrollments } = useEnrollments();
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  const items = activeTab === 'active' ? reminders : history;
  const sortedItems = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleCardClick = (reminder: Reminder) => {
    switch (reminder.type) {
      case 'pre_class': {
        const session = sessions.find((s) => s.id === reminder.reference_id);
        if (session) {
          navigate('/calendar');
        }
        break;
      }
      case 'low_balance': {
        const enrollment = enrollments.find((e) => e.id === reminder.reference_id);
        if (enrollment) {
          navigate(`/students/${enrollment.studentId}`);
        }
        break;
      }
      case 'unreviewed':
        navigate('/review');
        break;
      case 'daily_digest':
        navigate('/calendar');
        break;
    }
  };

  const tabButtonClass = (tab: TabKey) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'bg-indigo-600 text-white'
        : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reminders</h2>
          <p className="text-sm text-slate-500">Stay on top of your schedule</p>
        </div>
        {reminders.length > 0 && (
          <button
            type="button"
            onClick={() => dismissAll()}
            className="text-sm text-slate-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
          >
            Dismiss all
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setActiveTab('active')} className={tabButtonClass('active')}>
          Active ({reminders.length})
        </button>
        <button type="button" onClick={() => setActiveTab('history')} className={tabButtonClass('history')}>
          History ({history.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-slate-500 dark:text-gray-400 py-12">Loading reminders...</div>
      ) : sortedItems.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
          <Bell className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-gray-400">No reminders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((reminder) => {
            const accent = TYPE_ACCENTS[reminder.type];
            const isHistory = activeTab === 'history';

            return (
              <div
                key={reminder.id}
                onClick={() => handleCardClick(reminder)}
                className={`group relative bg-slate-900 rounded-xl border border-slate-700 shadow-sm transition-all ${
                  isHistory
                    ? 'opacity-60 grayscale'
                    : 'hover:shadow-md cursor-pointer'
                }`}
              >
                <div className={`flex items-start gap-2.5 pl-3 pr-2 py-3 rounded-lg bg-slate-800/60 border border-slate-700 border-l-2 m-1.5 ${accent.border}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${accent.dot}`} />
                  <span className={`mt-0.5 shrink-0 ${accent.icon}`}>{TYPE_ICONS[reminder.type]}</span>

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm truncate ${isHistory ? 'text-slate-500' : 'text-slate-100'}`}>
                      {reminder.title}
                    </h3>
                    {reminder.body && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {reminder.body}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1.5">
                      {formatRelativeTime(reminder.created_at)}
                    </p>
                  </div>

                  {!isHistory && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissReminder(reminder.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                      aria-label="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
