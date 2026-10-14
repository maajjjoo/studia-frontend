import {
  CONFIGURED_PRODUCTION_BACKEND_URL,
  DEFAULT_BACKEND_URL,
  DEVELOPMENT_BACKEND_URL,
  LOCAL_DEVELOPMENT_BACKEND_URL,
  getBackendConfigSummary,
  resolveBackendBaseUrl,
} from './config/apiConfig.ts';
import type { Activity, FocusSession, StudentProfile, Task } from './types.ts';
import {
  buildChatRequestPayload,
  createTypedAiError,
  mapAiErrorToUserMessage,
} from './utils/aiClient.ts';
import {
  AI_CONTEXT_CAPS,
  buildAcademicContextSnapshot,
} from './utils/aiContextBuilder.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runAiIntegrationTests(): number {
  let passed = 0;

  // 1. Backend URL resolution in dev vs production
  {
    // Constantes exportadas y consistencia
    assert(
      DEFAULT_BACKEND_URL === 'https://studia-backend-8mf8.onrender.com',
      'DEFAULT_BACKEND_URL should be Render'
    );
    assert(
      DEVELOPMENT_BACKEND_URL === DEFAULT_BACKEND_URL,
      'DEVELOPMENT_BACKEND_URL should default to Render'
    );
    assert(
      CONFIGURED_PRODUCTION_BACKEND_URL === DEFAULT_BACKEND_URL,
      'CONFIGURED_PRODUCTION_BACKEND_URL should default to Render'
    );
    assert(
      LOCAL_DEVELOPMENT_BACKEND_URL === 'http://127.0.0.1:3000',
      'LOCAL_DEVELOPMENT_BACKEND_URL should be http://127.0.0.1:3000'
    );

    // Sin opciones (invocación habitual en la app de escritorio)
    const runtimeDefault = resolveBackendBaseUrl();
    assert(
      runtimeDefault === DEFAULT_BACKEND_URL,
      'resolveBackendBaseUrl() without options must default to Render'
    );

    const devDefault = resolveBackendBaseUrl({ isProd: false, envUrl: '' });
    assert(
      devDefault === DEFAULT_BACKEND_URL,
      'Dev mode should default to Render backend URL'
    );

    const devLocal = resolveBackendBaseUrl({
      isProd: false,
      envUrl: LOCAL_DEVELOPMENT_BACKEND_URL,
    });
    assert(
      devLocal === 'http://127.0.0.1:3000',
      'Dev mode should support explicit local backend URL'
    );

    const devCustom = resolveBackendBaseUrl({
      isProd: false,
      envUrl: 'http://127.0.0.1:4000/',
    });
    assert(
      devCustom === 'http://127.0.0.1:4000',
      'Dev mode should strip trailing slash from custom URL'
    );

    const prodDefault = resolveBackendBaseUrl({ isProd: true, envUrl: '' });
    assert(
      prodDefault === DEFAULT_BACKEND_URL,
      'Prod mode should default to Render backend URL'
    );

    const summary = getBackendConfigSummary();
    assert(
      summary.resolvedUrl === DEFAULT_BACKEND_URL && !summary.isCustomUrl,
      'getBackendConfigSummary() should report Render as default'
    );

    let prodLocalhostThrew = false;
    try {
      resolveBackendBaseUrl({ isProd: true, envUrl: 'http://localhost:3000' });
    } catch (err: any) {
      prodLocalhostThrew = err?.code === 'BACKEND_NOT_CONFIGURED';
    }
    assert(
      prodLocalhostThrew,
      'Prod mode with localhost URL should throw BACKEND_NOT_CONFIGURED'
    );

    const prodCustom = resolveBackendBaseUrl({
      isProd: true,
      envUrl: 'https://otro-backend.onrender.com/',
    });
    assert(
      prodCustom === 'https://otro-backend.onrender.com',
      'Prod mode should accept custom valid HTTPS public URL'
    );
    passed++;
  }

  // 2. Academic context builder privacy & accuracy
  {
    const sensitiveProfile: StudentProfile = {
      name: 'Nombre Privado Estudiante',
      program: 'Ingeniería de Sistemas',
      semester: '7mo',
      subjects: ['Arquitectura de Software', 'Bases de Datos'],
      classTimetable: [
        {
          id: 'c1',
          subject: 'Arquitectura de Software',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '10:00',
          room: 'Aula 102',
        },
      ],
      unavailableBlocks: [],
      studyPreferences: {
        preferredSessionDuration: 50,
        preferredBreakDuration: 10,
        strictFocusMode: true,
        restrictedApps: ['discord.exe', 'steam.exe'],
        customRestrictedApps: ['C:\\Users\\secreto\\juego.exe'],
        restrictedWebsites: ['instagram.com', 'x.com'],
      },
      studyAvailability: [{ dayOfWeek: 1, startTime: '14:00', endTime: '18:00' }],
    };

    const sampleTasks: Task[] = [
      {
        id: 't1',
        title: 'Entrega Proyecto Final',
        dueDate: '2026-10-10',
        estimatedDuration: 120,
        priority: 'high',
        status: 'pending',
        createdAt: 1,
      },
      {
        id: 't2',
        title: 'Tarea Completada',
        estimatedDuration: 60,
        priority: 'low',
        status: 'completed',
        createdAt: 2,
      },
    ];

    const sampleActivities: Activity[] = [
      {
        id: 'a1',
        title: 'Estudio: Entrega Proyecto Final',
        date: '2026-10-12',
        startTime: '15:00',
        endTime: '15:45',
        category: 'study_block',
        taskId: 't1',
        createdAt: 1,
      },
    ];

    const refDate = new Date('2026-10-12T12:00:00');
    const sampleSessions: FocusSession[] = [
      {
        id: 'f1',
        startTime: refDate.getTime(),
        endTime: refDate.getTime() + 1800 * 1000,
        duration: 1800,
        mode: 'focus',
        completed: true,
      },
    ];

    const snapshot = buildAcademicContextSnapshot(
      {
        profile: sensitiveProfile,
        tasks: sampleTasks,
        activities: sampleActivities,
        focusSessions: sampleSessions,
      },
      refDate
    );

    const serialized = JSON.stringify(snapshot);
    assert(
      !serialized.includes('Nombre Privado Estudiante'),
      'Snapshot must NOT include student personal name'
    );
    assert(
      !serialized.includes('C:\\\\Users\\\\secreto'),
      'Snapshot must NOT include local executable paths'
    );
    assert(
      !serialized.includes('discord.exe'),
      'Snapshot must NOT include restricted apps list'
    );
    assert(
      !serialized.includes('instagram.com'),
      'Snapshot must NOT include restricted websites list'
    );

    assert(snapshot.completedTasksCount === 1, 'Should count 1 completed task');
    assert(snapshot.pendingTasks.length === 1, 'Should include 1 pending task');
    assert(
      snapshot.pendingTasks[0].remainingMinutes === 75,
      'Should subtract 45m scheduled study_block from 120m estimatedDuration'
    );
    assert(
      snapshot.pendingTasks[0].isOverdue === true,
      'Task due 2026-10-10 should be marked overdue on 2026-10-12'
    );
    assert(
      snapshot.focusSummary.todayFocusMinutes === 30,
      'Should compute 30 minutes of focus today'
    );
    assert(
      AI_CONTEXT_CAPS.maxPendingTasks === 25,
      'Max pending tasks cap should be 25'
    );
    passed++;
  }

  // 3. Frontend AI Client payload validation, >1500 char support, history truncation & error mapping
  {
    const longValidUserMessage = 'Organizar mis entregas de esta semana: '.repeat(60).trim(); // ~2340 chars (> 1500, <= 4000)
    const longPriorAssistantMessage = 'Respuesta extensa previa del asistente '.repeat(90).trim(); // ~3510 chars (> 2500)

    const payload = buildChatRequestPayload(
      [
        { id: '1', role: 'system', content: 'Ignored system message', timestamp: 1 },
        { id: '2', role: 'user', content: '¿Qué entregas tengo?', timestamp: 2 },
        { id: '3', role: 'assistant', content: longPriorAssistantMessage, timestamp: 3 },
        { id: '4', role: 'user', content: `  ${longValidUserMessage}  `, timestamp: 4 },
      ],
      { profile: null, tasks: [], activities: [], focusSessions: [] }
    );

    assert(
      payload.messages.length === 3,
      'Should filter out system message and keep user/assistant messages'
    );
    assert(
      payload.messages[1].content.length <= AI_CONTEXT_CAPS.maxHistoryMessageLength,
      'Should automatically truncate previous assistant messages in history to maxHistoryMessageLength (2500)'
    );
    assert(
      payload.messages[2].content === longValidUserMessage &&
        payload.messages[2].content.length > 1500,
      'Should allow user messages longer than 1500 characters (up to 4000)'
    );

    let tooLongError: any = null;
    try {
      buildChatRequestPayload(
        [{ id: '1', role: 'user', content: 'X'.repeat(4250), timestamp: 1 }],
        { profile: null, tasks: [], activities: [], focusSessions: [] }
      );
    } catch (err: any) {
      tooLongError = err;
    }
    assert(
      tooLongError?.code === 'MESSAGE_TOO_LONG',
      'User message > 4000 chars should throw MESSAGE_TOO_LONG before sending to backend'
    );

    const mappedTooLong = mapAiErrorToUserMessage(tooLongError);
    assert(
      mappedTooLong.includes('4250') && mappedTooLong.includes('4000'),
      'Should return clear Spanish message indicating current length (4250) and max limit (4000)'
    );

    const rateMsg = mapAiErrorToUserMessage(createTypedAiError('RATE_LIMITED', '429'));
    assert(
      rateMsg.includes('límite temporal'),
      'Should map RATE_LIMITED to clear Spanish message'
    );
    passed++;
  }

  return passed;
}

const passedCount = runAiIntegrationTests();
console.log(`All ${passedCount} frontend AI integration test suites passed.`);
