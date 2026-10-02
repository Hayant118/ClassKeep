// src/components/ReviewExport.tsx
import type { ReactNode } from 'react';
import type { Session, Class, Student, Enrollment } from '../types';

interface ReviewExportProps {
  month: number;
  year: number;
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

type SymbolType = 'completed' | 'cancelled' | 'moved-time' | 'moved-day' | 'moved-source' | 'additional';

const LABELS = {
  en: {
    titleSuffix: 'Review',
    planned: 'Planned',
    actual: 'Actual',
    sessions: 'sessions',
    additional: 'additional',
    cancelled: 'cancelled',
    completed: 'Completed',
    noShow: 'No-show',
    moved: 'Rescheduled',
    totalCharge: 'Total charge',
    changeNote: (moved: number, cancelled: number, additional: number) => {
      const parts: string[] = [];
      if (moved > 0) parts.push(`${moved} session${moved === 1 ? '' : 's'} rescheduled`);
      if (cancelled > 0) parts.push(`${cancelled} cancelled`);
      if (additional > 0) parts.push(`${additional} additional`);
      return parts.length > 0 ? parts.join(', ') : 'No changes this month.';
    },
    weekday: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
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

const SYMBOLS: Record<
  SymbolType,
  {
    score: number;
    color: string;
    labelEn: string;
    labelZh: string;
    render: () => ReactNode;
  }
> = {
  cancelled: {
    score: 5,
    color: '#ef4444',
    labelEn: 'Cancelled / No-show',
    labelZh: '取消 / 缺课',
    render: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" fill="none">
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </svg>
    ),
  },
  'moved-day': {
    score: 4,
    color: '#a855f7',
    labelEn: 'Moved to another day',
    labelZh: '改日期',
    render: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 8H4" />
        <path d="M7 5l-3 3 3 3" />
      </svg>
    ),
  },
  'moved-time': {
    score: 4,
    color: '#f97316',
    labelEn: 'Moved to another time',
    labelZh: '改时间',
    render: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none">
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="8" x2="8" y2="5" />
        <line x1="8" y1="8" x2="11" y2="8" />
      </svg>
    ),
  },
  'moved-source': {
    score: 3,
    color: '#94a3b8',
    labelEn: 'Moved from this day',
    labelZh: '从此日改期',
    render: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="8" cy="8" r="5" strokeDasharray="2 2" />
        <path d="M10 6l2 2-2 2" />
      </svg>
    ),
  },
  additional: {
    score: 2,
    color: '#22c55e',
    labelEn: 'Additional',
    labelZh: '加课',
    render: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" fill="none">
        <line x1="8" y1="4" x2="8" y2="12" />
        <line x1="4" y1="8" x2="12" y2="8" />
      </svg>
    ),
  },
  completed: {
    score: 1,
    color: '#22c55e',
    labelEn: 'Completed as planned',
    labelZh: '按计划完成',
    render: () => (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" fill="#22c55e" />
      </svg>
    ),
  },
};

function classifySession(session: Session): SymbolType | null {
  if (session.status === 'cancelled' || session.status === 'no-show') return 'cancelled';
  if (session.movedFromDate && session.movedFromDate !== session.plannedDate) return 'moved-day';
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
  const cls = classes.find(c => c.id === session.classId);
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
  const currency = locale === 'zh' ? 'CNY' : 'USD';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency,
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

export function ReviewExport({ 
  month, 
  year, 
  sessions, 
  classes, 
  students: _students, 
  enrollments = [], 
  student, 
  familyGroup, 
  familyGroupStudents,
  classGroup,
  locale = 'en' 
}: ReviewExportProps) {
  const t = LABELS[locale];
  const title = `${new Date(year, month - 1, 1).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'long' })} ${t.titleSuffix}`;
  
  // Header: student name > family group > class group > fallback
  const headerName = student?.name ?? familyGroup ?? classGroup?.name ?? getHeaderName(sessions, classes, locale);

  // Family mode: attribute each session to a group student for color-coding
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

  const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const sessionsByDay = new Map<number, Session[]>();
  const sourceDays = new Map<number, Session[]>();

  for (const session of sessions) {
    const day = parseInt(session.plannedDate.slice(8, 10), 10);
    if (day >= 1 && day <= daysInMonth) {
      const list = sessionsByDay.get(day) ?? [];
      list.push(session);
      sessionsByDay.set(day, list);
    }
    if (session.movedFromDate) {
      const srcDay = parseInt(session.movedFromDate.slice(8, 10), 10);
      if (srcDay >= 1 && srcDay <= daysInMonth) {
        const list = sourceDays.get(srcDay) ?? [];
        list.push(session);
        sourceDays.set(srcDay, list);
      }
    }
  }

  const completedCount = sessions.filter(s => classifySession(s) === 'completed').length;
  const cancelledCount = sessions.filter(s => s.status === 'cancelled').length;
  const noShowCount = sessions.filter(s => s.status === 'no-show').length;
  const movedCount = sessions.filter(s => {
    const type = classifySession(s);
    return type === 'moved-day' || type === 'moved-time';
  }).length;
  const additionalCount = sessions.filter(s => s.isAdditional).length;

  const plannedCount = sessions.filter(s => !s.isAdditional).length;
  const actualCount = sessions.filter(s => s.status !== 'cancelled' && s.status !== 'no-show').length;

  // Calculate total charge based on mode
  const totalCharge = Math.round(
    sessions.reduce((sum, s) => {
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
        // Auto mode: use class defaultRate
        const rate = classGroup.defaultRate ?? 0;
        return sum + rate * hours;
      }
      
      // Family mode: attribute to specific student
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

  const legendItems: SymbolType[] = ['completed', 'moved-time', 'moved-day', 'moved-source', 'cancelled', 'additional'];

  return (
    <div
      className="border shadow-md rounded-xl overflow-hidden"
      style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', width: '375px' }}
    >
      <div className="p-5 text-center" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
        <div className="text-xs uppercase tracking-widest opacity-80">{title}</div>
        <div className="text-xl font-bold mt-1">{headerName}</div>
      </div>

      <div className="p-5 space-y-5">
        <div className="text-xs text-center rounded-lg py-2" style={{ color: '#64748b', backgroundColor: '#f8fafc' }}>
          {t.planned}: {plannedCount} {t.sessions} · {t.actual}: {actualCount} {t.sessions}
          {additionalCount > 0 && ` (+${additionalCount} ${t.additional})`}
          {cancelledCount > 0 && ` (${cancelledCount} ${t.cancelled})`}
        </div>

        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1" style={{ color: '#64748b' }}>
            {t.weekday.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="w-10 h-10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const daySessions = sessionsByDay.get(day) ?? [];
              const srcSessions = sourceDays.get(day) ?? [];
              const symbol = getDaySymbol(daySessions);
              const hasSource = srcSessions.length > 0;

              return (
                <div
                  key={day}
                  className="w-10 h-10 flex flex-col items-center justify-center rounded-lg border"
                  style={{ borderColor: '#f1f5f9' }}
                >
                  <span className="text-xs" style={{ color: '#475569' }}>{day}</span>
                  <div className="mt-0.5 flex items-center gap-0.5 flex-wrap justify-center">
                    {familyGroup
                      ? daySessions.map((s) => {
                          const type = classifySession(s);
                          if (!type) return null;
                          const color = resolveOwner(s)?.color;
                          return (
                            <span
                              key={s.id}
                              className="inline-flex items-center justify-center rounded-full"
                              style={
                                color
                                  ? { boxShadow: `0 0 0 2px ${color}`, borderRadius: '9999px' }
                                  : undefined
                              }
                            >
                              {SYMBOLS[type].render()}
                            </span>
                          );
                        })
                      : symbol && SYMBOLS[symbol].render()}
                    {hasSource && SYMBOLS['moved-source'].render()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t pt-4 space-y-2" style={{ borderColor: '#e2e8f0' }}>
          <div className="text-sm font-semibold" style={{ color: '#334155' }}>
            {locale === 'zh' ? '月度摘要' : 'Monthly summary'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{t.completed}</span>
              <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{completedCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{t.cancelled}</span>
              <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{cancelledCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{t.noShow}</span>
              <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{noShowCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{t.moved}</span>
              <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{movedCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{t.additional}</span>
              <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{additionalCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
              <span className="text-xs" style={{ color: '#64748b' }}>{t.totalCharge}</span>
              <span className="text-xs font-semibold" style={{ color: '#0f172a' }}>{formatCurrency(totalCharge, locale)}</span>
            </div>
          </div>
          <div className="text-xs pt-1" style={{ color: '#64748b' }}>
            {t.changeNote(movedCount, cancelledCount, additionalCount)}
          </div>
        </div>

        <div className="border-t pt-3" style={{ borderColor: '#e2e8f0' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#334155' }}>
            {locale === 'zh' ? '图例' : 'Legend'}
          </div>
          <div className="flex flex-wrap gap-2">
            {legendItems.map((type) => (
              <div key={type} className="flex items-center gap-1 rounded-full px-2 py-1" style={{ backgroundColor: '#f8fafc' }}>
                {SYMBOLS[type].render()}
                <span className="text-xs" style={{ color: '#64748b' }}>
                  {locale === 'zh' ? SYMBOLS[type].labelZh : SYMBOLS[type].labelEn}
                </span>
              </div>
            ))}
          </div>
          {familyGroupStudents && familyGroupStudents.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {familyGroupStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-1 rounded-full px-2 py-1" style={{ backgroundColor: '#f8fafc' }}>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: s.color || '#6366f1' }}
                  />
                  <span className="text-xs" style={{ color: '#64748b' }}>{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}