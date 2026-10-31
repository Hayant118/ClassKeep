// src/hooks/useProgress.ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ClassCurriculum, CurriculumStatus, LessonLog, StudentCurriculum } from '../types';

function classCurriculumFromDb(row: Record<string, unknown>): ClassCurriculum {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    classId: row.class_id as string,
    curriculumId: row.curriculum_id as string,
    currentPosition: (row.current_position as string | undefined) ?? undefined,
    nextUp: (row.next_up as string | undefined) ?? undefined,
    status: (row.status as CurriculumStatus) ?? 'active',
    updatedAt: row.updated_at as string,
  };
}

function classCurriculumToDb(cc: Partial<ClassCurriculum>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (cc.classId !== undefined) map.class_id = cc.classId;
  if (cc.curriculumId !== undefined) map.curriculum_id = cc.curriculumId;
  if (cc.currentPosition !== undefined) map.current_position = cc.currentPosition ?? null;
  if (cc.nextUp !== undefined) map.next_up = cc.nextUp ?? null;
  if (cc.status !== undefined) map.status = cc.status;
  return map;
}

function studentCurriculumFromDb(row: Record<string, unknown>): StudentCurriculum {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    studentId: row.student_id as string,
    curriculumId: row.curriculum_id as string,
    currentPosition: (row.current_position as string | undefined) ?? undefined,
    nextUp: (row.next_up as string | undefined) ?? undefined,
    status: (row.status as CurriculumStatus) ?? 'active',
    updatedAt: row.updated_at as string,
  };
}

function studentCurriculumToDb(sc: Partial<StudentCurriculum>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  if (sc.studentId !== undefined) map.student_id = sc.studentId;
  if (sc.curriculumId !== undefined) map.curriculum_id = sc.curriculumId;
  if (sc.currentPosition !== undefined) map.current_position = sc.currentPosition ?? null;
  if (sc.nextUp !== undefined) map.next_up = sc.nextUp ?? null;
  if (sc.status !== undefined) map.status = sc.status;
  return map;
}

function lessonLogFromDb(row: Record<string, unknown>): LessonLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionId: (row.session_id as string | undefined) ?? undefined,
    classId: (row.class_id as string | undefined) ?? undefined,
    studentId: (row.student_id as string | undefined) ?? undefined,
    curriculumId: row.curriculum_id as string,
    covered: (row.covered as string) ?? '',
    nextUp: (row.next_up as string | undefined) ?? undefined,
    progressType: (row.progress_type as 'group' | 'individual') ?? 'individual',
    createdAt: row.created_at as string,
  };
}

export function useProgress() {
  const [classCurricula, setClassCurricula] = useState<ClassCurriculum[]>([]);
  const [studentCurricula, setStudentCurricula] = useState<StudentCurriculum[]>([]);
  const [lessonLogs, setLessonLogs] = useState<LessonLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClassCurricula = useCallback(async (classId: string) => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_class_curricula')
      .select('*')
      .eq('class_id', classId)
      .order('updated_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setClassCurricula([]);
    } else {
      setClassCurricula((data || []).map(classCurriculumFromDb));
    }

    setLoading(false);
  }, []);

  // Load every class/student curriculum link for the current user (RLS-scoped),
  // for views that need previews across all entities (e.g. HomeView cards).
  const fetchAllProgress = useCallback(async () => {
    setError(null);

    const { data: ccRows, error: ccError } = await supabase
      .from('ck_class_curricula')
      .select('*')
      .order('updated_at', { ascending: false });
    if (ccError) {
      setError(ccError.message);
    } else {
      setClassCurricula((ccRows || []).map(classCurriculumFromDb));
    }

    const { data: scRows, error: scError } = await supabase
      .from('ck_student_curricula')
      .select('*')
      .order('updated_at', { ascending: false });
    if (scError) {
      setError(scError.message);
    } else {
      setStudentCurricula((scRows || []).map(studentCurriculumFromDb));
    }
  }, []);

  const fetchStudentCurricula = useCallback(async (studentId: string) => {
    setLoading(true);
    setError(null);

    const { data, error: sbError } = await supabase
      .from('ck_student_curricula')
      .select('*')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false });

    if (sbError) {
      setError(sbError.message);
      setStudentCurricula([]);
    } else {
      setStudentCurricula((data || []).map(studentCurriculumFromDb));
    }

    setLoading(false);
  }, []);

  const addClassCurriculum = async (
    cc: Omit<ClassCurriculum, 'id' | 'userId' | 'updatedAt'>
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...classCurriculumToDb(cc),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_class_curricula')
      .upsert(payload, { onConflict: 'class_id,curriculum_id' })
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const created = classCurriculumFromDb(data);
    setClassCurricula(prev =>
      prev.some(c => c.id === created.id)
        ? prev.map(c => (c.id === created.id ? created : c))
        : [created, ...prev]
    );
    return created;
  };

  const updateClassCurriculum = async (id: string, updates: Partial<ClassCurriculum>) => {
    const { data, error: sbError } = await supabase
      .from('ck_class_curricula')
      .update(classCurriculumToDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = classCurriculumFromDb(data);
    setClassCurricula(prev => prev.map(c => (c.id === id ? updated : c)));
    return updated;
  };

  const addStudentCurriculum = async (
    sc: Omit<StudentCurriculum, 'id' | 'userId' | 'updatedAt'>
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const payload = {
      ...studentCurriculumToDb(sc),
      user_id: userData.user.id,
    };

    const { data, error: sbError } = await supabase
      .from('ck_student_curricula')
      .upsert(payload, { onConflict: 'student_id,curriculum_id' })
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const created = studentCurriculumFromDb(data);
    setStudentCurricula(prev =>
      prev.some(c => c.id === created.id)
        ? prev.map(c => (c.id === created.id ? created : c))
        : [created, ...prev]
    );
    return created;
  };

  const updateStudentCurriculum = async (id: string, updates: Partial<StudentCurriculum>) => {
    const { data, error: sbError } = await supabase
      .from('ck_student_curricula')
      .update(studentCurriculumToDb(updates))
      .eq('id', id)
      .select()
      .single();

    if (sbError) throw new Error(sbError.message);

    const updated = studentCurriculumFromDb(data);
    setStudentCurricula(prev => prev.map(c => (c.id === id ? updated : c)));
    return updated;
  };

  const deleteStudentCurriculum = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_student_curricula')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setStudentCurricula(prev => prev.filter(c => c.id !== id));
  };

  const deleteClassCurriculum = async (id: string) => {
    const { error: sbError } = await supabase
      .from('ck_class_curricula')
      .delete()
      .eq('id', id);

    if (sbError) throw new Error(sbError.message);

    setClassCurricula(prev => prev.filter(c => c.id !== id));
  };

  const logLessonProgress = async (
    sessionId: string | undefined,
    classId: string | undefined,
    studentId: string | undefined,
    curriculumId: string,
    covered: string,
    nextUp: string | undefined,
    progressType: 'group' | 'individual'
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const logPayload = {
      user_id: userData.user.id,
      session_id: sessionId ?? null,
      class_id: classId ?? null,
      student_id: studentId ?? null,
      curriculum_id: curriculumId,
      covered,
      next_up: nextUp ?? null,
      progress_type: progressType,
    };

    const { data: logRow, error: logError } = await supabase
      .from('ck_lesson_logs')
      .insert(logPayload)
      .select()
      .single();

    if (logError) throw new Error(logError.message);

    const newLog = lessonLogFromDb(logRow);
    setLessonLogs(prev => [newLog, ...prev]);

    // Advance the linked curriculum's position (upsert so a missing row is
    // created instead of failing on the unique constraint)
    if (progressType === 'group' && classId) {
      const { data: updatedRow, error: updateError } = await supabase
        .from('ck_class_curricula')
        .upsert(
          {
            class_id: classId,
            curriculum_id: curriculumId,
            current_position: covered,
            next_up: nextUp ?? null,
          },
          { onConflict: 'class_id,curriculum_id' }
        )
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      const updated = classCurriculumFromDb(updatedRow);
      setClassCurricula(prev =>
        prev.some(c => c.id === updated.id)
          ? prev.map(c => (c.id === updated.id ? updated : c))
          : [updated, ...prev]
      );
    } else if (progressType === 'individual' && studentId) {
      const { data: updatedRow, error: updateError } = await supabase
        .from('ck_student_curricula')
        .upsert(
          {
            student_id: studentId,
            curriculum_id: curriculumId,
            current_position: covered,
            next_up: nextUp ?? null,
          },
          { onConflict: 'student_id,curriculum_id' }
        )
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      const updated = studentCurriculumFromDb(updatedRow);
      setStudentCurricula(prev =>
        prev.some(c => c.id === updated.id)
          ? prev.map(c => (c.id === updated.id ? updated : c))
          : [updated, ...prev]
      );
    }

    return newLog;
  };

  const fetchLessonLogs = useCallback(
    async (opts?: { studentId?: string; classId?: string; sessionId?: string }) => {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('ck_lesson_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (opts?.studentId) query = query.eq('student_id', opts.studentId);
      if (opts?.classId) query = query.eq('class_id', opts.classId);
      if (opts?.sessionId) query = query.eq('session_id', opts.sessionId);

      const { data, error: sbError } = await query;

      if (sbError) {
        setError(sbError.message);
        setLessonLogs([]);
      } else {
        setLessonLogs((data || []).map(lessonLogFromDb));
      }

      setLoading(false);
    },
    []
  );

  return {
    classCurricula,
    studentCurricula,
    lessonLogs,
    loading,
    error,
    fetchClassCurricula,
    fetchStudentCurricula,
    fetchAllProgress,
    addClassCurriculum,
    updateClassCurriculum,
    deleteClassCurriculum,
    addStudentCurriculum,
    updateStudentCurriculum,
    deleteStudentCurriculum,
    logLessonProgress,
    fetchLessonLogs,
  };
}
