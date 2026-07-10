// src/components/ReviewView.tsx
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useSessions } from '../hooks/useSessions';
import { ReviewExport } from './ReviewExport';
import type { Class, Student } from '../types';

interface ReviewViewProps {
  students: Student[];
  classes: Class[];
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

export function ReviewView({ students, classes }: ReviewViewProps) {
  const { sessions, loading, error, fetchSessions } = useSessions();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [locale, setLocale] = useState<'en' | 'zh'>('zh');
  const [exporting, setExporting] = useState(false);

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

  const handleExport = async () => {
    if (filteredSessions.length === 0) return;
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
            sessions={filteredSessions}
            classes={classes}
            students={students}
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
        <h2 className="text-lg font-semibold text-slate-800">
          {locale === 'zh' ? '月度回顾' : 'Monthly Review'}
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || filteredSessions.length === 0}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : locale === 'zh' ? '导出 PNG' : 'Export PNG'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
          Error loading sessions: {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading sessions...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          {locale === 'zh' ? '该月份没有课程记录。' : 'No sessions found for this month.'}
        </div>
      ) : (
        <div className="flex justify-center">
          <ReviewExport
            month={month}
            year={year}
            sessions={filteredSessions}
            classes={classes}
            students={students}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
