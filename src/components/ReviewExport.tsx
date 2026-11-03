// src/components/ReviewExport.tsx
import type { CSSProperties, ReactNode } from 'react';
import type { Session, Class, Student, Enrollment } from '../types';

interface ReviewExportProps {
  months: Array<{ month: number; year: number }>;
  sessions: Session[];
  classes: Class[];
  students: Student[];
  enrollments?: Enrollment[];
  student?: Student;
  familyGroup?: string;
  familyGroupStudents?: Student[];
  classGroup?: Class;
  locale?: 'en' | 'zh';
}

type SymbolType = 'completed' | 'cancelled' | 'moved-time' | 'completed-moved' | 'additional';

const LABELS = {
  en: {
    titleSuffix: 'Review',
    planned: 'Planned',
    actual: 'Actual',
    sessions: 'sessions',
    additional: 'Additional',
    cancelled: 'Cancelled',
    completed: 'Completed',
    noShow: 'No-show',
    moved: 'Rescheduled',
    totalCharge: 'Total charge',
    summary: 'Monthly summary',
    legend: 'Legend',
    allMonths: 'Total for all months',
    changeNote: (moved: number, cancelled: number, additional: number) => {
      const parts: string[] = [];
      if (moved > 0) parts.push(`${moved} session${moved === 1 ? '' : 's'} rescheduled`);
      if (cancelled > 0) parts.push(`${cancelled} cancelled`);
      if (additional > 0) parts.push(`${additional} additional`);
      return parts.length > 0 ? parts.join(', ') : 'No changes this month.';
    },
    weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  zh: {
    titleSuffix: '回顾',
    planned: '计划',
    actual: '实际',
    sessions: '节课',
    additional: '加课',
    cancelled: '取消',
    completed: '已完成',
    noShow: '缺课',
    moved: '改期',
    totalCharge: '总费用',
    summary: '月度摘要',
    legend: '图例',
    allMonths: '所有月份合计',
    changeNote: (moved: number, cancelled: number, additional: number) => {
      const parts: string[] = [];
      if (moved > 0) parts.push(`${moved}节课改期`);
      if (cancelled > 0) parts.push(`${cancelled}节课取消`);
      if (additional > 0) parts.push(`${additional}节加课`);
      return parts.length > 0 ? parts.join('，') : '本月无变更。';
    },
    weekday: ['一', '二', '三', '四', '五', '六', '日'],
  },
};

// Theme: matches the dark ClassKeep screens and the proposal card.
const C = {
  page: '#0b1120',
  card: '#1e293b',
  cardDeep: '#111827',
  border: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#64748b',
  accent: '#6366f1',
};

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif';

const SYMBOLS: Record<
  SymbolType,
  {
    score: number;
    labelEn: string;
    labelZh: string;
    render: (size?: number) => ReactNode;
  }
> = {
  cancelled: {
    score: 5,
    labelEn: 'Cancelled / No-show',
    labelZh: '取消 / 缺课',
    render: (size = 16) => (
      <svg width={size} height={size} viewBox="0 0 16 16" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </svg>
    ),
  },
  'completed-moved': {
    score: 4,
    labelEn: 'Completed (moved)',
    labelZh: '已完成（改期）',
    render: (size = 16) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" fill="#fb923c" />
      </svg>
    ),
  },
  'moved-time': {
    score: 4,
    labelEn: 'Moved away',
    labelZh: '改期',
    render: (size = 16) => (
      <svg width={size} height={size} viewBox="0 0 16 16" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="8" x2="8" y2="5" />
        <line x1="8" y1="8" x2="11" y2="8" />
      </svg>
    ),
  },
  additional: {
    score: 2,
    labelEn: 'Additional',
    labelZh: '加课',
    render: (size = 16) => (
      <svg width={size} height={size} viewBox="0 0 16 16" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <line x1="8" y1="4" x2="8" y2="12" />
        <line x1="4" y1="8" x2="12" y2="8" />
      </svg>
    ),
  },
  completed: {
    score: 1,
    labelEn: 'Completed as planned',
    labelZh: '按计划完成',
    render: (size = 16) => (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" fill="#4ade80" />
      </svg>
    ),
  },
};

function classifySession(session: Session): SymbolType | null {
  if (session.status === 'cancelled' || session.status === 'no-show') return 'cancelled';
  if (session.movedFromDate && session.movedFromDate !== session.plannedDate) return 'completed-moved';
  if (session.movedFromTime && session.movedFromTime !== session.plannedTime) return 'moved-time';
  if (session.isAdditional) return 'additional';
  if (session.status === 'completed') return 'completed';
  return null;
}

function getDaySymbol(sessions: Session[]): SymbolType | null {
  let best: SymbolType | null = null;
  let bestScore = 0;
  for (const session of sessions) {
    const type = classifySession(session);
    if (type && SYMBOLS[type].score > bestScore) {
      best = type;
      bestScore = SYMBOLS[type].score;
    }
  }
  return best;
}

function getClassName(session: Session, classes: Class[]): string {
  const cls = classes.find((c) => c.id === session.classId);
  return cls?.name ?? '';
}

function getHeaderName(sessions: Session[], classes: Class[], locale: 'en' | 'zh'): string {
  for (const session of sessions) {
    const name = getClassName(session, classes);
    if (name) return name;
  }
  return locale === 'zh' ? '课程' : 'Class';
}

function formatCurrency(amount: number, locale: 'en' | 'zh'): string {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
}

function computeSessionCharge(
  session: Session,
  student: Student | undefined,
  enrollments: Enrollment[]
): number {
  const hours = session.durationMinutes / 60;
  if (session.rateMode === 'flat' && session.rateValue != null) {
    return session.rateValue;
  }
  let hourly = 0;
  if (session.rateMode === 'override' && session.rateValue != null) {
    hourly = session.rateValue;
  } else if (student) {
    const enrollment = session.classId
      ? enrollments.find(
          (e) => e.studentId === student.id && e.classId === session.classId && e.status === 'active'
        )
      : undefined;
    hourly = enrollment?.customRate ?? student.defaultRate ?? 0;
  }
  return hourly * hours;
}

interface MonthSection {
  month: number;
  year: number;
  label: string;
  firstDay: number;
  daysInMonth: number;
  sessionsByDay: Map<number, Session[]>;
  sourceDays: Map<number, Session[]>;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  movedCount: number;
  additionalCount: number;
  plannedCount: number;
  actualCount: number;
  totalCharge: number;
}

export function ReviewExport({
  months,
  sessions,
  classes,
  students: _students,
  enrollments = [],
  student,
  familyGroup,
  familyGroupStudents,
  classGroup,
  locale = 'en',
}: ReviewExportProps) {
  const t = LABELS[locale];
  const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
  const monthName = (m: number, y: number) =>
    new Date(y, m - 1, 1).toLocaleDateString(dateLocale, { month: 'long' });

  const first = months[0];
  const last = months[months.length - 1];
  const title =
    months.length === 1
      ? `${monthName(first.month, first.year)} ${t.titleSuffix}`
      : `${monthName(first.month, first.year)} – ${monthName(last.month, last.year)} ${t.titleSuffix}`;

  // Header: student name > family group > class group > fallback
  const headerName = student?.name ?? familyGroup ?? classGroup?.name ?? getHeaderName(sessions, classes, locale);

  // Family mode: attribute each session to a group student for colour-coding
  const resolveOwner = (session: Session): Student | undefined => {
    if (!familyGroupStudents?.length) return undefined;
    if (session.studentId) {
      return familyGroupStudents.find((s) => s.id === session.studentId);
    }
    if (session.classId) {
      return familyGroupStudents.find((s) =>
        enrollments.some((e) => e.classId === session.classId && e.studentId === s.id)
      );
    }
    return undefined;
  };

  const legendItems: SymbolType[] = ['completed', 'completed-moved', 'moved-time', 'cancelled', 'additional'];

  const monthSections: MonthSection[] = months.map(({ month, year }) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthSessions = sessions.filter(
      (s) => s.plannedDate.startsWith(prefix) || (s.actualDate != null && s.actualDate.startsWith(prefix))
    );

    const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    const sessionsByDay = new Map<number, Session[]>();
    const sourceDays = new Map<number, Session[]>();

    for (const session of monthSessions) {
      // Bucket by the date that falls in this month (planned, else actual for moved-in sessions)
      const dateStr = session.plannedDate.startsWith(prefix) ? session.plannedDate : session.actualDate!;
      const day = parseInt(dateStr.slice(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) {
        const list = sessionsByDay.get(day) ?? [];
        list.push(session);
        sessionsByDay.set(day, list);
      }
      if (session.movedFromDate && session.movedFromDate.startsWith(prefix)) {
        const srcDay = parseInt(session.movedFromDate.slice(8, 10), 10);
        if (srcDay >= 1 && srcDay <= daysInMonth) {
          const list = sourceDays.get(srcDay) ?? [];
          list.push(session);
          sourceDays.set(srcDay, list);
        }
      }
    }

    for (const list of sessionsByDay.values()) {
      list.sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
    }
    for (const list of sourceDays.values()) {
      list.sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
    }

    const completedCount = monthSessions.filter((s) => classifySession(s) === 'completed').length;
    const cancelledCount = monthSessions.filter((s) => s.status === 'cancelled').length;
    const noShowCount = monthSessions.filter((s) => s.status === 'no-show').length;
    const movedCount = monthSessions.filter((s) => {
      const type = classifySession(s);
      return type === 'completed-moved' || type === 'moved-time';
    }).length;
    const additionalCount = monthSessions.filter((s) => s.isAdditional).length;

    const plannedCount = monthSessions.filter((s) => !s.isAdditional).length;
    const actualCount = monthSessions.filter((s) => s.status !== 'cancelled' && s.status !== 'no-show').length;

    const totalCharge =
      Math.round(
        monthSessions.reduce((sum, s) => {
          if (s.status !== 'completed' && !s.isAdditional) return sum;

          // Class group mode: use class rate for all sessions
          if (classGroup) {
            const hours = s.durationMinutes / 60;
            if (s.rateMode === 'flat' && s.rateValue != null) {
              return sum + s.rateValue;
            }
            if (s.rateMode === 'override' && s.rateValue != null) {
              return sum + s.rateValue * hours;
            }
            const rate = classGroup.defaultRate ?? 0;
            return sum + rate * hours;
          }

          // Single student / family mode
          if (student) {
            return sum + computeSessionCharge(s, student, enrollments);
          }
          const owner = resolveOwner(s);
          if (owner) {
            return sum + computeSessionCharge(s, owner, enrollments);
          }
          return sum + (s.totalCharge ?? 0);
        }, 0) * 100
      ) / 100;

    return {
      month,
      year,
      label: `${monthName(month, year)} ${year}`,
      firstDay,
      daysInMonth,
      sessionsByDay,
      sourceDays,
      completedCount,
      cancelledCount,
      noShowCount,
      movedCount,
      additionalCount,
      plannedCount,
      actualCount,
      totalCharge,
    };
  });

  const grandTotal = Math.round(monthSections.reduce((sum, m) => sum + m.totalCharge, 0) * 100) / 100;

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
    marginBottom: 10,
  };

  const iconWrap = (ring?: string): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 999,
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
    margin: ring ? 2 : 0,
  });

  const Tile = ({ label, value }: { label: string; value: string | number }) => (
    <div
      style={{
        background: C.cardDeep,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 6px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );

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
          background: `linear-gradient(135deg, ${C.accent} 0%, #4338ca 100%)`,
          borderRadius: 16,
          textAlign: 'center',
          padding: '20px 16px',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.85 }}>
          {title}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: '#ffffff' }}>{headerName}</div>
      </div>

      {monthSections.map((section) => (
        <div key={`${section.year}-${section.month}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Calendar */}
          <div style={panel}>
            <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center' }}>{section.label}</div>
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                textAlign: 'center',
                background: C.cardDeep,
                borderRadius: 8,
                padding: '6px 8px',
                margin: '10px 0 14px',
              }}
            >
              {t.planned}: {section.plannedCount} {t.sessions} · {t.actual}: {section.actualCount} {t.sessions}
              {section.additionalCount > 0 && ` (+${section.additionalCount} ${t.additional})`}
              {section.cancelledCount > 0 && ` (${section.cancelledCount} ${t.cancelled})`}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
              {t.weekday.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, color: C.faint }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {Array.from({ length: section.firstDay }).map((_, i) => (
                <div key={`empty-${i}`} style={{ minHeight: 44 }} />
              ))}
              {Array.from({ length: section.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const daySessions = section.sessionsByDay.get(day) ?? [];
                const srcSessions = section.sourceDays.get(day) ?? [];
                const symbol = getDaySymbol(daySessions);
                const hasSource = srcSessions.length > 0;
                const active = daySessions.length > 0 || hasSource;

                return (
                  <div
                    key={day}
                    style={{
                      minHeight: 44,
                      boxSizing: 'border-box',
                      borderRadius: 8,
                      background: active ? '#273449' : C.cardDeep,
                      border: `1px solid ${active ? '#475569' : C.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      padding: '3px 0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        lineHeight: 1,
                        color: active ? '#ffffff' : C.faint,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {day}
                    </span>
                    {active && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexWrap: 'wrap',
                          gap: 1,
                        }}
                      >
                        {familyGroup
                          ? daySessions.map((s) => {
                              const type = classifySession(s);
                              if (!type) return null;
                              const ring = resolveOwner(s)?.color;
                              return (
                                <span key={s.id} style={iconWrap(ring)}>
                                  {SYMBOLS[type].render(12)}
                                </span>
                              );
                            })
                          : symbol && <span style={iconWrap()}>{SYMBOLS[symbol].render(14)}</span>}
                        {hasSource && <span style={iconWrap()}>{SYMBOLS['moved-time'].render(familyGroup ? 12 : 14)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div style={panel}>
            <div style={sectionLabel}>{t.summary}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Tile label={t.completed} value={section.completedCount} />
              <Tile label={t.cancelled} value={section.cancelledCount} />
              <Tile label={t.noShow} value={section.noShowCount} />
              <Tile label={t.moved} value={section.movedCount} />
              <Tile label={t.additional} value={section.additionalCount} />
              <Tile label={t.actual} value={section.actualCount} />
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 12, textAlign: 'center' }}>
              {t.changeNote(section.movedCount, section.cancelledCount, section.additionalCount)}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: `1px solid ${C.border}`,
                marginTop: 12,
                paddingTop: 12,
              }}
            >
              <span style={{ fontSize: 14, color: C.muted }}>{t.totalCharge}</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
                {formatCurrency(section.totalCharge, locale)}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Combined total when several months are selected */}
      {monthSections.length > 1 && (
        <div
          style={{
            ...panel,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 14, color: C.muted }}>{t.allMonths}</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff' }}>
            {formatCurrency(grandTotal, locale)}
          </span>
        </div>
      )}

      {/* Legend */}
      <div style={panel}>
        <div style={sectionLabel}>{t.legend}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {legendItems.map((type) => (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: C.cardDeep,
                borderRadius: 999,
                padding: '4px 10px',
              }}
            >
              {SYMBOLS[type].render(14)}
              <span style={{ fontSize: 12, color: C.muted }}>
                {locale === 'zh' ? SYMBOLS[type].labelZh : SYMBOLS[type].labelEn}
              </span>
            </div>
          ))}
        </div>
        {familyGroupStudents && familyGroupStudents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {familyGroupStudents.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: C.cardDeep,
                  borderRadius: 999,
                  padding: '4px 10px',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    border: `2px solid ${s.color || '#818cf8'}`,
                    display: 'inline-block',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: 12, color: C.text }}>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}