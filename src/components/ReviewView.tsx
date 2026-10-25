// src/components/ReviewView.tsx
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useSessions } from '../hooks/useSessions';
import { ReviewExport } from './ReviewExport';
import type { Class, Enrollment, Student } from '../types';

interface ReviewViewProps {
  students: Student[];
  classes: Class[];
  enrollments?: Enrollment[];
}

const now = new Date();

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function getMonthName(month: number, year: number, locale: 'en' | 'zh'): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'long',
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function ReviewView({ students, classes, enrollments = [] }: ReviewViewProps) {
  const { sessions, loading, error, fetchSessions } = useSessions();

  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [locale, setLocale] = useState<'en' | 'zh'>('zh');
  const [exporting, setExporting] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedFamilyGroup, setSelectedFamilyGroup] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const selectedMonths = useMemo(() => {
    const startIdx = startYear * 12 + (startMonth - 1);
    const endIdx = endYear * 12 + (endMonth - 1);
    const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const months: Array<{ month: number; year: number }> = [];
    for (let i = from; i <= to && months.length < 12; i++) {
      months.push({ year: Math.floor(i / 12), month: (i % 12) + 1 });
    }
    return months;
  }, [startMonth, startYear, endMonth, endYear]);

  useEffect(() => {
    const first = selectedMonths[0];
    const last = selectedMonths[selectedMonths.length - 1];
    const start = new Date(first.year, first.month - 1, 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(last.year, last.month - 1, getDaysInMonth(last.year, last.month));
    end.setDate(end.getDate() + 7);

    fetchSessions({
      startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    });
  }, [selectedMonths, fetchSessions]);

  const filteredSessions = useMemo(() => {
    const prefixes = selectedMonths.map((m) => `${m.year}-${pad(m.month)}`);
    return sessions.filter((s) =>
      prefixes.some(
        (p) => s.plannedDate.startsWith(p) || (s.actualDate && s.actualDate.startsWith(p))
      )
    );
  }, [sessions, selectedMonths]);

  const selectedStudent = selectedStudentId
    ? students.find((s) => s.id === selectedStudentId) ?? null
    : null;

  const selectedClass = selectedClassId
    ? classes.find((c) => c.id === selectedClassId) ?? null
    : null;

  const familyGroups = useMemo(() => {
    const groups = new Map<string, Student[]>();
    for (const student of students) {
      const name = student.familyGroup?.trim();
      if (!name) continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(student);
    }
    for (const members of groups.values()) {
      members.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [students]);

  const selectedFamilyMembers = selectedFamilyGroup
    ? familyGroups.find(([name]) => name === selectedFamilyGroup)?.[1] ?? []
    : [];

  // Group classes for class group selection
  const classGroups = useMemo(() => {
    return classes.filter((c) => c.type === 'group');
  }, [classes]);

  const studentSessions = useMemo(() => {
    if (selectedClassId) {
      return filteredSessions.filter((s) => s.classId === selectedClassId);
    }
    if (selectedFamilyGroup) {
      const groupIds = new Set(selectedFamilyMembers.map((s) => s.id));
      return filteredSessions.filter((s) => {
        if (s.studentId) return groupIds.has(s.studentId);
        if (s.classId) {
          return enrollments.some(
            (e) => e.classId === s.classId && groupIds.has(e.studentId)
          );
        }
        return false;
      });
    }
    if (!selectedStudentId) return filteredSessions;
    return filteredSessions.filter((s) => {
      if (s.studentId) return s.studentId === selectedStudentId;
      if (s.classId) {
        return enrollments.some(
          (e) => e.classId === s.classId && e.studentId === selectedStudentId
        );
      }
      return false;
    });
  }, [filteredSessions, selectedStudentId, selectedFamilyGroup, selectedFamilyMembers, selectedClassId, enrollments]);

  const familyMonthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [name, members] of familyGroups) {
      const ids = new Set(members.map((s) => s.id));
      let count = 0;
      for (const session of filteredSessions) {
        if (session.studentId) {
          if (ids.has(session.studentId)) count += 1;
        } else if (session.classId) {
          if (enrollments.some((e) => e.classId === session.classId && ids.has(e.studentId))) {
            count += 1;
          }
        }
      }
      counts.set(name, count);
    }
    return counts;
  }, [filteredSessions, familyGroups, enrollments]);

  const classMonthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cls of classGroups) {
      const count = filteredSessions.filter((s) => s.classId === cls.id).length;
      counts.set(cls.id, count);
    }
    return counts;
  }, [filteredSessions, classGroups]);

  const studentMonthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of filteredSessions) {
      if (session.studentId) {
        counts.set(session.studentId, (counts.get(session.studentId) ?? 0) + 1);
      } else if (session.classId) {
        for (const e of enrollments) {
          if (e.classId === session.classId) {
            counts.set(e.studentId, (counts.get(e.studentId) ?? 0) + 1);
          }
        }
      }
    }
    return counts;
  }, [filteredSessions, enrollments]);

  // Filter to show only students with 1-on-1 sessions (not group-only)
  const sortedStudents = useMemo(() => {
    const oneOnOneStudentIds = new Set(
      filteredSessions
        .filter((s) => s.studentId && !s.classId)
        .map((s) => s.studentId!)
    );
    
    return students
      .filter((s) => {
        // Always show students with 1-on-1 sessions
        if (oneOnOneStudentIds.has(s.id)) return true;
        // Hide students who only appear in group class sessions
        const hasGroupEnrollments = enrollments.some((e) => e.studentId === s.id);
        const hasOneOnOneSessions = filteredSessions.some(
          (sess) => sess.studentId === s.id && !sess.classId
        );
        return !hasGroupEnrollments || hasOneOnOneSessions;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, filteredSessions, enrollments]);

  const handleExport = async () => {
    if (studentSessions.length === 0) return;
    setExporting(true);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const root = createRoot(container);

    try {
      flushSync(() => {
        root.render(
          <ReviewExport
            months={selectedMonths}
            sessions={studentSessions}
            classes={classes}
            students={students}
            enrollments={enrollments}
            student={selectedStudent ?? undefined}
            familyGroup={selectedFamilyGroup ?? undefined}
            familyGroupStudents={selectedFamilyGroup ? selectedFamilyMembers : undefined}
            classGroup={selectedClass ?? undefined}
            locale={locale}
          />
        );
      });

      const target = container.firstElementChild as HTMLElement | null;
      if (!target) throw new Error('Export target not rendered');

      const canvas = await html2canvas(target, { scale: 2, backgroundColor: null });
      const dataUrl = canvas.toDataURL('image/png');

      const first = selectedMonths[0];
      const last = selectedMonths[selectedMonths.length - 1];
      const firstName = getMonthName(first.month, first.year, 'en').replace(/\s+/g, '_');
      const lastName = getMonthName(last.month, last.year, 'en').replace(/\s+/g, '_');
      const range =
        firstName === lastName && first.year === last.year
          ? `${firstName}_${first.year}`
          : `${firstName}_${first.year}-${lastName}_${last.year}`;
      const link = document.createElement('a');
      link.download = `Review_${range}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      root.unmount();
      container.remove();
      setExporting(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
          {locale === 'zh' ? '月度回顾' : 'Monthly Review'}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-gray-500">
              {locale === 'zh' ? '从' : 'From'}
            </span>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {getMonthName(m, startYear, locale)}
                </option>
              ))}
            </select>
            <select
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-gray-500">
              {locale === 'zh' ? '至' : 'To'}
            </span>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {getMonthName(m, endYear, locale)}
                </option>
              ))}
            </select>
            <select
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || studentSessions.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : locale === 'zh' ? '导出 PNG' : 'Export PNG'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
          Error loading sessions: {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-gray-500">Loading sessions...</div>
      ) : !selectedStudent && !selectedFamilyGroup && !selectedClassId ? (
        <div
          className="rounded-xl border overflow-hidden bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"
        >
          {sortedStudents.length === 0 && classGroups.length === 0 && familyGroups.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-gray-500">
              {locale === 'zh' ? '暂无学生。' : 'No students yet.'}
            </div>
          ) : (
            <>
              {/* Class Groups */}
              {classGroups.map((cls) => {
                const count = classMonthCounts.get(cls.id) ?? 0;
                return (
                  <button
                    key={`class-${cls.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(cls.id);
                      setSelectedStudentId(null);
                      setSelectedFamilyGroup(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 border-b bg-amber-50 dark:bg-amber-900/20 border-slate-200 dark:border-gray-700"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cls.color || '#f59e0b' }}
                    />
                    <span className="flex-1 text-sm font-medium truncate text-slate-900 dark:text-white">
                      {cls.name}
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-gray-500">
                        {locale === 'zh' ? '班级' : 'Class'}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-gray-500">
                      {locale === 'zh' ? `${count} 节课本月` : `${count} classes in selected period`}
                    </span>
                  </button>
                );
              })}
              
              {/* Family Groups */}
              {familyGroups.map(([name, members]) => {
                const count = familyMonthCounts.get(name) ?? 0;
                return (
                  <button
                    key={`family-${name}`}
                    type="button"
                    onClick={() => {
                      setSelectedFamilyGroup(name);
                      setSelectedStudentId(null);
                      setSelectedClassId(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 border-b bg-slate-50 dark:bg-gray-900/40 border-slate-200 dark:border-gray-700"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: members[0]?.color || '#0ea5e9' }}
                    />
                    <span className="flex-1 text-sm font-medium truncate text-slate-900 dark:text-white">
                      {name}
                      <span className="ml-2 text-xs font-normal text-slate-500 dark:text-gray-500">
                        {locale === 'zh' ? '家庭' : 'Family'}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-gray-500">
                      {members.length} {locale === 'zh' ? '名学生' : 'students'} ·{' '}
                      {locale === 'zh' ? `${count} 节课本月` : `${count} classes in selected period`}
                    </span>
                  </button>
                );
              })}
              
              {/* Individual Students (1-on-1 only) */}
              {sortedStudents.map((student, index) => {
                const count = studentMonthCounts.get(student.id) ?? 0;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      setSelectedFamilyGroup(null);
                      setSelectedClassId(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                      familyGroups.length > 0 || classGroups.length > 0 || index < sortedStudents.length - 1 ? 'border-b border-slate-200 dark:border-gray-700' : ''
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: student.color || '#6366f1' }}
                    />
                    <span className="flex-1 text-sm font-medium truncate text-slate-900 dark:text-white">
                      {student.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-gray-500">
                      {locale === 'zh' ? `${count} 节课本月` : `${count} classes in selected period`}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      ) : studentSessions.length === 0 ? (
        <div
          className="p-8 text-center text-sm rounded-xl border text-slate-500 dark:text-gray-500 bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"
        >
          {locale === 'zh' ? '所选时间段没有课程记录。' : 'No sessions found for the selected period.'}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedStudentId(null);
              setSelectedFamilyGroup(null);
              setSelectedClassId(null);
            }}
            className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100 text-indigo-600 dark:text-indigo-400"
          >
            ← {locale === 'zh' ? '所有学生' : 'All students'}
          </button>
          <div className="flex justify-center">
            <ReviewExport
              months={selectedMonths}
              sessions={studentSessions}
              classes={classes}
              students={students}
              enrollments={enrollments}
              student={selectedStudent ?? undefined}
              familyGroup={selectedFamilyGroup ?? undefined}
              familyGroupStudents={selectedFamilyGroup ? selectedFamilyMembers : undefined}
              classGroup={selectedClass ?? undefined}
              locale={locale}
            />
          </div>
        </div>
      )}
    </div>
  );
}