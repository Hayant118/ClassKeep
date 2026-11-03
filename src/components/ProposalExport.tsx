// src/components/ProposalExport.tsx
import type { CSSProperties } from 'react';
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
    sessions: 'Total sessions',
    cost: 'Total',
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
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  zh: ['一', '二', '三', '四', '五', '六', '日'],
};

const FALLBACK_COLORS = ['#818cf8', '#fbbf24', '#2dd4bf', '#f87171', '#a78bfa', '#38bdf8'];

const CURRENCY_LOCALES: Record<string, string> = {
  CNY: 'zh-CN',
  HKD: 'zh-HK',
  GBP: 'en-GB',
  USD: 'en-US',
};

// Theme: matches the dark ClassKeep screens.
const C = {
  page: '#0b1120',
  card: '#1e293b',
  cardDeep: '#111827',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#64748b',
  accent: '#6366f1',
  accentSoft: '#312e81',
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif';

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

function getSessionCost(draft: Session, students: Student[], enrollments: EnrollmentLike[]): number {
  const hours = draft.durationMinutes / 60;

  if (draft.guestName) {
    return (draft.guestRate ?? 0) * hours;
  }
  if (draft.rateMode === 'flat' && draft.rateValue != null) {
    return draft.rateValue;
  }

  const student = draft.studentId ? students.find((s) => s.id === draft.studentId) : undefined;
  let hourly = 0;
  if (draft.rateMode === 'override' && draft.rateValue != null) {
    hourly = draft.rateValue;
  } else if (student) {
    const enrollment = draft.classId
      ? enrollments.find(
          (e) => e.studentId === student.id && e.classId === draft.classId && e.status === 'active'
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

  const guestNames = Array.from(
    new Set(drafts.filter((d) => d.guestName).map((d) => d.guestName as string))
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
    const student = d.studentId ? students.find((s) => s.id === d.studentId) : undefined;
    if (student) {
      return { key: student.id, name: student.name, color: student.color ?? FALLBACK_COLORS[0] };
    }
    const cls = d.classId ? classes.find((c) => c.id === d.classId) : undefined;
    return {
      key: d.classId ?? 'unknown',
      name: cls?.name ?? t.unknown,
      color: cls?.color ?? FALLBACK_COLORS[0],
    };
  };

  const rows = drafts.map((d) => ({
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
    proposal.title?.trim() || summaryList.map((s) => s.person.name).join(' & ') || t.unknown;

  const months = groupByMonth(drafts);
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';

  const panel: CSSProperties = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 16,
  };

  const sectionLabel: CSSProperties = {
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 12,
  };

  return (
    <div
      style={{
        width: 375,
        boxSizing: 'border-box',
        background: C.page,
        color: C.text,
        fontFamily: FONT,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          ...panel,
          background: `linear-gradient(135deg, ${C.accent} 0%, #4338ca 100%)`,
          border: 'none',
          textAlign: 'center',
          padding: '20px 16px',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
          {t.title}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: '#ffffff' }}>{heading}</div>
      </div>

      {drafts.length === 0 ? (
        <div style={{ ...panel, textAlign: 'center', color: C.muted, fontSize: 14, padding: 32 }}>
          {t.noSessions}
        </div>
      ) : (
        <>
          {/* Per-student summary */}
          <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {summaryList.map(({ person, sessions, subtotal }) => (
              <div
                key={person.key}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: person.color,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{person.name}</span>
                  <span style={{ color: C.faint, fontSize: 13 }}>
                    · {sessions} {sessions === 1 ? t.sessionWord : t.sessionsWord}
                  </span>
                </div>
                <span style={{ fontWeight: 600 }}>{formatter.format(subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Month grids */}
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

            const cells: (number | null)[] = [
              ...Array.from({ length: firstDay }, () => null),
              ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
            ];

            return (
              <div key={yearMonth} style={panel}>
                <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
                  {monthName(yearMonth, locale)}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                    marginBottom: 4,
                  }}
                >
                  {WEEKDAYS[locale].map((d) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, color: C.faint }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {cells.map((day, i) => {
                    if (day === null) return <div key={`e-${i}`} style={{ height: 40 }} />;
                    const dayDrafts = byDay.get(day) ?? [];
                    const has = dayDrafts.length > 0;
                    const colors = Array.from(new Set(dayDrafts.map((d) => personFor(d).color)));
                    return (
                      <div
                        key={day}
                        style={{
                          height: 40,
                          borderRadius: 8,
                          background: has ? C.accentSoft : C.cardDeep,
                          border: `1px solid ${has ? C.accent : C.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            lineHeight: 1,
                            fontWeight: has ? 700 : 400,
                            color: has ? '#ffffff' : C.faint,
                          }}
                        >
                          {day}
                        </span>
                        {has && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            {colors.slice(0, 3).map((color) => (
                              <span
                                key={color}
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 999,
                                  background: color,
                                  display: 'inline-block',
                                }}
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

          {/* Session list */}
          <div style={panel}>
            <div style={sectionLabel}>{t.schedule}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <div key={draft.id} style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
                    <span
                      style={{
                        width: 4,
                        borderRadius: 999,
                        background: person.color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {date} · {start}–{end}
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {person.name} · {draft.durationMinutes} {t.min}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        alignSelf: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatter.format(cost)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Totals */}
      <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.muted }}>
          <span>{t.sessions}</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{drafts.length}</span>
        </div>
        {hasDiscount && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.muted }}>
            <span>{t.standard}</span>
            <span style={{ textDecoration: 'line-through' }}>{formatter.format(standardTotal)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderTop: `1px solid ${C.border}`,
            paddingTop: 10,
          }}
        >
          <span style={{ fontSize: 14, color: C.muted }}>{hasDiscount ? t.quoted : t.cost}</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
            {formatter.format(finalTotal)}
          </span>
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