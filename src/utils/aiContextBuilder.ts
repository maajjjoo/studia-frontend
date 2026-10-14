import { DAY_NAMES } from '../scheduleValidation.ts';
import type { Activity, FocusSession, StudentProfile, Task } from '../types.ts';
import { getWeeklyFocusData } from './studyHelpers.ts';

export const AI_CONTEXT_CAPS = {
  maxSubjects: 20,
  maxClassSchedule: 40,
  maxAvailability: 21,
  maxPendingTasks: 25,
  maxUpcomingActivities: 25,
  maxHistoryMessages: 10,
  maxMessageLength: 4000,
  maxHistoryMessageLength: 2500,
  maxTotalHistoryChars: 12000,
} as const;

export interface AcademicContextSnapshot {
  currentDate: string;
  subjects: string[];
  classSchedule: {
    subject: string;
    dayName: string;
    startTime: string;
    endTime: string;
    room?: string;
  }[];
  studyAvailability: {
    dayName: string;
    startTime: string;
    endTime: string;
  }[];
  studyPreferences: {
    preferredSessionDuration: number;
    preferredBreakDuration: number;
  };
  pendingTasks: {
    title: string;
    dueDate?: string;
    priority: 'low' | 'medium' | 'high';
    remainingMinutes: number;
    isOverdue: boolean;
  }[];
  completedTasksCount: number;
  upcomingActivities: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    category: string;
  }[];
  focusSummary: {
    todayFocusMinutes: number;
    weeklyFocusMinutes: number;
    completedSessionsThisWeek: number;
  };
}

function toMinutes(timeStr: string): number {
  const parts = (timeStr || '').split(':').map(Number);
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
    return 0;
  }
  return Math.max(0, parts[0] * 60 + parts[1]);
}

function formatLocalDate(dateObj: Date): string {
  return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
}

/**
 * Construye un resumen compacto, relevante y libre de datos sensibles (sin nombre personal,
 * sin rutas locales de ejecutables y sin listas de sitios/apps bloqueadas) para enviar al backend de IA.
 */
export function buildAcademicContextSnapshot(
  input: {
    profile?: StudentProfile | null;
    tasks?: Task[];
    activities?: Activity[];
    focusSessions?: FocusSession[];
  },
  now: Date = new Date()
): AcademicContextSnapshot {
  const currentDate = formatLocalDate(now);
  const futureLimitDateObj = new Date(now);
  futureLimitDateObj.setDate(now.getDate() + 7);
  const futureLimitDate = formatLocalDate(futureLimitDateObj);

  const profile = input.profile || null;
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const activities = Array.isArray(input.activities) ? input.activities : [];
  const focusSessions = Array.isArray(input.focusSessions) ? input.focusSessions : [];

  const subjects = (profile?.subjects || [])
    .map(s => (s || '').trim())
    .filter(Boolean)
    .slice(0, AI_CONTEXT_CAPS.maxSubjects);

  const classSchedule = (profile?.classTimetable || [])
    .slice(0, AI_CONTEXT_CAPS.maxClassSchedule)
    .map(cls => ({
      subject: (cls.subject || '').trim().slice(0, 80),
      dayName: DAY_NAMES[(cls.dayOfWeek || 1) - 1] || 'Lunes',
      startTime: cls.startTime,
      endTime: cls.endTime,
      ...(cls.room && cls.room.trim() ? { room: cls.room.trim().slice(0, 60) } : {}),
    }))
    .filter(cls => cls.subject.length > 0);

  const studyAvailability = (profile?.studyAvailability || [])
    .slice(0, AI_CONTEXT_CAPS.maxAvailability)
    .map(slot => ({
      dayName: DAY_NAMES[(slot.dayOfWeek || 1) - 1] || 'Lunes',
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

  const studyPreferences = {
    preferredSessionDuration: profile?.studyPreferences?.preferredSessionDuration || 25,
    preferredBreakDuration: profile?.studyPreferences?.preferredBreakDuration || 5,
  };

  const priorityRank = { high: 3, medium: 2, low: 1 } as const;

  const pendingTasks = tasks
    .filter(t => t.status === 'pending')
    .map(t => {
      const scheduledMinutes = activities
        .filter(a => a.category === 'study_block' && a.taskId === t.id)
        .reduce((acc, block) => {
          return acc + Math.max(0, toMinutes(block.endTime) - toMinutes(block.startTime));
        }, 0);

      const estimated = Math.max(0, Number(t.estimatedDuration) || 0);
      const remainingMinutes = Math.max(0, estimated - scheduledMinutes);
      const isOverdue = Boolean(t.dueDate && t.dueDate < currentDate);

      return {
        title: (t.title || '').trim().slice(0, 120),
        ...(t.dueDate ? { dueDate: t.dueDate } : {}),
        priority: t.priority || 'medium',
        remainingMinutes,
        isOverdue,
      };
    })
    .filter(t => t.title.length > 0)
    .sort((a, b) => {
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return priorityRank[b.priority] - priorityRank[a.priority];
    })
    .slice(0, AI_CONTEXT_CAPS.maxPendingTasks);

  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;

  const upcomingActivities = activities
    .filter(a => a.date >= currentDate && a.date <= futureLimitDate)
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    .slice(0, AI_CONTEXT_CAPS.maxUpcomingActivities)
    .map(a => ({
      title: (a.title || '').trim().slice(0, 120),
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      category: a.category,
    }));

  const weeklyFocusSecsByDay = getWeeklyFocusData(focusSessions);
  const weeklyFocusSeconds = weeklyFocusSecsByDay.reduce((acc, s) => acc + s, 0);

  const todayFocusSeconds = focusSessions
    .filter(s => {
      if (!s.completed || s.mode !== 'focus') return false;
      const sessionDate = formatLocalDate(new Date(s.startTime));
      return sessionDate === currentDate;
    })
    .reduce((acc, s) => acc + s.duration, 0);

  const completedSessionsThisWeek = focusSessions.filter(
    s => s.completed && s.mode === 'focus'
  ).length;

  return {
    currentDate,
    subjects,
    classSchedule,
    studyAvailability,
    studyPreferences,
    pendingTasks,
    completedTasksCount,
    upcomingActivities,
    focusSummary: {
      todayFocusMinutes: Math.round(todayFocusSeconds / 60),
      weeklyFocusMinutes: Math.round(weeklyFocusSeconds / 60),
      completedSessionsThisWeek,
    },
  };
}
