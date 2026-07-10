// src/components/ReviewExport.tsx
import type { ReactNode } from 'react';
import type { Session, Class, Student } from '../types';

interface ReviewExportProps {
  month: number;
  year: number;
  sessions: Session[];
  classes: Class[];
  students: Student[];
  locale?: 'en' | 'zh';
}

type SymbolType = 'completed' | 'cancelled' | 'moved-time' | 'moved-day' | 'additional';

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
    weekday: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
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
    weekday: ['日', '一', '二', '三', '四', '五', '六'],
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
    score: 4,
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
    score: 3,
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
    score: 3,
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
  if (session.actualDate && session.actualDate !== session.plannedDate) return 'moved-day';
  if (session.actualTime && session.actualTime !== session.plannedTime) return 'moved-time';
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

export function ReviewExport({ month, year, sessions, classes, students: _students, locale = 'en' }: ReviewExportProps) {
  const t = LABELS[locale];
  const title = `${new Date(year, month - 1, 1).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'long' })} ${t.titleSuffix}`;
  const headerName = getHeaderName(sessions, classes, locale);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const sessionsByDay = new Map<number, Session[]>();
  for (const session of sessions) {
    const day = parseInt(session.plannedDate.slice(8, 10), 10);
    if (day >= 1 && day <= daysInMonth) {
      const list = sessionsByDay.get(day) ?? [];
      list.push(session);
      sessionsByDay.set(day, list);
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

  const totalCharge = sessions.reduce((sum, s) => {
    if ((s.status === 'completed' || s.isAdditional) && s.totalCharge != null) {
      return sum + s.totalCharge;
    }
    return sum;
  }, 0);

  const legendItems: SymbolType[] = ['completed', 'moved-time', 'moved-day', 'cancelled', 'additional'];

  return (
    <div
      className="bg-white border border-slate-200 shadow-md rounded-xl overflow-hidden text-slate-800"
      style={{ width: '375px' }}
    >
      <div className="bg-slate-900 text-white p-5 text-center">
        <div className="text-xs uppercase tracking-widest opacity-80">{title}</div>
        <div className="text-xl font-bold mt-1">{headerName}</div>
      </div>

      <div className="p-5 space-y-5">
        <div className="text-xs text-slate-500 text-center bg-slate-50 rounded-lg py-2">
          {t.planned}: {plannedCount} {t.sessions} · {t.actual}: {actualCount} {t.sessions}
          {additionalCount > 0 && ` (+${additionalCount} ${t.additional})`}
          {cancelledCount > 0 && ` (${cancelledCount} ${t.cancelled})`}
        </div>

        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
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
              const symbol = getDaySymbol(daySessions);
              return (
                <div
                  key={day}
                  className="w-10 h-10 flex flex-col items-center justify-center rounded-lg border border-slate-100"
                >
                  <span className="text-xs text-slate-600">{day}</span>
                  {symbol && (
                    <div className="mt-0.5">
                      {SYMBOLS[symbol].render()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <div className="text-sm font-semibold text-slate-700">
            {locale === 'zh' ? '月度摘要' : 'Monthly summary'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-600">{t.completed}</span>
              <span className="font-semibold text-slate-900">{completedCount}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-600">{t.cancelled}</span>
              <span className="font-semibold text-slate-900">{cancelledCount}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-600">{t.noShow}</span>
              <span className="font-semibold text-slate-900">{noShowCount}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-600">{t.moved}</span>
              <span className="font-semibold text-slate-900">{movedCount}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-600">{t.additional}</span>
              <span className="font-semibold text-slate-900">{additionalCount}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <span className="text-slate-600">{t.totalCharge}</span>
              <span className="font-semibold text-slate-900">{formatCurrency(totalCharge, locale)}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 pt-1">
            {t.changeNote(movedCount, cancelledCount, additionalCount)}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            {locale === 'zh' ? '图例' : 'Legend'}
          </div>
          <div className="flex flex-wrap gap-2">
            {legendItems.map((type) => (
              <div key={type} className="flex items-center gap-1 bg-slate-50 rounded-full px-2 py-1">
                {SYMBOLS[type].render()}
                <span className="text-xs text-slate-600">
                  {locale === 'zh' ? SYMBOLS[type].labelZh : SYMBOLS[type].labelEn}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock data for testing
export const MOCK_REVIEW_SESSIONS: Session[] = [
  {
    id: 'rs-1',
    userId: 'mock-user',
    classId: 'class-piano',
    plannedDate: '2026-08-03',
    plannedTime: '09:00',
    actualDate: '2026-08-03',
    actualTime: '09:00',
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: 100,
    status: 'completed',
    movedFromDate: null,
    movedFromTime: null,
    isAdditional: false,
    notes: '',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'rs-2',
    userId: 'mock-user',
    classId: 'class-piano',
    plannedDate: '2026-08-05',
    plannedTime: '10:00',
    actualDate: null,
    actualTime: null,
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: null,
    status: 'cancelled',
    movedFromDate: null,
    movedFromTime: null,
    isAdditional: false,
    notes: 'Teacher sick',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'rs-3',
    userId: 'mock-user',
    classId: 'class-math',
    plannedDate: '2026-08-07',
    plannedTime: '14:00',
    actualDate: '2026-08-07',
    actualTime: '14:00',
    durationMinutes: 90,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: 150,
    status: 'no-show',
    movedFromDate: null,
    movedFromTime: null,
    isAdditional: false,
    notes: '',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'rs-4',
    userId: 'mock-user',
    classId: 'class-piano',
    plannedDate: '2026-08-10',
    plannedTime: '09:00',
    actualDate: '2026-08-10',
    actualTime: '10:00',
    durationMinutes: 60,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: 100,
    status: 'completed',
    movedFromDate: null,
    movedFromTime: null,
    isAdditional: false,
    notes: 'Moved to 10am',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'rs-5',
    userId: 'mock-user',
    classId: 'class-art',
    plannedDate: '2026-08-12',
    plannedTime: '09:00',
    actualDate: '2026-08-13',
    actualTime: '09:00',
    durationMinutes: 120,
    rateMode: 'auto',
    rateValue: null,
    totalCharge: 200,
    status: 'moved',
    movedFromDate: '2026-08-12',
    movedFromTime: '09:00',
    isAdditional: false,
    notes: '',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'rs-6',
    userId: 'mock-user',
    classId: 'class-math',
    plannedDate: '2026-08-15',
    plannedTime: '16:00',
    actualDate: '2026-08-15',
    actualTime: '16:00',
    durationMinutes: 60,
    rateMode: 'override',
    rateValue: 120,
    totalCharge: 120,
    status: 'completed',
    movedFromDate: null,
    movedFromTime: null,
    isAdditional: true,
    notes: 'Extra prep session',
    createdAt: '2026-08-01T00:00:00Z',
  },
];

export const MOCK_CLASSES: Class[] = [
  { id: 'class-piano', userId: 'mock-user', name: 'Piano', type: 'one-on-one', maxCapacity: 1, color: '#22c55e', textbook: '', currentUnit: '', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'class-math', userId: 'mock-user', name: 'Math', type: 'one-on-one', maxCapacity: 1, color: '#3b82f6', textbook: '', currentUnit: '', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'class-art', userId: 'mock-user', name: 'Art', type: 'group', maxCapacity: 8, color: '#f97316', textbook: '', currentUnit: '', createdAt: '2026-08-01T00:00:00Z' },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 'student-1', userId: 'mock-user', name: 'Alice Chen', contact: '', defaultRate: 100, timezone: 'Asia/Shanghai', color: '#a855f7', notes: '', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'student-2', userId: 'mock-user', name: 'Bob Li', contact: '', defaultRate: 80, timezone: 'Asia/Shanghai', color: '#ec4899', notes: '', createdAt: '2026-08-01T00:00:00Z' },
];
