// src/components/ProposalExport.tsx
import { draftSessionsToSessions } from '../utils/draftSessionAdapter';
import type { Proposal, Class, Student } from '../types';

interface ProposalExportProps {
  proposal: Proposal;
  classes: Class[];
  students: Student[];
  locale?: 'en' | 'zh';
}

const LABELS = {
  en: {
    title: 'Schedule Proposal',
    sessions: 'Total Sessions',
    cost: 'Total Cost',
    noSessions: 'No sessions',
    min: 'min',
  },
  zh: {
    title: '课程安排方案',
    sessions: '课程总数',
    cost: '总费用',
    noSessions: '暂无课程',
    min: '分钟',
  },
};

const WEEKDAYS = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
};

function getDraftColor(draft: ReturnType<typeof draftSessionsToSessions>[number], classes: Class[], students: Student[]): string {
  const cls = classes.find(c => c.id === draft.classId);
  if (cls?.color) return cls.color;
  const student = draft.studentId ? students.find(s => s.id === draft.studentId) : undefined;
  return student?.color ?? '#6366f1';
}

function getStudentName(
  drafts: ReturnType<typeof draftSessionsToSessions>,
  students: Student[],
  classes: Class[],
  locale: 'en' | 'zh'
): string {
  for (const draft of drafts) {
    if (draft.studentId) {
      const student = students.find(s => s.id === draft.studentId);
      if (student) return student.name;
    }
    if (draft.classId) {
      const cls = classes.find(c => c.id === draft.classId);
      if (cls) return cls.name;
    }
  }
  return locale === 'zh' ? '学生' : 'Student';
}

function getSessionCost(draft: ReturnType<typeof draftSessionsToSessions>[number], students: Student[]): number {
  if ((draft.rateMode === 'override' || draft.rateMode === 'flat') && draft.rateValue != null) {
    return draft.rateValue;
  }
  if (draft.studentId) {
    const student = students.find(s => s.id === draft.studentId);
    return student?.defaultRate ?? 0;
  }
  return 0;
}

function groupByMonth(drafts: ReturnType<typeof draftSessionsToSessions>) {
  const groups = new Map<string, ReturnType<typeof draftSessionsToSessions>>();
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
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
}

export function ProposalExport({ proposal, classes, students, locale = 'en' }: ProposalExportProps) {
  const t = LABELS[locale];
  const drafts = draftSessionsToSessions(proposal.draftSessions ?? [], {
    proposalId: proposal.id,
    userId: proposal.userId,
  }).sort((a, b) => {
    const dateCompare = a.plannedDate.localeCompare(b.plannedDate);
    if (dateCompare !== 0) return dateCompare;
    return a.plannedTime.localeCompare(b.plannedTime);
  });

  const studentName = getStudentName(drafts, students, classes, locale);
  const totalCost = drafts.reduce((sum, d) => sum + getSessionCost(d, students), 0);
  const currency = locale === 'zh' ? 'CNY' : 'USD';
  const formatter = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency,
  });

  const months = groupByMonth(drafts);

  return (
    <div
      className="bg-white border border-slate-200 shadow-md rounded-xl overflow-hidden text-slate-800"
      style={{ width: '375px' }}
    >
      <div className="bg-slate-900 text-white p-5 text-center">
        <div className="text-xs uppercase tracking-widest opacity-80">{t.title}</div>
        <div className="text-xl font-bold mt-1">{studentName}</div>
      </div>

      <div className="p-5 space-y-6">
        {drafts.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">{t.noSessions}</div>
        ) : (
          <>
            <div className="space-y-4">
              {Array.from(months.entries()).map(([yearMonth, monthDrafts]) => {
                const [year, month] = yearMonth.split('-').map(Number);
                const firstDay = new Date(year, month - 1, 1).getDay();
                const daysInMonth = new Date(year, month, 0).getDate();
                const byDay = new Map<number, typeof monthDrafts>();
                for (const d of monthDrafts) {
                  const day = parseInt(d.plannedDate.slice(8, 10), 10);
                  const list = byDay.get(day) ?? [];
                  list.push(d);
                  byDay.set(day, list);
                }

                return (
                  <div key={yearMonth}>
                    <div className="text-sm font-semibold text-slate-700 mb-2">{monthName(yearMonth, locale)}</div>
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
                        return (
                          <div
                            key={day}
                            className="w-10 h-10 flex flex-col items-center justify-center rounded-lg border border-slate-100"
                          >
                            <span className="text-xs text-slate-600">{day}</span>
                            {dayDrafts.length > 0 && (
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {dayDrafts.slice(0, 3).map((d, idx) => (
                                  <span
                                    key={idx}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: getDraftColor(d, classes, students) }}
                                  />
                                ))}
                                {dayDrafts.length > 3 && (
                                  <span className="text-xs text-slate-500 leading-none">+</span>
                                )}
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

            <div className="border-t border-slate-200 pt-4 space-y-3">
              {drafts.map((draft) => {
                const cost = getSessionCost(draft, students);
                const date = new Date(`${draft.plannedDate}T00:00:00Z`).toLocaleDateString(
                  locale === 'zh' ? 'zh-CN' : 'en-US',
                  { month: 'short', day: 'numeric', weekday: 'short' }
                );
                return (
                  <div key={draft.id} className="flex items-start gap-3">
                    <span
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: getDraftColor(draft, classes, students) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {date} · {draft.plannedTime.slice(0, 5)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {draft.durationMinutes} {t.min} · {formatter.format(cost)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="bg-slate-50 p-4 border-t border-slate-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{t.sessions}</span>
          <span className="font-semibold text-slate-900">{drafts.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-slate-600">{t.cost}</span>
          <span className="font-semibold text-slate-900">{formatter.format(totalCost)}</span>
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
  { id: 'student-1', userId: 'mock-user', name: 'Alice Chen', contact: '', defaultRate: 100, timezone: 'Asia/Shanghai', color: '#a855f7', notes: '', createdAt: '2026-07-01T00:00:00Z' },
  { id: 'student-2', userId: 'mock-user', name: 'Bob Li', contact: '', defaultRate: 80, timezone: 'Asia/Shanghai', color: '#ec4899', notes: '', createdAt: '2026-07-01T00:00:00Z' },
];
