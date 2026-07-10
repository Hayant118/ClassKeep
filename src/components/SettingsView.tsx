import type { CalendarPreferences } from '../types';
import { usePreferences } from '../hooks/usePreferences';
import { getSessionColor, type SessionWithOverlap } from '../utils/calendar';

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

export function SettingsView() {
  const { preferences, setPreferences } = usePreferences();

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
    </div>
  );
}