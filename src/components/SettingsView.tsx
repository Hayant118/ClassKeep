import { useEffect, useState } from 'react';
import type { CalendarPreferences } from '../types';
import { Bell, Clock, AlertTriangle, ClipboardCheck, Sun } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences';
import { useReminderSettings } from '../hooks/useReminderSettings';
import { useStudents } from '../hooks/useStudents';
import { useClasses } from '../hooks/useClasses';
import { getSessionColor, type SessionWithOverlap } from '../utils/calendar';
import { CURATED_PALETTE, normalizeColor } from '../utils/colors';

const SLOT_OPTIONS = [15, 30, 60];

const SAMPLE_SESSIONS: SessionWithOverlap[] = [
  {
    id: 'sample-1',
    userId: 'sample',
    classId: 'sample-class',
    plannedDate: new Date().toISOString().slice(0, 10),
    plannedTime: '09:00',
    actualDate: null,
    actualTime: null,
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: null,
    status: 'scheduled',
    movedFromDate: null,
    movedFromTime: null,
    notes: 'Confirmed/scheduled preview',
    createdAt: new Date().toISOString(),
    hasOverlap: false,
  },
  {
    id: 'sample-2',
    userId: 'sample',
    classId: 'sample-class',
    plannedDate: new Date().toISOString().slice(0, 10),
    plannedTime: '09:00',
    actualDate: null,
    actualTime: null,
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: null,
    status: 'moved',
    movedFromDate: null,
    movedFromTime: null,
    notes: 'Moved preview',
    createdAt: new Date().toISOString(),
    hasOverlap: false,
  },
  {
    id: 'sample-3',
    userId: 'sample',
    classId: 'sample-class',
    plannedDate: new Date().toISOString().slice(0, 10),
    plannedTime: '09:00',
    actualDate: null,
    actualTime: null,
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: null,
    status: 'cancelled',
    movedFromDate: null,
    movedFromTime: null,
    notes: 'Cancelled preview',
    createdAt: new Date().toISOString(),
    hasOverlap: false,
  },
  {
    id: 'sample-4',
    userId: 'sample',
    classId: 'sample-class',
    plannedDate: new Date().toISOString().slice(0, 10),
    plannedTime: '09:00',
    actualDate: null,
    actualTime: null,
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: null,
    status: 'scheduled',
    movedFromDate: null,
    movedFromTime: null,
    notes: 'Draft preview (shown as scheduled)',
    createdAt: new Date().toISOString(),
    hasOverlap: false,
  },
  {
    id: 'sample-5',
    userId: 'sample',
    classId: 'sample-class',
    plannedDate: new Date().toISOString().slice(0, 10),
    plannedTime: '09:00',
    actualDate: null,
    actualTime: null,
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: null,
    status: 'scheduled',
    movedFromDate: null,
    movedFromTime: null,
    notes: 'Conflict preview',
    createdAt: new Date().toISOString(),
    hasOverlap: true,
  },
];

const DEFAULT_COLORS: Record<string, string> = {
  colorConfirmed: '#22c55e',
  colorMoved: '#f97316',
  colorCancelled: '#6b7280',
  colorDraft: '#3b82f6',
  colorConflict: '#ef4444',
};

function ColorEditor({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const safeValue = normalizeColor(value) || '#e2e8f0';

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-8 h-8 rounded-full border-2 border-white shadow-sm ring-2 ring-slate-200"
          style={{ backgroundColor: safeValue }}
          aria-label="Edit color"
        />
        {open && (
          <div className="absolute top-10 right-0 z-20 bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex flex-wrap gap-2 w-44">
            {CURATED_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                className={`w-7 h-7 rounded-full border ${safeValue === c ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200'}`}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
            <input
              type="color"
              value={safeValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 p-0 cursor-pointer"
              aria-label="Custom color"
            />
          </div>
        )}
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

export function SettingsView() {
  const { preferences, setPreferences } = usePreferences();
  const { settings, updateSettings } = useReminderSettings();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      await updateSettings({ browserNotificationsEnabled: true });
    }
  };

  const updateColor = (key: keyof CalendarPreferences, value: string) => {
    if (key.startsWith('color')) {
      setPreferences({ [key]: value } as Partial<CalendarPreferences>);
    }
  };

  const updateTimeScale = (key: 'calendarStartTime' | 'calendarEndTime' | 'calendarSlotMinutes', value: string | number) => {
    setPreferences({ [key]: value } as Partial<CalendarPreferences>);
  };

  const resetColors = () => {
    setPreferences({
      colorConfirmed: DEFAULT_COLORS.colorConfirmed,
      colorMoved: DEFAULT_COLORS.colorMoved,
      colorCancelled: DEFAULT_COLORS.colorCancelled,
      colorDraft: DEFAULT_COLORS.colorDraft,
      colorConflict: DEFAULT_COLORS.colorConflict,
    });
  };

  const resetTimeScale = () => {
    setPreferences({
      calendarStartTime: '08:00:00',
      calendarEndTime: '22:00:00',
      calendarSlotMinutes: 30,
    });
  };

  const timeScaleValid = preferences.calendarEndTime > preferences.calendarStartTime;

  const { students, updateStudent: updateStudentColor } = useStudents();
  const { classes, updateClass: updateClassColor } = useClasses();

  const colorKeys: (keyof CalendarPreferences)[] = [
    'colorConfirmed',
    'colorMoved',
    'colorCancelled',
    'colorDraft',
    'colorConflict',
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Color Scheme</h2>
          <button
            type="button"
            onClick={resetColors}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Reset colors
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colorKeys.map((key) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 capitalize">
                {key.replace('color', '')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={preferences[key] as string}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="h-10 w-16 rounded cursor-pointer border border-slate-300 p-1"
                />
                <input
                  type="text"
                  value={preferences[key] as string}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Preview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {SAMPLE_SESSIONS.map((session) => (
              <div
                key={session.id}
                className="rounded-md px-3 py-2 text-xs text-white shadow-sm"
                style={{ backgroundColor: getSessionColor(session, []) }}
              >
                <div className="font-semibold truncate">Sample Student</div>
                <div className="opacity-90">09:00 - 10:00</div>
                <div className="opacity-80">{session.notes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Colors</h2>
          <p className="text-sm text-slate-500">Click a swatch to edit</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Students</h3>
            {students.length === 0 ? (
              <p className="text-sm text-slate-500">No students yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ColorEditor
                        value={student.color}
                        onChange={(color) => updateStudentColor(student.id, { color })}
                      />
                      <span className="text-sm text-slate-700 truncate">{student.name}</span>
                    </div>
                    {student.familyGroup && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                        {student.familyGroup}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Classes</h3>
            {classes.length === 0 ? (
              <p className="text-sm text-slate-500">No classes yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ColorEditor
                        value={cls.color}
                        onChange={(color) => updateClassColor(cls.id, { color })}
                      />
                      <span className="text-sm text-slate-700 truncate">{cls.name}</span>
                    </div>
                    <span className="text-xs text-slate-500 capitalize">{cls.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Time Scale</h2>
          <button
            type="button"
            onClick={resetTimeScale}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Reset time scale
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
            <input
              type="time"
              value={preferences.calendarStartTime.slice(0, 5)}
              onChange={(e) => updateTimeScale('calendarStartTime', e.target.value + ':00')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
            <input
              type="time"
              value={preferences.calendarEndTime.slice(0, 5)}
              onChange={(e) => updateTimeScale('calendarEndTime', e.target.value + ':00')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slot increment</label>
            <select
              value={preferences.calendarSlotMinutes}
              onChange={(e) => updateTimeScale('calendarSlotMinutes', parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {SLOT_OPTIONS.map((mins) => (
                <option key={mins} value={mins}>
                  {mins} minutes
                </option>
              ))}
            </select>
          </div>
        </div>

        {!timeScaleValid && (
          <p className="text-sm text-red-600 mt-4">
            End time must be after start time.
          </p>
        )}
        <p className="text-sm text-slate-500 mt-4">
          Calendar will show slots from {preferences.calendarStartTime.slice(0, 5)} to {preferences.calendarEndTime.slice(0, 5)} in{' '}
          {preferences.calendarSlotMinutes}-minute increments.
        </p>
      </div>

      {/* Reminders */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Reminders</h2>
        </div>

        <div className="space-y-5">
          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">Pre-class alerts</span>
              </div>
              <input
                type="checkbox"
                checked={settings.preClassEnabled}
                onChange={(e) => updateSettings({ preClassEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">Low balance alerts</span>
              </div>
              <input
                type="checkbox"
                checked={settings.lowBalanceEnabled}
                onChange={(e) => updateSettings({ lowBalanceEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">Unreviewed sessions</span>
              </div>
              <input
                type="checkbox"
                checked={settings.unreviewedEnabled}
                onChange={(e) => updateSettings({ unreviewedEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">Daily digest</span>
              </div>
              <input
                type="checkbox"
                checked={settings.dailyDigestEnabled}
                onChange={(e) => updateSettings({ dailyDigestEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </label>
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Pre-class minutes</label>
              <select
                value={settings.preClassMinutes}
                onChange={(e) => updateSettings({ preClassMinutes: parseInt(e.target.value, 10) })}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Low balance threshold (¥)</label>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.lowBalanceThreshold}
                onChange={(e) => updateSettings({ lowBalanceThreshold: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Daily digest time</label>
              <input
                type="time"
                value={settings.dailyDigestTime}
                onChange={(e) => updateSettings({ dailyDigestTime: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Browser notifications */}
          <div className="p-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-white">Browser notifications</div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Status: {notificationPermission === 'granted' ? 'Permission granted' : notificationPermission === 'denied' ? 'Permission denied' : 'Permission not requested'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.browserNotificationsEnabled}
                    onChange={(e) => updateSettings({ browserNotificationsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                </label>
                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md transition-colors"
                  >
                    Request permission
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}