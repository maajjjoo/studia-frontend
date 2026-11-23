import type { CSSProperties } from "react";
import { EmptyArt } from "../components/EmptyArt";
import { Icons } from "../Icons";
import { Task, FocusSession } from "../types";
import { getWeeklyFocusData } from "../utils/studyHelpers";
import { useTranslation } from "../i18n/LanguageContext";

export function ProgressScreen({ tasks, focus }: any) {
  const { t, language, formatDay } = useTranslation();
  const pendingTasks = tasks.filter((t: Task) => t.status === 'pending').length;
  const completedTasks = tasks.filter((t: Task) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const localTodayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  const todaySessions = focus.sessions.filter((s: FocusSession) => {
    const sDate = new Date(s.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    return sDate === localTodayStr && s.mode === 'focus' && s.completed;
  });

  const todayFocusSecs = todaySessions.reduce((acc: number, s: FocusSession) => acc + s.duration, 0);
  const weeklyData = getWeeklyFocusData(focus.sessions);
  const weeklyFocusSecs = weeklyData.reduce((acc, secs) => acc + secs, 0);

  const maxWd = Math.max(...weeklyData, 1800); // Scale relative to max day or 30 mins
  const todayIdx = (new Date().getDay() + 6) % 7; // Monday-first, like getWeeklyFocusData

  return (
    <div className="main-content">
      <div className="screen-header">
        <div className="screen-title">
          <span className="screen-icon" aria-hidden="true"><Icons.BarChart /></span>
          <h1>{t('progress.title')}</h1>
          <p>{t('progress.subtitle')}</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="dash-card stat-card">
          <span className="stat-icon"><Icons.CheckSquare /></span>
          <h3>{t('progress.totalTasks')}</h3>
          <p className="stat-value">{totalTasks}</p>
        </div>
        <div className="dash-card stat-card">
          <span className="stat-icon"><Icons.Target /></span>
          <h3>{t('progress.completedTasks')}</h3>
          <p className="stat-value is-accent">{completedTasks}</p>
        </div>
        <div className="dash-card stat-card">
          <span className="stat-icon"><Icons.Clock /></span>
          <h3>{t('progress.pendingTasks')}</h3>
          <p className="stat-value">{pendingTasks}</p>
        </div>
        <div className="dash-card stat-card stat-card-hero">
          <span className="stat-icon"><Icons.BarChart /></span>
          <h3>{t('progress.efficiency')}</h3>
          <p className="stat-value">{progressPct}%</p>
          <div className="pb-track"><div className="pb-fill" style={{ width: `${progressPct}%` }}></div></div>
        </div>
      </div>

      <div className="progress-grid">
        <div className="dash-card card-progress week-card">
          <div className="week-card-head">
            <h2>{t('progress.focusTimeMinutes')}</h2>
            <span className="week-total"><Icons.Flame /> {Math.round(weeklyFocusSecs / 60)} {t('common.min')}</span>
          </div>
          <div className="week-chart">
            {weeklyData.map((secs, i) => {
              const h = Math.round((secs / maxWd) * 100);
              const isToday = i === todayIdx;
              return (
                <div key={i} className={`week-col ${isToday ? 'is-today' : ''}`} style={{ '--i': i } as CSSProperties} title={`${Math.round(secs / 60)} ${t('common.min')}`}>
                  <span className={`week-val ${secs > 0 ? '' : 'is-zero'}`}>{Math.round(secs / 60)}</span>
                  <div className="week-track">
                    <div className="week-bar" style={{ height: `${h}%` }}></div>
                  </div>
                  <span className="week-day">{formatDay(i + 1, { weekday: 'short' })}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dash-card card-focus">
            <h2>{t('progress.dailyFocus')}</h2>
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600 }}>{t('progress.sessionsCompleted')}</span>
                <span className="badge badge-accent">{todaySessions.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600 }}>{t('progress.timeToday')}</span>
                <span>{Math.round(todayFocusSecs / 60)} {t('common.min')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{t('progress.timeWeekly')}</span>
                <span>{Math.round(weeklyFocusSecs / 60)} {t('common.min')}</span>
              </div>
            </div>
          </div>

          <div className="dash-card" style={{ flex: 1, overflowY: 'auto' }}>
            <h3>{t('progress.latestSessions')}</h3>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {focus.sessions.filter((s: FocusSession) => s.completed && s.mode === 'focus').length === 0 ? (
                <div className="empty-state empty-state-compact">
                  <EmptyArt kind="focus" size="sm" />
                  <p>{t('progress.noSessionsYet')}</p>
                </div>
              ) : (
                focus.sessions.filter((s: FocusSession) => s.completed && s.mode === 'focus').slice(-4).reverse().map((s: FocusSession) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.Timer />
                    </div>
                    <div>
                      <h5 style={{ margin: 0 }}>{new Date(s.startTime).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { weekday: 'short', day: 'numeric' })}</h5>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{Math.round(s.duration / 60)} {t('common.min')}</span>
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
