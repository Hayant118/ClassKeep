import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { AccentTheme, CalendarPreferences, ColorPaletteName, LanguagePreference, ThemePreference } from '../types';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CreditCard,
  Download,
  FileText,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePreferences } from '../hooks/usePreferences';
import { useReminderSettings } from '../hooks/useReminderSettings';
import { getLanguage, saveLanguage } from '../storage';
import { getSessionColor, type SessionWithOverlap } from '../utils/calendar';
import { COLOR_PALETTES } from '../utils/colors';
import { COMMON_TIMEZONES, getDisplayTimezone, setDisplayTimezone } from '../utils/timezone';
import { TimePicker } from './TimePicker';

const SLOT_OPTIONS = [15, 30, 60];

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
];

const ACCENT_OPTIONS: { value: AccentTheme; label: string; swatch: string }[] = [
  { value: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { value: 'emerald', label: 'Emerald', swatch: '#059669' },
  { value: 'amber', label: 'Amber', swatch: '#d97706' },
];

const PALETTE_OPTIONS: { value: ColorPaletteName; label: string; colors: readonly string[] }[] = [
  { value: 'vivid', label: 'Vivid', colors: COLOR_PALETTES.vivid },
  { value: 'pastel', label: 'Pastel', colors: COLOR_PALETTES.pastel },
  { value: 'earth', label: 'Earth', colors: COLOR_PALETTES.earth },
];

const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

const CURRENCY_CHIPS = ['¥', '$', '£', '€', 'HK$'];

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
    prepaidDeducted: false,
    status: 'scheduled',
    movedFromDate: null,
    movedFromTime: null,
    originalPlannedDate: null,
    originalPlannedTime: null,
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
    prepaidDeducted: false,
    status: 'moved',
    movedFromDate: null,
    movedFromTime: null,
    originalPlannedDate: null,
    originalPlannedTime: null,
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
    prepaidDeducted: false,
    status: 'cancelled',
    movedFromDate: null,
    movedFromTime: null,
    originalPlannedDate: null,
    originalPlannedTime: null,
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
    prepaidDeducted: false,
    status: 'scheduled',
    movedFromDate: null,
    movedFromTime: null,
    originalPlannedDate: null,
    originalPlannedTime: null,
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
    prepaidDeducted: false,
    status: 'scheduled',
    movedFromDate: null,
    movedFromTime: null,
    originalPlannedDate: null,
    originalPlannedTime: null,
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

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    keys.join(','),
    ...rows.map((row) => keys.map((key) => escapeCsvCell(row[key])).join(',')),
  ];
  return lines.join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex self-start rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 p-1"
    >
      {options.map(({ value: v, label, icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            value === v
              ? 'bg-white dark:bg-gray-800 text-[var(--accent)] shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'
          }`}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

function DisclosureSection({
  title,
  children,
  defaultOpen = false,
  className = '',
  contentClassName = '',
  icon,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{title}</h2>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className={`p-6 pt-0 border-t border-slate-100 dark:border-gray-700 ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export function SettingsView() {
  const { preferences, setPreferences } = usePreferences();
  const { settings, updateSettings } = useReminderSettings();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [language, setLanguage] = useState<LanguagePreference>(getLanguage);
  const [displayTimezone, setDisplayTimezoneState] = useState<string>(getDisplayTimezone);

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

  const colorKeys: (keyof CalendarPreferences)[] = [
    'colorConfirmed',
    'colorMoved',
    'colorCancelled',
    'colorDraft',
    'colorConflict',
  ];

  const exportAllData = async () => {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) {
        toast.error('You must be signed in to export data');
        return;
      }
      const userId = userData.user.id;

      const tables = [
        { name: 'students', table: 'ck_students' },
        { name: 'classes', table: 'ck_classes' },
        { name: 'enrollments', table: 'ck_enrollments' },
        { name: 'sessions', table: 'ck_sessions' },
        { name: 'payments', table: 'ck_payments' },
        { name: 'proposals', table: 'ck_proposals' },
      ] as const;

      const results = await Promise.all(
        tables.map(async ({ name, table }) => {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', userId);
          return { name, table, data: (data ?? []) as Record<string, unknown>[], error };
        })
      );

      const failed = results.filter((r) => r.error);
      if (failed.length > 0) {
        throw new Error(`Failed to fetch ${failed.map((r) => r.table).join(', ')}`);
      }

      const dateStr = new Date().toISOString().split('T')[0];
      let totalRows = 0;
      for (const { name, data } of results) {
        const csv = rowsToCsv(data);
        downloadCsv(`classkeep-${name}-${dateStr}.csv`, csv);
        totalRows += data.length;
      }

      toast.success(`Exported ${totalRows} rows across ${tables.length} tables`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div className="space-y-8">
      <DisclosureSection title="Appearance" icon={<Palette className="w-5 h-5 text-[var(--accent)]" />} defaultOpen>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Theme</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                Choose the app appearance, or follow your system setting.
              </p>
            </div>
            <SegmentedControl
              ariaLabel="Theme"
              value={preferences.theme}
              options={THEME_OPTIONS}
              onChange={(theme) => setPreferences({ theme })}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Accent color</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                Used for primary buttons, active tabs, and links.
              </p>
            </div>
            <SegmentedControl
              ariaLabel="Accent color"
              value={preferences.accentTheme}
              options={ACCENT_OPTIONS.map(({ value, label, swatch }) => ({
                value,
                label,
                icon: <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: swatch }} />,
              }))}
              onChange={(accentTheme) => setPreferences({ accentTheme })}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Color palette</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              Colors are auto-assigned from this palette when you add new students or classes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 max-w-2xl">
              {PALETTE_OPTIONS.map(({ value, label, colors }) => {
                const active = preferences.colorPalette === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPreferences({ colorPalette: value })}
                    aria-pressed={active}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-wrap gap-1 mb-2">
                      {colors.slice(0, 8).map((c) => (
                        <span
                          key={c}
                          className="w-4 h-4 rounded-full border border-white dark:border-gray-800"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className={`text-sm font-medium ${active ? 'text-[var(--accent)]' : 'text-slate-700 dark:text-gray-200'}`}>
                      {label}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Applies to new students and classes only — existing colors and manual picks are not changed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Language</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                Interface language (applied app-wide in an upcoming release).
              </p>
            </div>
            <SegmentedControl
              ariaLabel="Language"
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(next) => {
                setLanguage(next);
                saveLanguage(next);
              }}
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Session Status Colors</h3>
              <button
                type="button"
                onClick={resetColors}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
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
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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
        </div>
      </DisclosureSection>

      <DisclosureSection title="Calendar & Schedule" icon={<CalendarDays className="w-5 h-5 text-[var(--accent)]" />}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Time Scale</h3>
          <button
            type="button"
            onClick={resetTimeScale}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
          >
            Reset time scale
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
            <TimePicker
              value={preferences.calendarStartTime.slice(0, 5)}
              onChange={(v) => updateTimeScale('calendarStartTime', v + ':00')}
              className="w-full"
              aria-label="Start time"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
            <TimePicker
              value={preferences.calendarEndTime.slice(0, 5)}
              onChange={(v) => updateTimeScale('calendarEndTime', v + ':00')}
              className="w-full"
              aria-label="End time"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Slot increment</label>
            <select
              value={preferences.calendarSlotMinutes}
              onChange={(e) => updateTimeScale('calendarSlotMinutes', parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Default calendar view</label>
            <SegmentedControl
              ariaLabel="Default calendar view"
              value={preferences.defaultCalendarView ?? 'week'}
              options={(['day', 'week', 'month'] as const).map((v) => ({ value: v, label: v }))}
              onChange={(defaultCalendarView) => setPreferences({ defaultCalendarView })}
            />
            <p className="text-xs text-slate-500 mt-2">The calendar opens with this view.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Display timezone</label>
            <input
              type="text"
              list="ck-common-timezones"
              value={displayTimezone}
              onChange={(e) => setDisplayTimezoneState(e.target.value)}
              onBlur={() => setDisplayTimezone(displayTimezone)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Display timezone"
            />
            <datalist id="ck-common-timezones">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="text-xs text-slate-500 mt-2">
              Dates and times across the app are shown in this timezone.
            </p>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection title="Notifications" icon={<Bell className="w-5 h-5 text-[var(--accent)]" />}>
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
                className="w-4 h-4 text-[var(--accent)] rounded border-slate-300"
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
                className="w-4 h-4 text-[var(--accent)] rounded border-slate-300"
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
                className="w-4 h-4 text-[var(--accent)] rounded border-slate-300"
              />
            </label>
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Pre-class minutes</label>
              <select
                value={settings.preClassMinutes}
                onChange={(e) => updateSettings({ preClassMinutes: parseInt(e.target.value, 10) })}
                className="w-full rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {[15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">Daily digest time</label>
              <TimePicker
                value={settings.dailyDigestTime}
                onChange={(v) => updateSettings({ dailyDigestTime: v })}
                className="w-full"
                aria-label="Daily digest time"
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
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent-soft)] dark:peer-focus:ring-[var(--accent-soft)] rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--accent)]"></div>
                </label>
                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-md transition-colors"
                  >
                    Request permission
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection title="Billing" icon={<CreditCard className="w-5 h-5 text-[var(--accent)]" />}>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Headline income metric</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                Which number shows as the large headline figure on the Billing page.
              </p>
            </div>
            <SegmentedControl
              ariaLabel="Headline income metric"
              value={preferences.billingPrimaryMetric ?? 'projected'}
              options={[
                { value: 'projected', label: 'Projected' },
                { value: 'earned', label: 'Earned so far' },
              ]}
              onChange={(billingPrimaryMetric) => setPreferences({ billingPrimaryMetric })}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Currency</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
              Symbol shown with amounts throughout the app.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {CURRENCY_CHIPS.map((chip) => {
                const active = preferences.currency === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setPreferences({ currency: chip })}
                    aria-pressed={active}
                    className={`min-w-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
              <input
                type="text"
                value={preferences.currency}
                onChange={(e) => setPreferences({ currency: e.target.value })}
                placeholder="Custom"
                aria-label="Custom currency symbol"
                className="w-24 rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-gray-700">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-200 mb-1">
              Low-balance warning
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="1"
                value={preferences.lowBalanceThreshold}
                onChange={(e) => setPreferences({ lowBalanceThreshold: parseFloat(e.target.value) || 0 })}
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <span className="text-sm text-slate-500">{preferences.currency || '¥'}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Tracked students at or below this balance trigger a low-balance alert.
            </p>
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection title="Proposals" icon={<FileText className="w-5 h-5 text-[var(--accent)]" />}>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          No proposal settings yet.
        </p>
      </DisclosureSection>

      <DisclosureSection title="Data" icon={<Download className="w-5 h-5 text-[var(--accent)]" />}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Download all your ClassKeep data as CSV files. One file is generated for each table.
          </p>
          <button
            type="button"
            onClick={exportAllData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export all data (CSV)
          </button>
        </div>
      </DisclosureSection>

      <DisclosureSection title="Features" icon={<Sparkles className="w-5 h-5 text-[var(--accent)]" />}>
        <p className="text-sm text-slate-500 dark:text-gray-400">
          Feature settings are coming soon.
        </p>
      </DisclosureSection>
    </div>
  );
}
