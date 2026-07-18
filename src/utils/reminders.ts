// src/utils/reminders.ts
import { supabase } from '../lib/supabase';
import type { Class, Enrollment, Reminder, Session, Student } from '../types';

function reminderExists(existing: Reminder[], type: Reminder['type'], referenceId?: string) {
  return existing.some(
    (r) => r.type === type && r.reference_id === referenceId && !r.dismissed_at
  );
}

async function createReminder(reminder: Omit<Reminder, 'id' | 'created_at'>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const { error } = await supabase.from('ck_reminders').insert({
    user_id: userData.user.id,
    type: reminder.type,
    reference_id: reminder.reference_id,
    title: reminder.title,
    body: reminder.body,
    scheduled_at: reminder.scheduled_at,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[ClassKeep] Failed to create reminder:', error);
  }
}

function getClassName(classes: Class[], classId: string | undefined): string {
  return classId ? classes.find((c) => c.id === classId)?.name ?? 'Class' : 'Class';
}

function getStudentNamesForClass(
  classId: string | undefined,
  enrollments: Array<{ classId: string; studentId: string }>,
  students: Student[]
): string {
  if (!classId) return 'No students';
  return (
    enrollments
      .filter((e) => e.classId === classId)
      .map((e) => students.find((s) => s.id === e.studentId)?.name)
      .filter(Boolean)
      .join(', ') || 'No students'
  );
}

function getSessionDisplayName(classes: Class[], students: Student[], session: Session): string {
  if (session.classId) return getClassName(classes, session.classId);
  if (session.studentId) return students.find((s) => s.id === session.studentId)?.name ?? 'Student';
  return 'Session';
}

function getSessionStudentNames(session: Session, enrollments: Enrollment[], students: Student[]): string {
  if (session.studentId) {
    return students.find((s) => s.id === session.studentId)?.name ?? 'Student';
  }
  return getStudentNamesForClass(session.classId, enrollments, students);
}

export async function checkPreClassReminders(
  sessions: Session[],
  classes: Class[],
  students: Student[],
  existingReminders: Reminder[],
  preClassMinutes: number = 30,
  enrollments: Array<{ classId: string; studentId: string }> = []
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const now = new Date();

  const upcoming = sessions.filter((session) => {
    if (session.status !== 'scheduled') return false;
    const sessionTime = new Date(`${session.plannedDate}T${session.plannedTime}`);
    const diffMinutes = (sessionTime.getTime() - now.getTime()) / 60_000;
    return diffMinutes > 0 && diffMinutes <= preClassMinutes;
  });

  for (const session of upcoming) {
    if (reminderExists(existingReminders, 'pre_class', session.id)) continue;

    const className = getSessionDisplayName(classes, students, session);
    const studentNames = getSessionStudentNames(session, enrollments, students);
    const sessionTime = new Date(`${session.plannedDate}T${session.plannedTime}`);
    const minutesUntil = Math.max(1, Math.ceil((sessionTime.getTime() - now.getTime()) / 60_000));

    await createReminder({
      user_id: userData.user.id,
      type: 'pre_class',
      reference_id: session.id,
      title: `Upcoming: ${className} in ${minutesUntil} min`,
      body: `${studentNames} — ${session.plannedTime} (${session.durationMinutes} min)`,
      scheduled_at: sessionTime.toISOString(),
    });
  }
}

export async function checkLowBalanceReminders(
  enrollments: Enrollment[],
  students: Student[],
  existingReminders: Reminder[],
  lowBalanceThreshold: number = 400
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const lowBalanceEnrollments = enrollments.filter(
    (e) => e.paymentType === 'prepaid' && e.prepaidBalance < lowBalanceThreshold
  );

  for (const enrollment of lowBalanceEnrollments) {
    if (reminderExists(existingReminders, 'low_balance', enrollment.id)) continue;

    const student = students.find((s) => s.id === enrollment.studentId);
    const studentName = student?.name ?? 'Student';
    const sessionsLeft = Math.max(0, Math.floor(enrollment.prepaidBalance / 200));

    await createReminder({
      user_id: userData.user.id,
      type: 'low_balance',
      reference_id: enrollment.id,
      title: `Low balance: ${studentName}`,
      body: `¥${enrollment.prepaidBalance.toFixed(2)} remaining — about ${sessionsLeft} sessions`,
    });
  }
}

export async function checkUnreviewedReminders(
  sessions: Session[],
  classes: Class[],
  existingReminders: Reminder[]
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  if (completedSessions.length === 0) return;

  const sessionIds = completedSessions.map((s) => s.id);
  const { data: reviews } = await supabase
    .from('ck_reviews')
    .select('session_id')
    .eq('user_id', userData.user.id)
    .in('session_id', sessionIds);

  const reviewedIds = new Set((reviews || []).map((r) => r.session_id as string));

  for (const session of completedSessions) {
    if (reviewedIds.has(session.id)) continue;
    if (reminderExists(existingReminders, 'unreviewed', session.id)) continue;

    const className = getSessionDisplayName(classes, students, session);
    const date = session.actualDate || session.plannedDate;

    await createReminder({
      user_id: userData.user.id,
      type: 'unreviewed',
      reference_id: session.id,
      title: `Unreviewed: ${className} on ${date}`,
      body: 'Session completed but not reviewed',
    });
  }
}

export async function generateDailyDigest(
  sessions: Session[],
  classes: Class[],
  _students: Student[],
  existingReminders: Reminder[],
  dailyDigestTime: string = '08:00'
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const today = new Date().toISOString().slice(0, 10);

  const alreadyExists = existingReminders.some((r) => {
    if (r.type !== 'daily_digest') return false;
    return (r.created_at ?? '').slice(0, 10) === today;
  });

  if (alreadyExists) return;

  const todaysSessions = sessions.filter(
    (s) => s.plannedDate === today && s.status === 'scheduled'
  );

  if (todaysSessions.length === 0) return;

  const items = todaysSessions
    .map((s) => {
      const name = getSessionDisplayName(classes, _students, s);
      return `${name} @ ${s.plannedTime}`;
    })
    .join(', ');

  await createReminder({
    user_id: userData.user.id,
    type: 'daily_digest',
    title: `Today: ${todaysSessions.length} classes`,
    body: items,
    scheduled_at: `${today}T${dailyDigestTime}`,
  });
}
