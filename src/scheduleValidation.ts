import { ClassSession } from './types';

export function checkScheduleConflict(
  newSession: Omit<ClassSession, 'id'>, 
  existingSessions: ClassSession[], 
  editingId?: string
): ClassSession | null {
  const newStart = parseTime(newSession.startTime);
  const newEnd = parseTime(newSession.endTime);

  if (newEnd <= newStart) {
    throw new Error("La hora de finalización debe ser posterior a la hora de inicio.");
  }

  for (const session of existingSessions) {
    if (session.id === editingId) continue;
    if (session.dayOfWeek !== newSession.dayOfWeek) continue;

    const existingStart = parseTime(session.startTime);
    const existingEnd = parseTime(session.endTime);

    // Conflict logic: new starts before existing ends AND new ends after existing starts
    // E.g. existing 08:00 - 10:00. New 09:30 - 11:00.
    // 09:30 < 10:00 (true) AND 11:00 > 08:00 (true) -> conflict.
    // E.g. existing 08:00 - 10:00. New 10:00 - 12:00
    // 10:00 < 10:00 (false) -> no conflict.
    if (newStart < existingEnd && newEnd > existingStart) {
      return session; // Returns the conflicting session
    }
  }

  return null;
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
