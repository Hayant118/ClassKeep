// src/components/ProposalExport.tsx
import { draftSessionsToSessions } from '../utils/draftSessionAdapter';
import type { Proposal, Class, Student, Session } from '../types';

interface EnrollmentLike {
  studentId: string;
  classId?: string | null;
  status: string;
  customRate?: number | null;
}

interface ProposalExportProps {
  proposal: Proposal;
  classes: Class[];
  students: Student[];
  enrollments?: EnrollmentLike[];
  locale?: 'en' | 'zh';
  currency?: string;
  calculatedTotal?: number;
}

const LABELS = {
  en: {
    title: 'Schedule Proposal',
    sessionsWord: 'sessions',
    sessionWord: 'session',
    sessions: 'Total Sessions',
    cost: 'Total Cost',
    standard: 'Standard price',
    quoted: 'Quoted price',
    schedule: 'Session details',
    noSessions: 'No sessions',
    min: 'min',
    guest: 'Guest',
    unknown: 'Student',
  },
  zh: {
    title: '课程安排方案',
    sessionsWord: '节课',
    sessionWord: '节课',
    sessions: '课程总数',
    cost: '总费用',
    standard: '标准价',
    quoted: '优惠价',
    schedule: '课程明细',
    noSessions: '暂无课程',
    min: '分钟',
    guest: '访客',
    unknown: '学生',
  },
};

// Monday-first, to match the app's calendar.
const WEEKDAYS = {
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  zh: ['一', '二', '三', '四', '五', '六', '日'],
};

const FALLBACK_COLORS = ['#6366f1', '#f59e0b', '#14b8a6', '#ef4444', '#8b5cf6', '#0ea5e9'];

const CURRENCY_LOCALES: Record<string, string> = {
  CNY: 'zh-CN',
  HKD: 'zh-HK',
  GBP: 'en-GB',
  USD: 'en-US',
};

interface Person {
  key: string;
  name: string;
  color: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

function getSessionCost(
  draft: Session,
  students: Student[],
  enrollments: EnrollmentLike[]
): number {
  const hours = draft.durationMinutes / 60;

  if (draft.guestName) {
    return (draft.guestRate ?? 0) * hours;
  }
  if (draft.rateMode === 'flat' && draft.rateValue != null) {
    return draft.rateValue;
  }

  const student = draft.studentId ? students.find(s => s.id === draft.studentId) : undefined;
  let hourly = 0;
  if (draft.rateMode === 'override' && draft.rateValue != null) {
    hourly = draft.rateValue;
  } else if (student) {
    const enrollment = draft.classId
      ? enrollments.find(
          e => e.studentId === student.id && e.classId === draft.classId && e.status === 'active'
        )
      : undefined;
    hourly = enrollment?.customRate ?? student.defaultRate ?? 0;
  }
  return hourly * hours;
}

function groupByMonth(drafts: Session[]) {
  const groups = new Map<string, Session[]>();
  for (const draft of drafts) {
    const key = draft.plannedDate.slice(0, 7); // YYYY-MM
    const list = groups.get(key) ?? [];
    list.push(draft);
    groups.set(key, list);
  }
  return groups;
}

function monthName(yearMonth: string, locale: 'en' | 'zh'): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function ProposalExport({
  proposal,
  classes,
  students,
  enrollments = [],
  locale = 'en',
  currency,
  calculatedTotal,
}: ProposalExportProps) {
  const t = LABELS[locale];
  const drafts = draftSessionsToSessions(proposal.draftSessions ?? [], {
    proposalId: proposal.id,
    userId: proposal.userId,
  }).sort((a, b) => {
    const dateCompare = a.plannedDate.localeCompare(b.plannedDate);
    if (dateCompare !== 0) return dateCompare;
    return a.plannedTime.localeCompare(b.plannedTime);
  });

  // Guests get a fallback colour in order of first appearance.
  const guestNames = Array.from(
    new Set(drafts.filter(d => d.guestName).map(d => d.guestName as string))
  );

  const personFor = (d: Session): Person => {
    if (d.guestName) {
      const idx = guestNames.indexOf(d.guestName);
      return {
        key: `guest:${d.guestName}`,
        name: `${d.guestName} (${t.guest})`,
        color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      };
    }
    const student = d.studentId ? students.find(s => s.id === d.studentId) : undefined;
    if (student) {
      return { key: student.id, name: student.name, color: student.color ?? FALLBACK_COLORS[0] };
    }
    const cls = d.classId ? classes.find(c => c.id === d.classId) : undefined;
    return {
      key: d.classId ?? 'unknown',
      name: cls?.name ?? t.unknown,
      color: cls?.color ?? FALLBACK_COLORS[0],
    };
  };

  // Per-session rows plus per-person summary.
  const rows = drafts.map(d => ({
    draft: d,
    person: personFor(d),
    cost: getSessionCost(d, students, enrollments),
  }));

  const summary = new Map<string, { person: Person; sessions: number; subtotal: number }>();
  for (const r of rows) {
    const entry = summary.get(r.person.key) ?? { person: r.person, sessions: 0, subtotal: 0 };
    entry.sessions += 1;
    entry.subtotal += r.cost;
    summary.set(r.person.key, entry);
  }
  const summaryList = Array.from(summary.values()).sort((a, b) =>
    a.person.name.localeCompare(b.person.name)
  );

  const computedTotal = Math.round(rows.reduce((sum, r) => sum + r.cost, 0) * 100) / 100;
  const standardTotal = calculatedTotal ?? computedTotal;
  const quoted = proposal.quotedAmount ?? null;
  const hasDiscount = quoted != null && Math.abs(quoted - standardTotal) > 0.005;
  const finalTotal = quoted ?? standardTotal;

  const currencyCode = currency ?? proposal.currency ?? 'CNY';
  const formatter = new Intl.NumberFormat(CURRENCY_LOCALES[currencyCode] ?? 'en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const heading =
    proposal.title?.trim() || summaryList.map(s => s.person.name).join(' & ') || t.unknown;

  const months = groupByMonth(drafts);
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl overflow-hidden text-slate-800"
      style={{ width: '375px' }}
    >
      <div className="bg-slate-900 text-white p-5 text-center">
        <div className="text-xs uppercase tracking-widest opacity-80">{t.title}</div>
        <div className="text-xl font-bold mt-1">{heading}</div>
      </div>

      <div className="p-5 space-y-6">
        {drafts.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">{t.noSessions}</div>
        ) : (
          <>
            {/* Per-student summary / legend */}
            <div className="space-y-2">
              {summaryList.map(({ person, sessions, subtotal }) => (
                <div key={person.key} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: person.color }}
                    />
                    <span className="font-medium text-slate-900">{person.name}</span>
                    <span className="text-slate-400">
                      · {sessions} {sessions === 1 ? t.sessionWord : t.sessionsWord}
                    </span>
                  </div>
                  <span className="text-slate-700 whitespace-nowrap">{formatter.format(subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Month grids */}
            <div className="space-y-4">
              {Array.from(months.entries()).map(([yearMonth, monthDrafts]) => {
                const [year, month] = yearMonth.split('-').map(Number);
                const firstDay = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
                const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
                const byDay = new Map<number, Session[]>();
                for (const d of monthDrafts) {
                  const day = parseInt(d.plannedDate.slice(8, 10), 10);
                  const list = byDay.get(day) ?? [];
                  list.push(d);
                  byDay.set(day, list);
                }

                return (
                  <div key={yearMonth}>
                    <div className="text-sm font-semibold text-slate-700 mb-2">
                      {monthName(yearMonth, locale)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
                      {WEEKDAYS[locale].map((d, i) => (
                        <div key={i}>{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-10 h-10" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dayDrafts = byDay.get(day) ?? [];
                        const hasSessions = dayDrafts.length > 0;
                        return (
                          <div
                            key={day}
                            className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg border ${
                              hasSessions ? 'border-slate-300 bg-slate-50' : 'border-slate-100'
                            }`}
                          >
                            <span
                              className={`text-xs ${
                                hasSessions ? 'font-semibold text-slate-900' : 'text-slate-500'
                              }`}
                            >
                              {day}
                            </span>
                            {hasSessions && (
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {dayDrafts.slice(0, 3).map((d, idx) => (
                                  <span
                                    key={idx}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: personFor(d).color }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Session list */}
            <div className="border-t border-slate-200 pt-4">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">{t.schedule}</div>
              <div className="space-y-3">
                {rows.map(({ draft, person, cost }) => {
                  const date = new Date(`${draft.plannedDate}T00:00:00Z`).toLocaleDateString(dateLocale, {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                    timeZone: 'UTC',
                  });
                  const start = draft.plannedTime.slice(0, 5);
                  const end = addMinutes(start, draft.durationMinutes);
                  return (
                    <div key={draft.id} className="flex items-stretch gap-3">
                      <span
                        className="w-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: person.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900">
                          {date} · {start}–{end}
                        </div>
                        <div className="text-xs text-slate-500">
                          {person.name} · {draft.durationMinutes} {t.min}
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-nowrap self-center">
                        {formatter.format(cost)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{t.sessions}</span>
          <span className="font-semibold text-slate-900">{drafts.length}</span>
        </div>
        {hasDiscount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{t.standard}</span>
            <span className="text-slate-500 line-through">{formatter.format(standardTotal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{hasDiscount ? t.quoted : t.cost}</span>
          <span className="font-bold text-slate-900 text-base">{formatter.format(finalTotal)}</span>
        </div>
      </div>
    </div>
  );
}

// Mock data for testing
export const MOCK_PROPOSAL: Proposal = {
  id: 'mock-proposal-1',
  userId: 'mock-user',
  title: 'Summer Schedule',
  status: 'draft',
  guests: [],
  quotedAmount: null,
  currency: 'CNY',
  draftSessions: [
    {
      id: 'ds-1',
      plannedDate: '2026-07-08',
      plannedTime: '09:00',
      durationMinutes: 60,
      classId: 'class-1',
      studentId: 'student-1',
      rateMode: 'auto',
      rateValue: null,
      status: 'scheduled',
      notes: '',
    },
    {
      id: 'ds-2',
      plannedDate: '2026-07-10',
      plannedTime: '14:00',
      durationMinutes: 90,
      classId: 'class-2',
      studentId: 'student-1',
      rateMode: 'override',
      rateValue: 120,
      status: 'scheduled',
      notes: '',
    },
    {
      id: 'ds-3',
      plannedDate: '2026-07-15',
      plannedTime: '10:30',
      durationMinutes: 60,
      classId: 'class-1',
      studentId: 'student-1',
      rateMode: 'auto',
      rateValue: null,
      status: 'scheduled',
      notes: '',
    },
    {
      id: 'ds-4',
      plannedDate: '2026-07-22',
      plannedTime: '16:00',
      durationMinutes: 120,
      classId: 'class-3',
      studentId: 'student-2',
      rateMode: 'flat',
      rateValue: 200,
      status: 'scheduled',
      notes: '',
    },
  ],
  committedAt: null,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
};

export const MOCK_CLASSES: Class[] = [
  { id: 'class-1', userId: 'mock-user', name: 'Piano', type: 'one-on-one', maxCapacity: 1, color: '#22c55e', textbook: '', currentUnit: '', createdAt: '2026-07-01T00:00:00Z' },
  { id: 'class-2', userId: 'mock-user', name: 'Math', type: 'one-on-one', maxCapacity: 1, color: '#3b82f6', textbook: '', currentUnit: '', createdAt: '2026-07-01T00:00:00Z' },
  { id: 'class-3', userId: 'mock-user', name: 'Art', type: 'group', maxCapacity: 8, color: '#f97316', textbook: '', currentUnit: '', createdAt: '2026-07-01T00:00:00Z' },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 'student-1', userId: 'mock-user', name: 'Alice Chen', contact: '', defaultRate: 100, timezone: 'Asia/Shanghai', color: '#a855f7', trackProgress: true, notes: '', createdAt: '2026-07-01T00:00:00Z' },
  { id: 'student-2', userId: 'mock-user', name: 'Bob Li', contact: '', defaultRate: 80, timezone: 'Asia/Shanghai', color: '#ec4899', trackProgress: true, notes: '', createdAt: '2026-07-01T00:00:00Z' },
];