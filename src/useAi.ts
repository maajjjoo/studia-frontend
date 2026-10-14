import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiMessage } from './types.ts';
import type { AiContextData, AiServiceError } from './utils/aiClient.ts';
import {
  buildChatRequestPayload,
  formatMessageTooLongError,
  invokeAiAssistant,
  mapAiErrorToUserMessage,
} from './utils/aiClient.ts';
import { AI_CONTEXT_CAPS } from './utils/aiContextBuilder.ts';

export type { AiContextData, AiServiceError };
export {
  buildChatRequestPayload,
  formatMessageTooLongError,
  invokeAiAssistant,
  mapAiErrorToUserMessage,
};

export function useAi() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const inFlightRef = useRef(false);
  const lastContextRef = useRef<AiContextData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('studia_ai_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (m: AiMessage) => m && (m.role === 'user' || m.role === 'assistant')
          );
          setMessages(cleaned);
        }
      } catch (e) {
        console.error('Error loading AI history', e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveMessages = useCallback((newMessages: AiMessage[]) => {
    setMessages(newMessages);
    localStorage.setItem('studia_ai_v1', JSON.stringify(newMessages));
  }, []);

  const clearHistory = useCallback(() => {
    if (inFlightRef.current) return;
    saveMessages([]);
    setError(null);
    setCanRetry(false);
  }, [saveMessages]);

  const executeConversationTurn = useCallback(
    async (conversationHistory: AiMessage[], context: AiContextData) => {
      inFlightRef.current = true;
      setIsLoading(true);
      setError(null);
      setCanRetry(false);
      lastContextRef.current = context;

      try {
        const responseContent = await invokeAiAssistant(conversationHistory, context);

        const assistantMessage: AiMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseContent,
          timestamp: Date.now(),
        };
        saveMessages([...conversationHistory, assistantMessage]);
        setCanRetry(false);
      } catch (err: unknown) {
        setError(mapAiErrorToUserMessage(err));
        setCanRetry(true);
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [saveMessages]
  );

  const sendMessage = useCallback(
    async (content: string, context: AiContextData) => {
      const trimmed = (content || '').trim();
      if (!trimmed || isLoading || inFlightRef.current) return;

      if (trimmed.length > AI_CONTEXT_CAPS.maxMessageLength) {
        setError(formatMessageTooLongError(trimmed.length));
        setCanRetry(false);
        return;
      }

      const userMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMessage];
      saveMessages(updatedMessages);

      await executeConversationTurn(updatedMessages, context);
    },
    [messages, isLoading, saveMessages, executeConversationTurn]
  );

  const retryLastMessage = useCallback(
    async (fallbackContext?: AiContextData) => {
      if (isLoading || inFlightRef.current || messages.length === 0) return;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role !== 'user') return;

      const ctx = fallbackContext || lastContextRef.current;
      if (!ctx) return;

      await executeConversationTurn(messages, ctx);
    },
    [isLoading, messages, executeConversationTurn]
  );

  return {
    isLoaded,
    messages,
    isLoading,
    error,
    canRetry,
    sendMessage,
    retryLastMessage,
    clearHistory,
  };
}
