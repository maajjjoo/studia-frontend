import { generateStudyPlan } from './studyPlanner.ts';
import type { Activity, StudentProfile, Task } from './types.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: expected ${String(expected)} but got ${String(actual)}. ${message || ''}`
    );
  }
}

const baseProfile: StudentProfile = {
  name: 'Estudiante Prueba',
  program: 'Ingeniería',
  semester: '5',
  subjects: ['Interfaces', 'Bases de Datos'],
  classTimetable: [
    {
      id: 'c1',
      subject: 'Interfaces',
      dayOfWeek: 1, // Lunes
      startTime: '08:00',
      endTime: '10:00',
    },
  ],
  unavailableBlocks: [
    {
      id: 'u1',
      title: 'Almuerzo',
      dayOfWeek: 1,
      startTime: '12:00',
      endTime: '13:00',
    },
  ],
  studyPreferences: {
    preferredSessionDuration: 25,
    preferredBreakDuration: 5,
  },
  studyAvailability: [
    {
      dayOfWeek: 1, // Lunes
      startTime: '08:00',
      endTime: '16:00',
    },
    {
      dayOfWeek: 2, // Martes
      startTime: '14:00',
      endTime: '18:00',
    },
  ],
};

export function runStudyPlannerTests(): number {
  let passed = 0;

  // 1. Generación con datos válidos
  {
    const startDate = new Date('2026-10-12T00:00:00'); // Lunes
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Taller de Interfaces',
        priority: 'high',
        status: 'pending',
        dueDate: '2026-10-14',
        estimatedDuration: 50, // 2 sesiones de 25 min
        createdAt: Date.now(),
      },
    ];

    const plan = generateStudyPlan(baseProfile, tasks, [], startDate, 2);
    assertEqual(plan.length, 2, 'Should create 2 sessions for 50m task');
    assertEqual(plan[0].taskId, 't1');
    assertEqual(plan[0].date, '2026-10-12');
    assertEqual(plan[0].startTime, '10:00', 'Should start after class ends at 10:00');
    assertEqual(plan[0].endTime, '10:25');
    assertEqual(plan[0].duration, 25);

    assertEqual(plan[1].startTime, '10:30', 'Should start after 5m break');
    assertEqual(plan[1].endTime, '10:55');
    assertEqual(plan[1].duration, 25);
    passed++;
  }

  // 2. Fallback para tareas sin duración estimada
  {
    const startDate = new Date('2026-10-12T00:00:00');
    const tasks: Task[] = [
      {
        id: 't-no-dur',
        title: 'Lectura sin duración explícita',
        priority: 'medium',
        status: 'pending',
        createdAt: Date.now(),
      },
    ];

    const plan = generateStudyPlan(baseProfile, tasks, [], startDate, 1);
    assertEqual(plan.length, 1, 'Should schedule 1 block using default duration');
    assertEqual(plan[0].taskId, 't-no-dur');
    assertEqual(plan[0].duration, 25, 'Should default to preferredSessionDuration (25m)');
    passed++;
  }

  // 3. Manejo de datos insuficientes (sin tareas pendientes o solo completadas)
  {
    const startDate = new Date('2026-10-12T00:00:00');
    const planEmpty = generateStudyPlan(baseProfile, [], [], startDate, 2);
    assertEqual(planEmpty.length, 0, 'Empty tasks should return 0 proposals');

    const completedTasks: Task[] = [
      {
        id: 'tc1',
        title: 'Tarea ya lista',
        priority: 'high',
        status: 'completed',
        estimatedDuration: 60,
        createdAt: Date.now(),
      },
    ];
    const planCompleted = generateStudyPlan(baseProfile, completedTasks, [], startDate, 2);
    assertEqual(planCompleted.length, 0, 'Completed tasks should not be scheduled');
    passed++;
  }

  // 4. Tareas ya cubiertas no se duplican
  {
    const startDate = new Date('2026-10-12T00:00:00');
    const tasks: Task[] = [
      {
        id: 't-covered',
        title: 'Tarea con estudio agendado',
        priority: 'high',
        status: 'pending',
        estimatedDuration: 30,
        createdAt: Date.now(),
      },
    ];

    const existingActivities: Activity[] = [
      {
        id: 'a1',
        title: 'Estudio: Tarea con estudio agendado',
        date: '2026-10-12',
        startTime: '10:00',
        endTime: '10:30',
        category: 'study_block',
        taskId: 't-covered',
        createdAt: Date.now(),
      },
    ];

    const plan = generateStudyPlan(baseProfile, tasks, existingActivities, startDate, 2);
    assertEqual(plan.length, 0, 'Already scheduled task should yield 0 new proposals');
    passed++;
  }

  // 5. Restricción de unavailableBlocks y clases
  {
    const startDate = new Date('2026-10-12T00:00:00');
    const tasks: Task[] = [
      {
        id: 't-long',
        title: 'Proyecto final extenso',
        priority: 'high',
        status: 'pending',
        estimatedDuration: 180,
        createdAt: Date.now(),
      },
    ];

    const plan = generateStudyPlan(baseProfile, tasks, [], startDate, 1);
    assert(plan.length > 0, 'Should generate proposals');

    for (const block of plan) {
      const [h1, m1] = block.startTime.split(':').map(Number);
      const [h2, m2] = block.endTime.split(':').map(Number);
      const startM = h1 * 60 + m1;
      const endM = h2 * 60 + m2;

      // Clase de 08:00 a 10:00 (480 a 600)
      const overlapsClass = startM < 600 && endM > 480;
      assert(!overlapsClass, `Bloque ${block.startTime}-${block.endTime} se solapa con clase`);

      // Almuerzo de 12:00 a 13:00 (720 a 780)
      const overlapsLunch = startM < 780 && endM > 720;
      assert(!overlapsLunch, `Bloque ${block.startTime}-${block.endTime} se solapa con almuerzo`);
    }
    passed++;
  }

  // 6. Respeto a fechas de entrega (dueDate)
  {
    const startDate = new Date('2026-10-12T00:00:00');
    const tasks: Task[] = [
      {
        id: 't-due-monday',
        title: 'Entrega lunes',
        priority: 'high',
        status: 'pending',
        dueDate: '2026-10-12',
        estimatedDuration: 60,
        createdAt: Date.now(),
      },
    ];

    const plan = generateStudyPlan(baseProfile, tasks, [], startDate, 3);
    for (const block of plan) {
      assert(block.date <= '2026-10-12', 'No debe planificarse después de la fecha de entrega');
    }
    passed++;
  }

  // 7. Ajuste exacto para tareas con duración menor que la sesión estándar
  {
    const startDate = new Date('2026-10-12T00:00:00');
    const tasks: Task[] = [
      {
        id: 't-short',
        title: 'Repaso rápido',
        priority: 'medium',
        status: 'pending',
        estimatedDuration: 15,
        createdAt: Date.now(),
      },
    ];

    const plan = generateStudyPlan(baseProfile, tasks, [], startDate, 1);
    assertEqual(plan.length, 1);
    assertEqual(plan[0].duration, 15);
    assertEqual(plan[0].startTime, '10:00');
    assertEqual(plan[0].endTime, '10:15');
    passed++;
  }

  return passed;
}

const passedCount = runStudyPlannerTests();
console.log(`All ${passedCount} study planner test suites passed.`);
