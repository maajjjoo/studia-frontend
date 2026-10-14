import { useState } from "react";
import { Icons } from "../Icons";
import { FocusSession } from "../types";
import { formatTime } from "../utils/studyHelpers";

export function FocusScreen({ focus, profile }: any) {
  const [showConsent, setShowConsent] = useState(false);
  const localTodayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  const todaySessions = focus.sessions.filter((s: FocusSession) => {
    const sDate = new Date(s.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    return sDate === localTodayStr;
  });

  const getModeLabel = (mode: string) => mode === 'focus' ? 'Enfoque' : mode === 'shortBreak' ? 'Descanso Corto' : 'Descanso Largo';

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>Tiempo de enfoque</h1>
          <p>Utiliza la técnica Pomodoro para mantener la concentración.</p>
        </div>
      </div>

      <div className="focus-screen-layout">
        <div className="focus-main">
          <div className="focus-modes">
            <button className={`focus-mode-btn ${focus.mode === 'focus' ? 'active' : ''}`} onClick={() => focus.switchMode('focus')}>Enfoque</button>
            <button className={`focus-mode-btn ${focus.mode === 'shortBreak' ? 'active' : ''}`} onClick={() => focus.switchMode('shortBreak')}>Corto</button>
            <button className={`focus-mode-btn ${focus.mode === 'longBreak' ? 'active' : ''}`} onClick={() => focus.switchMode('longBreak')}>Largo</button>
          </div>

          <div className="focus-display">
            <div className="focus-timer-large">
              {formatTime(focus.timeLeft)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {focus.isWebsitesBlocked && (
                <span
                  className="badge"
                  title="Bloqueo aplicado en el archivo hosts de Windows. Si ya tenías una pestaña abierta de alguno de estos sitios, ciérrala o usa una ventana nueva ya que el navegador puede mantener conexiones activas previas."
                  style={{ background: 'rgba(var(--color-accent-soft-rgb), 0.15)', color: 'var(--color-accent-soft)', border: '1px solid rgba(var(--color-accent-soft-rgb), 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}
                >
                  <Icons.Shield /> Sitios web bloqueados ({focus.activeWebsites?.length || profile?.studyPreferences?.restrictedWebsites?.length || 0})
                </span>
              )}
              {focus.isRunning && !focus.isWebsitesBlocked && (profile?.studyPreferences?.restrictedWebsites?.length || 0) > 0 && (
                <span className="badge" style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}>
                  Sitios web no bloqueados
                </span>
              )}
            </div>
            {focus.websiteError && !focus.uacPrompt && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-destructive)', textAlign: 'center' }}>
                {focus.websiteError}
              </div>
            )}
          </div>

          <div className="focus-actions">
            {focus.isRunning ? (
              <button className="btn-focus-action active" onClick={focus.pause}><Icons.Pause /> Pausar</button>
            ) : (
              <button
                className="btn-focus-action"
                disabled={focus.isUacPending}
                onClick={() => {
                  const restrictedApps = profile?.studyPreferences?.restrictedApps || [];
                  const customRestrictedApps = profile?.studyPreferences?.customRestrictedApps || [];
                  const restrictedWebsites = profile?.studyPreferences?.restrictedWebsites || [];
                  const isStrict = profile?.studyPreferences?.strictFocusMode || false;

                  if (focus.mode === 'focus' && isStrict && (restrictedApps.length > 0 || customRestrictedApps.length > 0 || restrictedWebsites.length > 0)) {
                    const consentedStr = JSON.stringify(focus.consentedApps || { default: [], custom: [] });
                    const requiredStr = JSON.stringify({ default: restrictedApps, custom: customRestrictedApps });
                    if (consentedStr !== requiredStr) {
                      setShowConsent(true);
                      return;
                    }
                  }
                  focus.start(restrictedApps, customRestrictedApps, restrictedWebsites);
                }}
              >
                {focus.isUacPending ? (
                  <><Icons.Shield /> Solicitando permisos...</>
                ) : (
                  <><Icons.Play /> Iniciar</>
                )}
              </button>
            )}
            <button className="btn-focus-action outline" onClick={focus.reset} disabled={focus.isUacPending}><Icons.Reset /> Reiniciar</button>
          </div>

          {showConsent && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '420px' }}>
                <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--color-destructive)' }}><Icons.Shield /></span>
                  Modo Estricto Activo
                </h2>
                <p>La terminación forzada causará la <strong>pérdida permanente</strong> de cualquier trabajo no guardado en las aplicaciones bloqueadas.</p>
                <div style={{ background: 'var(--color-bg-base)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <strong>Aplicaciones a cerrar:</strong>
                    <div style={{ color: 'var(--color-text-main)', marginTop: '0.2rem' }}>
                      {[(profile?.studyPreferences?.restrictedApps || []), (profile?.studyPreferences?.customRestrictedApps || []).map((p: string) => p.split('\\').pop() || p)].flat().join(', ') || 'Ninguna'}
                    </div>
                  </div>
                  {(profile?.studyPreferences?.restrictedWebsites?.length || 0) > 0 && (
                    <div>
                      <strong>Sitios web a bloquear (requiere permisos UAC):</strong>
                      <div style={{ color: 'var(--color-text-main)', marginTop: '0.2rem' }}>
                        {(profile?.studyPreferences?.restrictedWebsites || []).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowConsent(false)}>Cancelar</button>
                  <button className="btn btn-primary" style={{ background: 'var(--color-destructive)', borderColor: 'var(--color-destructive)' }} onClick={() => {
                    const restrictedApps = profile?.studyPreferences?.restrictedApps || [];
                    const customRestrictedApps = profile?.studyPreferences?.customRestrictedApps || [];
                    const restrictedWebsites = profile?.studyPreferences?.restrictedWebsites || [];
                    focus.setConsentedApps({ default: [...restrictedApps], custom: [...customRestrictedApps] });
                    setShowConsent(false);
                    focus.start(restrictedApps, customRestrictedApps, restrictedWebsites);
                  }}>Confirmar y Comenzar</button>
                </div>
              </div>
            </div>
          )}

          {focus.uacPrompt && (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '440px' }}>
                <div className="modal-header">
                  <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: focus.uacPrompt.isError ? 'var(--color-destructive)' : 'var(--color-accent-soft)' }}>
                    <Icons.Shield />
                    {focus.uacPrompt.isError ? "Error al Bloquear Sitios" : "Permisos UAC Requeridos"}
                  </h2>
                  <button className="modal-close" onClick={focus.cancelUacPrompt}><Icons.Close /></button>
                </div>
                <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--color-text-main)' }}>
                  {focus.uacPrompt.errorMessage}
                </p>
                <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', margin: '1rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  ¿Deseas continuar la sesión de enfoque sin bloqueo de sitios web, o cancelar la sesión?
                </div>
                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={focus.cancelUacPrompt}>
                    Cancelar sesión
                  </button>
                  <button className="btn btn-primary" onClick={focus.continueWithoutWebsites}>
                    Continuar sin bloqueo web
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="focus-sidebar">
          <div className="fc-agenda">
            <div className="fc-agenda-header">
              <h3>Historial de hoy</h3>
              <span className="badge alta">{todaySessions.length} completados</span>
            </div>

            <div className="fc-agenda-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {todaySessions.length === 0 ? (
                <div className="empty-state">
                  <Icons.TrendingUp />
                  <p>Inicia una sesión de enfoque para ver tu historial aquí.</p>
                </div>
              ) : (
                todaySessions.reverse().map((s: FocusSession) => (
                  <div key={s.id} className="fc-agenda-item" style={{ padding: '0.75rem', gap: '0.75rem' }}>
                    <div style={{ background: 'var(--color-bg-base)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.Check />
                    </div>
                    <div className="fc-agenda-info">
                      <h4>{getModeLabel(s.mode)}</h4>
                      <p>{Math.round(s.duration / 60)} min • {new Date(s.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
