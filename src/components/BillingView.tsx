// src/components/BillingView.tsx
import { useMemo, useState } from 'react';
import { useSessions } from '../hooks/useSessions';
import type { Session, Class, Student } from '../types';

interface BillingViewProps {
  sessions?: Session[];
  classes: Class[];
  students: Student[];
}

const now = new Date();

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function getMonthName(month: number, year: number, locale = 'zh-CN'): string {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
}

function getClassName(session: Session, classes: Class[]): string {
  return classes.find(c => c.id === session.classId)?.name ?? 'Unknown';
}

export function BillingView({ sessions: sessionsProp, classes, students: _students }: BillingViewProps) {
  const { sessions: fetchedSessions, loading, error } = useSessions();
  const sessions = sessionsProp ?? fetchedSessions;

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const prefix = useMemo(() => `${year}-${pad(month)}`, [month, year]);

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.actualDate?.startsWith(prefix) &&
          (s.status === 'completed' || s.isAdditional === true)
      ),
    [sessions, prefix]
  );

  const stats = useMemo(() => {
    const totalIncome = filteredSessions.reduce((sum, s) => sum + (s.totalCharge ?? 0), 0);
    const onlineCount = filteredSessions.filter(s => s.isOnline).length;
    const f2fCount = filteredSessions.length - onlineCount;
    const totalHours = filteredSessions.reduce((sum, s) => sum + s.durationMinutes / 60, 0);
    const avgRate = filteredSessions.length > 0 ? totalIncome / filteredSessions.length : 0;
    return { totalIncome, onlineCount, f2fCount, totalHours, avgRate };
  }, [filteredSessions]);

  const pastMonths = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      if (s.status === 'completed' || s.isAdditional) {
        if (s.actualDate) set.add(s.actualDate.slice(0, 7));
      }
    }
    return Array.from(set)
      .map((ym) => {
        const [y, m] = ym.split('-').map(Number);
        return { year: y, month: m, key: ym, label: `${getMonthName(m, y)} ${y}` };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [sessions]);

  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading sessions...</div>;
  }

  if (error) {
    return <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">Error loading sessions: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Billing</h2>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {getMonthName(m, year)}
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
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          No completed sessions for {getMonthName(month, year)} {year}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Total Income</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(stats.totalIncome)}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Sessions</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{filteredSessions.length}</div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.onlineCount} online, {stats.f2fCount} face-to-face
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Hours</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{stats.totalHours.toFixed(1)}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-xs text-slate-500">Average Rate</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(stats.avgRate)}</div>
              <div className="text-xs text-slate-500 mt-1">/ session</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
              Session details
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Class</th>
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Duration</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSessions
                    .slice()
                    .sort((a, b) => (a.actualDate ?? '').localeCompare(b.actualDate ?? ''))
                    .map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">{session.actualDate}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{getClassName(session, classes)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{(session.actualTime ?? session.plannedTime).slice(0, 5)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{session.durationMinutes} min</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="capitalize">{session.status}</span>
                          {session.isAdditional && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Additional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">{formatCurrency(session.totalCharge ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pastMonths.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-700 mb-2">Past Schedules</div>
          <ul className="space-y-1">
            {pastMonths
              .filter((m) => m.key !== prefix)
              .map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setMonth(m.month);
                      setYear(m.year);
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    {m.label}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
