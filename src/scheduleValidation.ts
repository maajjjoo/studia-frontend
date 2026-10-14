import type { StudyAvailability, ClassSession, StudentProfile } from './types';

export const DAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

export const FIELD_LIMITS = {
  subjectName: 80,
  classRoom: 60,
  classTeacher: 80,
  classDescription: 250,
  taskTitle: 100,
  taskDescription: 500,
  activityTitle: 100,
  activityDescription: 500,
  userName: 80,
  programName: 100,
  semesterName: 40,
  domainName: 253,
} as const;

export const DURATION_LIMITS = {
  taskMinMinutes: 5,
  taskMaxMinutes: 1440,
  focusMinMinutes: 5,
  focusMaxMinutes: 180,
  breakMinMinutes: 1,
  breakMaxMinutes: 60,
} as const;

/**
 * Strictly parses a "HH:MM" time string within 00:00 - 23:59 into total minutes from midnight.
 * Throws a descriptive Error if the string is empty, negative, malformed, or out of range.
 */
export function parseTime(timeStr: string): number {
  if (typeof timeStr !== 'string') {
    throw new Error('Formato de hora inválido. Usa el formato HH:MM (00:00 a 23:59).');
  }

  const trimmed = timeStr.trim();
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) {
    throw new Error('Formato de hora inválido. Usa un horario válido entre 00:00 y 23:59.');
  }

  const [hoursStr, minutesStr] = trimmed.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('La hora debe estar dentro del rango válido del día (00:00 a 23:59).');
  }

  return hours * 60 + minutes;
}

export function validateTimeRange(startTime: string, endTime: string): string | null {
  try {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    if (end <= start) {
      return 'La hora de finalización debe ser posterior a la hora de inicio.';
    }
    return null;
  } catch (err: any) {
    return err.message || 'Rango de horas inválido.';
  }
}

export function checkScheduleConflict(
  newSession: Omit<ClassSession, 'id'>,
  existingSessions: ClassSession[],
  editingId?: string
): ClassSession | null {
  if (
    !Number.isInteger(newSession.dayOfWeek) ||
    newSession.dayOfWeek < 1 ||
    newSession.dayOfWeek > 7
  ) {
    throw new Error('El día de la semana seleccionado no es válido.');
  }

  const newStart = parseTime(newSession.startTime);
  const newEnd = parseTime(newSession.endTime);

  if (newEnd <= newStart) {
    throw new Error('La hora de finalización debe ser posterior a la hora de inicio.');
  }

  for (const session of existingSessions) {
    if (editingId && session.id === editingId) continue;
    if (session.dayOfWeek !== newSession.dayOfWeek) continue;

    const existingStart = parseTime(session.startTime);
    const existingEnd = parseTime(session.endTime);

    // Conflict logic: new starts before existing ends AND new ends after existing starts
    // Consecutive classes (newStart === existingEnd or newEnd === existingStart) are allowed.
    if (newStart < existingEnd && newEnd > existingStart) {
      return session;
    }
  }

  return null;
}

export function validateClassSessionInput(
  session: Omit<ClassSession, 'id'>,
  existingSessions: ClassSession[],
  editingId?: string
): string | null {
  const subject = (session.subject || '').trim();
  if (!subject) {
    return 'Debes seleccionar una materia válida.';
  }
  if (subject.length > FIELD_LIMITS.subjectName) {
    return `El nombre de la materia no puede superar los ${FIELD_LIMITS.subjectName} caracteres.`;
  }

  const room = (session.room || '').trim();
  if (room.length > FIELD_LIMITS.classRoom) {
    return `El aula o ubicación no puede superar los ${FIELD_LIMITS.classRoom} caracteres.`;
  }

  const teacher = (session.teacher || '').trim();
  if (teacher.length > FIELD_LIMITS.classTeacher) {
    return `El nombre del profesor no puede superar los ${FIELD_LIMITS.classTeacher} caracteres.`;
  }

  const description = (session.description || '').trim();
  if (description.length > FIELD_LIMITS.classDescription) {
    return `La descripción no puede superar los ${FIELD_LIMITS.classDescription} caracteres.`;
  }

  try {
    const conflict = checkScheduleConflict(session, existingSessions, editingId);
    if (conflict) {
      const dayLabel = DAY_NAMES[conflict.dayOfWeek - 1] || 'ese día';
      return `Cruce de horario con "${conflict.subject}" (${dayLabel} de ${conflict.startTime} a ${conflict.endTime}).`;
    }
  } catch (err: any) {
    return err.message || 'Horario inválido.';
  }

  return null;
}

export function validateSubjectName(name: string, existingSubjects: string[]): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return 'El nombre de la materia no puede estar vacío.';
  }
  if (trimmed.length > FIELD_LIMITS.subjectName) {
    return `El nombre de la materia no puede superar los ${FIELD_LIMITS.subjectName} caracteres.`;
  }
  if (existingSubjects.some(s => s.trim().toLowerCase() === trimmed.toLowerCase())) {
    return 'Esta materia ya está registrada.';
  }
  return null;
}

export function validateTaskInput(input: {
  title: string;
  description?: string;
  estimatedDuration?: string | number;
}): string | null {
  const trimmedTitle = (input.title || '').trim();
  if (!trimmedTitle) {
    return 'El título de la tarea es obligatorio y no puede contener solo espacios.';
  }
  if (trimmedTitle.length > FIELD_LIMITS.taskTitle) {
    return `El título de la tarea no puede superar los ${FIELD_LIMITS.taskTitle} caracteres.`;
  }

  const trimmedDesc = (input.description || '').trim();
  if (trimmedDesc.length > FIELD_LIMITS.taskDescription) {
    return `La descripción no puede superar los ${FIELD_LIMITS.taskDescription} caracteres.`;
  }

  if (
    input.estimatedDuration !== undefined &&
    input.estimatedDuration !== null &&
    String(input.estimatedDuration).trim() !== ''
  ) {
    const rawStr = String(input.estimatedDuration).trim();
    if (!/^-?\d+(\.\d+)?$/.test(rawStr)) {
      return 'La duración estimada debe ser un número entero válido.';
    }
    const num = Number(rawStr);
    if (
      !Number.isFinite(num) ||
      !Number.isInteger(num) ||
      num < DURATION_LIMITS.taskMinMinutes ||
      num > DURATION_LIMITS.taskMaxMinutes
    ) {
      return `La duración estimada debe ser un número entero entre ${DURATION_LIMITS.taskMinMinutes} y ${DURATION_LIMITS.taskMaxMinutes} minutos.`;
    }
  }

  return null;
}

export function validateActivityInput(input: {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
}): string | null {
  const trimmedTitle = (input.title || '').trim();
  if (!trimmedTitle) {
    return 'El título del evento es obligatorio y no puede contener solo espacios.';
  }
  if (trimmedTitle.length > FIELD_LIMITS.activityTitle) {
    return `El título del evento no puede superar los ${FIELD_LIMITS.activityTitle} caracteres.`;
  }

  const trimmedDesc = (input.description || '').trim();
  if (trimmedDesc.length > FIELD_LIMITS.activityDescription) {
    return `La descripción no puede superar los ${FIELD_LIMITS.activityDescription} caracteres.`;
  }

  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date.trim())) {
    return 'Debes seleccionar una fecha válida.';
  }

  return validateTimeRange(input.startTime, input.endTime);
}

export function validateAvailabilitySlots(slots: StudyAvailability[]): string | null {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 1 || slot.dayOfWeek > 7) {
      return 'Uno de los bloques de disponibilidad tiene un día inválido.';
    }
    const rangeErr = validateTimeRange(slot.startTime, slot.endTime);
    if (rangeErr) {
      const dayLabel = DAY_NAMES[slot.dayOfWeek - 1] || 'Día';
      return `En disponibilidad (${dayLabel}): ${rangeErr}`;
    }

    const startA = parseTime(slot.startTime);
    const endA = parseTime(slot.endTime);

    for (let j = i + 1; j < slots.length; j++) {
      const other = slots[j];
      if (other.dayOfWeek !== slot.dayOfWeek) continue;
      try {
        const startB = parseTime(other.startTime);
        const endB = parseTime(other.endTime);
        if (startA < endB && endA > startB) {
          const dayLabel = DAY_NAMES[slot.dayOfWeek - 1] || 'ese día';
          return `Las ventanas de disponibilidad del ${dayLabel} (${slot.startTime}-${slot.endTime} y ${other.startTime}-${other.endTime}) se solapan.`;
        }
      } catch {
        // Caught when the outer loop reaches j
      }
    }
  }
  return null;
}

export function validateProfileInput(profile: StudentProfile): string | null {
  const name = (profile.name || '').trim();
  if (!name) {
    return 'El nombre de usuario no puede estar vacío.';
  }
  if (name.length > FIELD_LIMITS.userName) {
    return `El nombre de usuario no puede superar los ${FIELD_LIMITS.userName} caracteres.`;
  }

  const program = (profile.program || '').trim();
  if (program.length > FIELD_LIMITS.programName) {
    return `El programa académico no puede superar los ${FIELD_LIMITS.programName} caracteres.`;
  }

  const semester = (profile.semester || '').trim();
  if (semester.length > FIELD_LIMITS.semesterName) {
    return `El semestre no puede superar los ${FIELD_LIMITS.semesterName} caracteres.`;
  }

  const sessionDur = Number(profile.studyPreferences?.preferredSessionDuration);
  if (
    !Number.isFinite(sessionDur) ||
    !Number.isInteger(sessionDur) ||
    sessionDur < DURATION_LIMITS.focusMinMinutes ||
    sessionDur > DURATION_LIMITS.focusMaxMinutes
  ) {
    return `La duración de enfoque debe ser un número entero entre ${DURATION_LIMITS.focusMinMinutes} y ${DURATION_LIMITS.focusMaxMinutes} minutos.`;
  }

  const breakDur = Number(profile.studyPreferences?.preferredBreakDuration);
  if (
    !Number.isFinite(breakDur) ||
    !Number.isInteger(breakDur) ||
    breakDur < DURATION_LIMITS.breakMinMinutes ||
    breakDur > DURATION_LIMITS.breakMaxMinutes
  ) {
    return `La duración del descanso corto debe ser un número entero entre ${DURATION_LIMITS.breakMinMinutes} y ${DURATION_LIMITS.breakMaxMinutes} minutos.`;
  }

  if (profile.studyAvailability && profile.studyAvailability.length > 0) {
    const availErr = validateAvailabilitySlots(profile.studyAvailability);
    if (availErr) return availErr;
  }

  return null;
}
