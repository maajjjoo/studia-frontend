import { invoke } from '@tauri-apps/api/core';
import { resolveBackendBaseUrl } from '../config/apiConfig.ts';
import type { Activity, AiMessage, FocusSession, StudentProfile, Task } from '../types.ts';
import { AI_CONTEXT_CAPS, buildAcademicContextSnapshot } from './aiContextBuilder.ts';

export interface AiContextData {
  profile?: StudentProfile | null;
  tasks: Task[];
  activities: Activity[];
  focusSessions: FocusSession[];
}

export interface AiServiceError extends Error {
  code?: string;
  httpStatus?: number;
}

export function createTypedAiError(
  code: string,
  message: string,
  httpStatus?: number
): AiServiceError {
  const err = new Error(message) as AiServiceError;
  err.code = code;
  err.httpStatus = httpStatus;
  return err;
}

export function formatMessageTooLongError(actualLength?: number): string {
  if (typeof actualLength === 'number' && actualLength > AI_CONTEXT_CAPS.maxMessageLength) {
    return `Tu mensaje tiene ${actualLength} caracteres y supera el límite máximo permitido de ${AI_CONTEXT_CAPS.maxMessageLength} caracteres. Acórtalo un poco e inténtalo de nuevo.`;
  }
  return `Tu mensaje supera el límite máximo permitido de ${AI_CONTEXT_CAPS.maxMessageLength} caracteres. Acórtalo un poco e inténtalo de nuevo.`;
}

export function mapAiErrorToUserMessage(err: unknown): string {
  const code =
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';

  const rawMessage =
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message.trim()
      : '';

  switch (code) {
    case 'BACKEND_NOT_CONFIGURED':
      return 'El servidor de IA aún no está configurado en esta versión. Configura la URL del backend antes de compilar el instalador.';
    case 'BACKEND_UNAVAILABLE':
    case 'NETWORK_ERROR':
      return 'No se pudo conectar con el servidor de Studia IA. Verifica tu conexión a Internet o que el servidor backend esté activo.';
    case 'MISSING_API_KEY':
      return 'El servidor de IA aún no tiene configurada su clave GEMINI_API_KEY.';
    case 'INVALID_API_KEY':
      return 'El servidor de IA no pudo autenticarse con el proveedor. Revisa la configuración de GEMINI_API_KEY en el backend.';
    case 'MODEL_UNAVAILABLE':
      return 'El modelo de IA configurado en el servidor no está disponible en este momento. Revisa GEMINI_MODEL en el backend.';
    case 'RATE_LIMITED':
      return 'Se alcanzó el límite temporal de consultas al asistente. Espera unos segundos e inténtalo de nuevo.';
    case 'TIMEOUT':
      return 'El asistente tardó demasiado tiempo en responder. Por favor, vuelve a intentarlo.';
    case 'EMPTY_RESPONSE':
      return 'El asistente devolvió una respuesta vacía. Intenta reformular tu pregunta.';
    case 'MESSAGE_TOO_LONG':
      if (rawMessage.startsWith('Tu mensaje tiene ')) {
        return rawMessage;
      }
      return formatMessageTooLongError();
    case 'BAD_REQUEST':
      return 'No se pudo procesar el formato de la consulta enviada.';
    case 'PROVIDER_ERROR':
      return 'El proveedor de IA experimentó un problema temporal. Inténtalo de nuevo en unos momentos.';
    default:
      return 'Hubo un problema al procesar tu consulta. Verifica tu conexión e inténtalo de nuevo.';
  }
}

function truncateHistoryMessage(content: string, maxLen: number): string {
  if (content.length <= maxLen) {
    return content;
  }
  return `${content.slice(0, maxLen - 3).trimEnd()}...`;
}

export function buildChatRequestPayload(messages: AiMessage[], context: AiContextData) {
  const validMessages = messages
    .filter(
      (m): m is AiMessage & { role: 'user' | 'assistant' } =>
        m.role === 'user' || m.role === 'assistant'
    )
    .slice(-AI_CONTEXT_CAPS.maxHistoryMessages)
    .map(m => ({
      role: m.role,
      content: (m.content || '').trim(),
    }))
    .filter(m => m.content.length > 0);

  if (validMessages.length === 0) {
    throw createTypedAiError('BAD_REQUEST', 'El mensaje no puede estar vacío.');
  }

  const lastMessage = validMessages[validMessages.length - 1];
  if (lastMessage.content.length > AI_CONTEXT_CAPS.maxMessageLength) {
    throw createTypedAiError(
      'MESSAGE_TOO_LONG',
      formatMessageTooLongError(lastMessage.content.length)
    );
  }

  // Recortar mensajes anteriores del historial (incluyendo respuestas largas previas del asistente)
  // para que nunca provoquen rechazo en el backend ni excedan el presupuesto de historial.
  const priorMessages = validMessages.slice(0, -1);
  const boundedHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  let accumulatedHistoryChars = 0;

  for (let i = priorMessages.length - 1; i >= 0; i--) {
    const truncatedContent = truncateHistoryMessage(
      priorMessages[i].content,
      AI_CONTEXT_CAPS.maxHistoryMessageLength
    );
    if (accumulatedHistoryChars + truncatedContent.length > AI_CONTEXT_CAPS.maxTotalHistoryChars) {
      break;
    }
    accumulatedHistoryChars += truncatedContent.length;
    boundedHistory.unshift({
      role: priorMessages[i].role,
      content: truncatedContent,
    });
  }

  const conversationMessages = [...boundedHistory, lastMessage];
  const academicContext = buildAcademicContextSnapshot(context);

  return {
    messages: conversationMessages,
    academicContext,
  };
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function invokeAiAssistant(
  messages: AiMessage[],
  context: AiContextData
): Promise<string> {
  const backendUrl = resolveBackendBaseUrl();
  console.info(`[Studia AI] Conectando con backend en: ${backendUrl}`);
  const payload = buildChatRequestPayload(messages, context);

  if (isTauriRuntime()) {
    try {
      const response = await invoke<{ reply: string; model: string }>('send_ai_chat', {
        backendUrl,
        payload,
      });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim()) {
        throw createTypedAiError('EMPTY_RESPONSE', 'Respuesta vacía del asistente.');
      }
      return response.reply.trim();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        throw err;
      }
      throw createTypedAiError(
        'BACKEND_UNAVAILABLE',
        'No se pudo comunicar con el servidor de IA.'
      );
    }
  }

  // Fallback HTTP directo para entornos de navegador / pruebas fuera de Tauri
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw createTypedAiError(
      'BACKEND_UNAVAILABLE',
      'No se pudo conectar con el servidor de Studia IA.'
    );
  }

  let body: {
    ok?: boolean;
    data?: { reply?: string; model?: string };
    error?: { code?: string; message?: string };
  };
  try {
    body = await res.json();
  } catch {
    throw createTypedAiError(
      'BACKEND_UNAVAILABLE',
      'Respuesta inválida del servidor de Studia IA.',
      res.status
    );
  }

  if (!res.ok || !body.ok) {
    throw createTypedAiError(
      body.error?.code || 'PROVIDER_ERROR',
      body.error?.message || 'Error en el servidor de IA.',
      res.status
    );
  }

  const reply = (body.data?.reply || '').trim();
  if (!reply) {
    throw createTypedAiError('EMPTY_RESPONSE', 'El asistente devolvió una respuesta vacía.');
  }

  return reply;
}
