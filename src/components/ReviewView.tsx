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

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [locale, setLocale] = useState<'en' | 'zh'>('zh');
  const [exporting, setExporting] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    const start = new Date(year, month - 1, 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(year, month - 1, getDaysInMonth(year, month));
    end.setDate(end.getDate() + 7);

    fetchSessions({
      startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    });
  }, [month, year, fetchSessions]);

  const filteredSessions = useMemo(() => {
    const prefix = `${year}-${pad(month)}`;
    return sessions.filter(
      (s) => s.plannedDate.startsWith(prefix) || (s.actualDate && s.actualDate.startsWith(prefix))
    );
  }, [sessions, month, year]);

  const selectedStudent = selectedStudentId
    ? students.find((s) => s.id === selectedStudentId) ?? null
    : null;

  const studentSessions = useMemo(() => {
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
  }, [filteredSessions, selectedStudentId, enrollments]);

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

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );

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
            month={month}
            year={year}
            sessions={studentSessions}
            classes={classes}
            students={students}
            enrollments={enrollments}
            student={selectedStudent ?? undefined}
            locale={locale}
          />
        );
      });

      const target = container.firstElementChild as HTMLElement | null;
      if (!target) throw new Error('Export target not rendered');

      const canvas = await html2canvas(target, { scale: 2, backgroundColor: null });
      const dataUrl = canvas.toDataURL('image/png');

      const monthName = getMonthName(month, year, 'en').replace(/\s+/g, '_');
      const link = document.createElement('a');
      link.download = `Review_${monthName}_${year}.png`;
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
        <h2 className="text-lg font-semibold" style={{ color: '#1e293b' }}>
          {locale === 'zh' ? '月度回顾' : 'Monthly Review'}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {getMonthName(m, year, locale)}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
            className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#cbd5e1', color: '#0f172a' }}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || studentSessions.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}
          >
            {exporting ? 'Exporting...' : locale === 'zh' ? '导出 PNG' : 'Export PNG'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
          Error loading sessions: {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm" style={{ color: '#64748b' }}>Loading sessions...</div>
      ) : !selectedStudent ? (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
        >
          {sortedStudents.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: '#64748b' }}>
              {locale === 'zh' ? '暂无学生。' : 'No students yet.'}
            </div>
          ) : (
            sortedStudents.map((student) => {
              const count = studentMonthCounts.get(student.id) ?? 0;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedStudentId(student.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 border-b last:border-b-0"
                  style={{ borderColor: '#e2e8f0' }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: student.color || '#6366f1' }}
                  />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: '#0f172a' }}>
                    {student.name}
                  </span>
                  <span className="text-xs" style={{ color: '#64748b' }}>
                    {locale === 'zh' ? `${count} 节课本月` : `${count} classes this month`}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : studentSessions.length === 0 ? (
        <div
          className="p-8 text-center text-sm rounded-xl border"
          style={{ color: '#64748b', backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
        >
          {locale === 'zh' ? '该月份没有课程记录。' : 'No sessions found for this month.'}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedStudentId(null)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: '#4f46e5' }}
          >
            ← {locale === 'zh' ? '所有学生' : 'All students'}
          </button>
          <div className="flex justify-center">
            <ReviewExport
              month={month}
              year={year}
              sessions={studentSessions}
              classes={classes}
              students={students}
              enrollments={enrollments}
              student={selectedStudent ?? undefined}
              locale={locale}
            />
          </div>
        </div>
      )}
    </div>
  );
}
