import { useState, useEffect, useCallback } from 'react';
import { AiMessage, Task, Activity, FocusSession } from './types';

// Clean typed abstraction for the AI Provider integration
export interface AiContextData {
  tasks: Task[];
  activities: Activity[];
  focusSessions: FocusSession[];
}

export interface AiServiceError extends Error {
  code?: string;
}

// Abstract Service function
// In a real implementation, this would call Tauri IPC or an external API
export async function invokeAiAssistant(_messages: AiMessage[], _context: AiContextData): Promise<string> {
  // We do not simulate fake conversations.
  // We throw a specific error to explain integration requirements.
  const error = new Error("INTEGRATION_REQUIRED") as AiServiceError;
  error.code = "INTEGRATION_REQUIRED";
  throw error;
}

export function useAi() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('studia_ai_v1');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading AI history", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveMessages = useCallback((newMessages: AiMessage[]) => {
    setMessages(newMessages);
    localStorage.setItem('studia_ai_v1', JSON.stringify(newMessages));
  }, []);

  const clearHistory = useCallback(() => {
    saveMessages([]);
    setError(null);
  }, [saveMessages]);

  const sendMessage = useCallback(async (content: string, context: AiContextData) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    saveMessages(newMessages);

    try {
      // Call the clean typed service abstraction
      const responseContent = await invokeAiAssistant(newMessages, context);
      
      const assistantMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now()
      };
      saveMessages([...newMessages, assistantMessage]);

    } catch (err: any) {
      if (err.code === "INTEGRATION_REQUIRED") {
        const sysMessage: AiMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          content: "Actualmente, la IA no está conectada a un proveedor real. Por razones de seguridad, las claves API no deben incluirse en el frontend. Para habilitar esta función, debes configurar un proveedor (como OpenAI o Anthropic) en el backend de Tauri (`src-tauri/src/main.rs`) o en un servidor externo seguro, y conectar la función `invokeAiAssistant`.",
          timestamp: Date.now()
        };
        saveMessages([...newMessages, sysMessage]);
      } else {
        setError("Hubo un error al procesar tu solicitud. Inténtalo de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }

  }, [messages, isLoading, saveMessages]);

  return {
    isLoaded,
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory
  };
}
