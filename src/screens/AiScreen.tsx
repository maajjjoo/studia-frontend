import React, { useState, useEffect, useRef } from "react";
import { Icons } from "../Icons";
import { AiMessage } from "../types";
import { AI_CONTEXT_CAPS } from "../utils/aiContextBuilder";
import { useTranslation } from "../i18n/LanguageContext";

export function AiScreen({ profile, ai, tasks, activities, focus }: any) {
  const { t, language } = useTranslation();
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ai.messages, ai.isLoading]);

  const currentContext = {
    profile,
    tasks,
    activities,
    focusSessions: focus.sessions,
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || ai.isLoading) return;
    ai.sendMessage(input, currentContext, language);
    if (trimmed.length <= AI_CONTEXT_CAPS.maxMessageLength) {
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    t('ai.promptOrganizeWeek'),
    t('ai.promptSplitTask'),
    t('ai.promptExamPlan'),
    t('ai.promptAnalyzeWorkload')
  ];

  const firstName = profile?.name ? profile.name.split(' ')[0] : t('nav.studentRole');

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '2.5rem 3.5rem 1.5rem 3.5rem' }}>
      <div className="screen-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>{t('ai.screenTitle')}</h1>
          <p>{t('ai.screenSubtitle')}</p>
        </div>
        <button className="btn btn-secondary" onClick={ai.clearHistory} disabled={ai.isLoading}>{t('ai.newChatBtn')}</button>
      </div>

      <div className="ai-chat-container">
        <div className="ai-messages-area">
          {ai.messages.length === 0 && (
            <div className="ai-empty-state">
              <div style={{ background: 'var(--card-ai-bg)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--color-accent-main)' }}>
                <Icons.Spark />
              </div>
              <h3 style={{ fontSize: '1.5rem' }}>{t('ai.greetingUser', { name: firstName })}</h3>
              <p>{t('ai.emptyStateDesc')}</p>
              <div className="ai-suggested-grid">
                {suggestedPrompts.map(p => (
                  <button
                    key={p}
                    className="ai-suggested-btn"
                    disabled={ai.isLoading}
                    onClick={() => {
                      ai.sendMessage(p, currentContext, language);
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ai.messages.map((m: AiMessage) => (
            <div key={m.id} className={`ai-message-row ${m.role}`}>
              <div className={`ai-message-bubble ${m.role}`}>
                {m.content}
              </div>
            </div>
          ))}
          {ai.isLoading && (
            <div className="ai-message-row assistant">
              <div className="ai-message-bubble assistant loading">{t('ai.typing')}</div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {ai.error && (
          <div
            className="error-msg"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              margin: '0 2rem 1rem 2rem',
            }}
          >
            <span>{ai.error}</span>
            {ai.canRetry && !ai.isLoading && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', flexShrink: 0 }}
                onClick={() => ai.retryLastMessage(currentContext, language)}
              >
                {t('ai.retryBtn')}
              </button>
            )}
          </div>
        )}

        <div className="ai-input-area">
          <textarea
            className="ai-textarea"
            placeholder={t('ai.inputPlaceholder')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button className="ai-send-btn" onClick={() => handleSend()} disabled={!input.trim() || ai.isLoading}>
            <Icons.Spark />
          </button>
        </div>
      </div>
    </div>
  );
}
