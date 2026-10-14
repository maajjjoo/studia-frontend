import {
  FIELD_LIMITS,
  DURATION_LIMITS,
  parseTime,
  validateTimeRange,
  checkScheduleConflict,
  validateClassSessionInput,
  validateSubjectName,
  validateTaskInput,
  validateActivityInput,
  validateAvailabilitySlots,
  validateProfileInput,
} from './scheduleValidation.ts';
import type { ClassSession, StudentProfile } from './types.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runScheduleValidationTests(): number {
  let passed = 0;

  const baseSessions: ClassSession[] = [
    {
      id: 'class-1',
      subject: 'Cálculo Diferencial',
      dayOfWeek: 1, // Lunes
      startTime: '10:00',
      endTime: '12:00',
      room: 'Aula 201',
    },
    {
      id: 'class-2',
      subject: 'Física Mecánica',
      dayOfWeek: 1, // Lunes
      startTime: '14:00',
      endTime: '16:00',
    },
  ];

  // 1. Conflicto entre dos materias en el mismo día con rangos superpuestos
  {
    // Exact overlap
    const exactConflict = checkScheduleConflict(
      { subject: 'Álgebra Lineal', dayOfWeek: 1, startTime: '10:00', endTime: '12:00' },
      baseSessions
    );
    assert(exactConflict?.id === 'class-1', 'Should detect exact overlap on same day');

    // Partial overlap (11:00 - 13:00 vs 10:00 - 12:00)
    const partialConflict = checkScheduleConflict(
      { subject: 'Álgebra Lineal', dayOfWeek: 1, startTime: '11:00', endTime: '13:00' },
      baseSessions
    );
    assert(partialConflict?.id === 'class-1', 'Should detect partial overlap on same day');

    // Contained overlap (09:00 - 13:00 enclosing 10:00 - 12:00)
    const enclosingConflict = checkScheduleConflict(
      { subject: 'Álgebra Lineal', dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      baseSessions
    );
    assert(enclosingConflict?.id === 'class-1', 'Should detect enclosing overlap on same day');

    const validationError = validateClassSessionInput(
      { subject: 'Álgebra Lineal', dayOfWeek: 1, startTime: '11:00', endTime: '13:00' },
      baseSessions
    );
    assert(
      validationError !== null &&
        validationError.includes('Cálculo Diferencial') &&
        validationError.includes('Lunes') &&
        validationError.includes('10:00 a 12:00'),
      'Conflict message should identify conflicting class, day, and time range'
    );
    passed++;
  }

  // 2. Materias consecutivas permitidas (08:00-10:00 y 10:00-12:00; 12:00-14:00)
  {
    const beforeConflict = checkScheduleConflict(
      { subject: 'Química', dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
      baseSessions
    );
    assert(beforeConflict === null, 'Consecutive class before (08:00-10:00) should be allowed');

    const betweenConflict = checkScheduleConflict(
      { subject: 'Programación', dayOfWeek: 1, startTime: '12:00', endTime: '14:00' },
      baseSessions
    );
    assert(betweenConflict === null, 'Consecutive class between (12:00-14:00) should be allowed');
    passed++;
  }

  // 3. Materias con el mismo horario en días distintos permitidas
  {
    const differentDayConflict = checkScheduleConflict(
      { subject: 'Inglés', dayOfWeek: 2, startTime: '10:00', endTime: '12:00' },
      baseSessions
    );
    assert(
      differentDayConflict === null,
      'Class at same time on different day (Martes vs Lunes) should be allowed'
    );
    passed++;
  }

  // 4. Edición de una materia sin falso positivo consigo misma
  {
    const selfEditConflict = checkScheduleConflict(
      { subject: 'Cálculo Diferencial', dayOfWeek: 1, startTime: '10:00', endTime: '12:30' },
      baseSessions,
      'class-1'
    );
    assert(selfEditConflict === null, 'Editing a class should not conflict with itself');

    const editIntoOtherClass = checkScheduleConflict(
      { subject: 'Cálculo Diferencial', dayOfWeek: 1, startTime: '13:00', endTime: '15:00' },
      baseSessions,
      'class-1'
    );
    assert(
      editIntoOtherClass?.id === 'class-2',
      'Editing a class into another class slot should still report conflict'
    );
    passed++;
  }

  // 5. Eliminación y reutilización del horario liberado
  {
    const afterDeletion = baseSessions.filter(s => s.id !== 'class-1');
    const reuseSlotConflict = checkScheduleConflict(
      { subject: 'Nueva Materia', dayOfWeek: 1, startTime: '10:00', endTime: '12:00' },
      afterDeletion
    );
    assert(reuseSlotConflict === null, 'Deleted class slot should be reusable immediately');
    passed++;
  }

  // 6. Rechazo de horas negativas, horas fuera de rango y endTime <= startTime
  {
    const invalidTimes = ['-01:00', '10:-30', '24:00', '25:15', '12:60', 'abc', '', '   '];
    for (const bad of invalidTimes) {
      let threw = false;
      try {
        parseTime(bad);
      } catch {
        threw = true;
      }
      assert(threw, `parseTime should reject invalid time "${bad}"`);
    }

    assert(
      validateTimeRange('10:00', '10:00') !== null,
      'validateTimeRange should reject endTime === startTime'
    );
    assert(
      validateTimeRange('12:00', '10:00') !== null,
      'validateTimeRange should reject endTime < startTime'
    );
    assert(
      validateTimeRange('-02:00', '10:00') !== null,
      'validateTimeRange should reject negative startTime'
    );
    assert(
      validateTimeRange('08:00', '24:00') !== null,
      'validateTimeRange should reject out-of-range endTime'
    );
    assert(
      validateTimeRange('08:00', '10:00') === null,
      'validateTimeRange should accept valid range 08:00 - 10:00'
    );
    passed++;
  }

  // 7. Rechazo de campos vacíos, solo espacios, duraciones fuera de rango y límites de caracteres
  {
    // Subject validation
    assert(validateSubjectName('', []) !== null, 'Empty subject name should be rejected');
    assert(validateSubjectName('    ', []) !== null, 'Whitespace subject name should be rejected');
    assert(
      validateSubjectName('a'.repeat(FIELD_LIMITS.subjectName + 1), []) !== null,
      'Oversized subject name should be rejected'
    );
    assert(
      validateSubjectName('física', ['Física']) !== null,
      'Case-insensitive duplicate subject should be rejected'
    );
    assert(
      validateSubjectName('Estructuras de Datos', ['Física']) === null,
      'Valid subject name should be accepted'
    );

    // Class session character limits
    assert(
      validateClassSessionInput(
        {
          subject: 'Cálculo',
          dayOfWeek: 3,
          startTime: '08:00',
          endTime: '10:00',
          room: 'R'.repeat(FIELD_LIMITS.classRoom + 1),
        },
        baseSessions
      ) !== null,
      'Class room exceeding character limit should be rejected'
    );

    // Task validation
    assert(
      validateTaskInput({
        title: '   ',
        estimatedDuration: 60,
      }) !== null,
      'Whitespace task title should be rejected'
    );
    assert(
      validateTaskInput({
        title: 'T'.repeat(FIELD_LIMITS.taskTitle + 1),
        estimatedDuration: 60,
      }) !== null,
      'Task title exceeding limit should be rejected'
    );
    assert(
      validateTaskInput({
        title: 'Taller 1',
        estimatedDuration: -15,
      }) !== null,
      'Negative task duration should be rejected'
    );
    assert(
      validateTaskInput({
        title: 'Taller 1',
        estimatedDuration: DURATION_LIMITS.taskMaxMinutes + 1,
      }) !== null,
      'Excessive task duration should be rejected'
    );
    assert(
      validateTaskInput({
        title: 'Taller 1',
        estimatedDuration: 90,
        description: 'Ejercicios 1 al 10',
      }) === null,
      'Valid task input should be accepted'
    );

    // Activity validation
    assert(
      validateActivityInput({
        title: '   ',
        date: '2026-10-20',
        startTime: '10:00',
        endTime: '11:00',
      }) !== null,
      'Whitespace activity title should be rejected'
    );
    assert(
      validateActivityInput({
        title: 'Grupo de estudio',
        date: '2026-10-20',
        startTime: '11:00',
        endTime: '10:00',
      }) !== null,
      'Activity with endTime < startTime should be rejected'
    );

    // Availability & Profile validation
    assert(
      validateAvailabilitySlots([
        { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' },
        { dayOfWeek: 1, startTime: '09:30', endTime: '11:00' },
      ]) !== null,
      'Overlapping studyAvailability slots on same day should be rejected'
    );

    const validProfile: StudentProfile = {
      name: 'María José',
      program: 'Ingeniería de Sistemas',
      semester: '6to Semestre',
      subjects: ['Interfaces de Software'],
      classTimetable: [],
      unavailableBlocks: [],
      studyAvailability: [{ dayOfWeek: 1, startTime: '08:00', endTime: '10:00' }],
      studyPreferences: {
        preferredSessionDuration: 45,
        preferredBreakDuration: 10,
      },
    };
    assert(validateProfileInput(validProfile) === null, 'Valid profile should pass validation');

    assert(
      validateProfileInput({
        ...validProfile,
        studyPreferences: { preferredSessionDuration: 0, preferredBreakDuration: 10 },
      }) !== null,
      'Profile with 0 focus duration should be rejected'
    );
    assert(
      validateProfileInput({
        ...validProfile,
        studyPreferences: { preferredSessionDuration: 45, preferredBreakDuration: -5 },
      }) !== null,
      'Profile with negative break duration should be rejected'
    );
    passed++;
  }

  return passed;
}

const totalPassed = runScheduleValidationTests();
console.log(`All ${totalPassed} schedule & input validation test suites passed.`);
