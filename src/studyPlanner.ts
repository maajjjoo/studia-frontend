import { Task, Activity, StudentProfile } from './types';

interface FreeBlock {
  start: number; // minutes from 00:00
  end: number;
}

export interface PlannerProposal {
  taskId: string;
  taskTitle: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  duration: number; // minutes
}

function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function generateStudyPlan(
  profile: StudentProfile,
  tasks: Task[],
  activities: Activity[],
  startDate: Date,
  daysToPlan: number = 7
): PlannerProposal[] {
  const proposals: PlannerProposal[] = [];
  
  // Filter valid pending tasks to schedule
  let pendingTasks = tasks
    .filter(t => t.status === 'pending' && (t.estimatedDuration || 0) > 0)
    .map(t => ({ ...t, remainingDuration: t.estimatedDuration! }));

  // Sort tasks: urgent first, then by priority
  pendingTasks.sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    } else if (a.dueDate && !b.dueDate) {
      return -1;
    } else if (!a.dueDate && b.dueDate) {
      return 1;
    }
    const pWeight = { high: 3, medium: 2, low: 1 };
    return pWeight[b.priority] - pWeight[a.priority];
  });

  if (pendingTasks.length === 0) return [];

  const sessionDuration = profile.studyPreferences?.preferredSessionDuration || 25;
  const breakDuration = profile.studyPreferences?.preferredBreakDuration || 5;

  for (let i = 0; i < daysToPlan; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dateStr = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay() || 7;

    // Determine base availability for the day
    let dailyAvail = profile.studyAvailability?.filter(a => a.dayOfWeek === dayOfWeek) || [];
    if (dailyAvail.length === 0) {
      // Default fallback if no availability is configured: 14:00 to 21:00
      dailyAvail = [{ dayOfWeek, startTime: '14:00', endTime: '21:00' }];
    }

    let freeBlocks: FreeBlock[] = dailyAvail.map(a => ({
      start: parseTime(a.startTime),
      end: parseTime(a.endTime)
    }));

    // Subtract classes
    const dayClasses = profile.classTimetable?.filter(c => c.dayOfWeek === dayOfWeek) || [];
    for (const c of dayClasses) {
      freeBlocks = subtractBlock(freeBlocks, parseTime(c.startTime), parseTime(c.endTime));
    }

    // Subtract fixed calendar activities and existing study blocks on this date
    const dayActivities = activities.filter(a => a.date === dateStr);
    for (const a of dayActivities) {
      freeBlocks = subtractBlock(freeBlocks, parseTime(a.startTime), parseTime(a.endTime));
    }

    // Fill free blocks with tasks
    for (let fb of freeBlocks) {
      let currentTime = fb.start;
      
      for (const task of pendingTasks) {
        if (task.remainingDuration <= 0) continue;

        while (task.remainingDuration > 0 && currentTime + sessionDuration <= fb.end) {
          const chunkDuration = Math.min(task.remainingDuration, sessionDuration);
          
          proposals.push({
            taskId: task.id,
            taskTitle: task.title,
            date: dateStr,
            startTime: formatTime(currentTime),
            endTime: formatTime(currentTime + chunkDuration),
            duration: chunkDuration
          });

          task.remainingDuration -= chunkDuration;
          currentTime += chunkDuration + breakDuration; // Add break after session
        }
      }
    }
  }

  return proposals;
}

function subtractBlock(blocks: FreeBlock[], subStart: number, subEnd: number): FreeBlock[] {
  const result: FreeBlock[] = [];
  for (const b of blocks) {
    if (subEnd <= b.start || subStart >= b.end) {
      // No overlap
      result.push(b);
    } else {
      // Overlap exists
      if (b.start < subStart) {
        result.push({ start: b.start, end: subStart });
      }
      if (b.end > subEnd) {
        result.push({ start: subEnd, end: b.end });
      }
    }
  }
  return result;
}
