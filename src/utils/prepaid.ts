// src/utils/prepaid.ts
import { supabase } from '../lib/supabase';
import type { Session, Student } from '../types';

export interface StudentPrepaidAdjustment {
  student: Student;
  direction: 'deduct' | 'restore';
  /** Signed amount to add to the student's prepaid balance. */
  delta: number;
}

/**
 * Plans the student-level prepaid balance change for a session status change
 * (ck_students.prepaid_balance; null = not tracked for that student).
 *
 * - Completing a 1-on-1 session deducts the session's total_charge and flags
 *   the session prepaid_deducted, so the deduction happens exactly once.
 * - Reverting a completed session restores the same stored charge and clears
 *   the flag.
 * - Group sessions (classId set) and students without tracked balances skip.
 *
 * `storedCharge` is the charge being written together with this transition
 * (flows that compute the charge alongside the status change, e.g. the session
 * modal and auto-complete); when omitted, the session's existing stored
 * totalCharge is used. A stored charge is never recomputed at deduction time.
 */
export function planStudentPrepaidAdjustment(
  session: Pick<Session, 'classId' | 'studentId' | 'status' | 'prepaidDeducted' | 'totalCharge'> | undefined,
  students: Student[],
  nextStatus: Session['status'],
  storedCharge?: number
): StudentPrepaidAdjustment | null {
  if (!session || session.classId || !session.studentId) return null;

  const wasCompleted = session.status === 'completed';
  const nowCompleted = nextStatus === 'completed';
  if (wasCompleted === nowCompleted) return null;

  const student = students.find((s) => s.id === session.studentId);
  if (!student || student.prepaidBalance == null) return null;

  if (nowCompleted) {
    if (session.prepaidDeducted) return null;
    const charge = storedCharge ?? session.totalCharge;
    if (charge == null) return null;
    return { student, direction: 'deduct', delta: -charge };
  }

  if (!session.prepaidDeducted || session.totalCharge == null) return null;
  return { student, direction: 'restore', delta: session.totalCharge };
}

/** Applies a planned adjustment to ck_students. */
export async function applyStudentPrepaidAdjustment(adj: StudentPrepaidAdjustment): Promise<void> {
  const nextBalance = (adj.student.prepaidBalance ?? 0) + adj.delta;
  const { error } = await supabase
    .from('ck_students')
    .update({ prepaid_balance: nextBalance })
    .eq('id', adj.student.id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update student prepaid balance', error);
    return;
  }

  await syncStudentLowBalanceReminder(adj.student, nextBalance);
}

export const DEFAULT_LOW_BALANCE_THRESHOLD = 300;

/**
 * Exact ck_payments.notes value written for prepaid top-ups. Billing treats
 * these as balance movements, not income: they are excluded from amount-owed
 * offsets and monthly revenue (they still show in payment history lists).
 */
export const PREPAID_TOP_UP_NOTE = 'Prepaid top-up';

/** Reads the global low_balance_threshold preference (default 300). */
async function fetchGlobalLowBalanceThreshold(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return DEFAULT_LOW_BALANCE_THRESHOLD;

  const { data, error } = await supabase
    .from('ck_preferences')
    .select('low_balance_threshold')
    .eq('user_id', userData.user.id)
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch low balance threshold preference:', error);
    return DEFAULT_LOW_BALANCE_THRESHOLD;
  }
  return (data?.low_balance_threshold as number | undefined) ?? DEFAULT_LOW_BALANCE_THRESHOLD;
}

/**
 * Keeps the low_balance reminder for a tracked student in sync with their
 * balance. Threshold is the student's own prepaid_threshold when set, else the
 * global preference. At or below threshold: create a reminder keyed by the
 * student id unless an active one exists (same dedupe check as pre_class).
 * Above threshold: auto-dismiss any active low_balance reminders for them.
 */
export async function syncStudentLowBalanceReminder(student: Student, balance: number): Promise<void> {
  const threshold = student.prepaidThreshold ?? (await fetchGlobalLowBalanceThreshold());

  if (balance > threshold) {
    const { error } = await supabase
      .from('ck_reminders')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('type', 'low_balance')
      .eq('reference_id', student.id)
      .is('dismissed_at', null);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to auto-dismiss low_balance reminder:', error);
    }
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // Dedupe check, mirroring the pre_class createReminder pattern; the partial
  // unique index ck_reminders_low_balance_unique backs this up against races.
  const { count, error: checkError } = await supabase
    .from('ck_reminders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userData.user.id)
    .eq('type', 'low_balance')
    .eq('reference_id', student.id)
    .is('dismissed_at', null);

  if (checkError) {
    // eslint-disable-next-line no-console
    console.error('Failed to check for existing low_balance reminder:', checkError);
    return;
  }
  if (count && count > 0) return;

  const { error } = await supabase.from('ck_reminders').insert({
    user_id: userData.user.id,
    type: 'low_balance',
    reference_id: student.id,
    title: `${student.name}'s prepaid balance is low — ¥${balance.toFixed(2)} remaining`,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create low_balance reminder:', error);
  }
}
