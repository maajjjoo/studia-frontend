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

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>{t('progress.title')}</h1>
          <p>{t('progress.subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="dash-card">
          <span className="card-super">{t('progress.superGeneral')}</span>
          <h3>{t('progress.totalTasks')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--color-text-main)' }}>{totalTasks}</p>
        </div>
        <div className="dash-card">
          <span className="card-super">{t('progress.superAchievements')}</span>
          <h3>{t('progress.completedTasks')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--color-accent-main)' }}>{completedTasks}</p>
        </div>
        <div className="dash-card">
          <span className="card-super">{t('progress.superToDo')}</span>
          <h3>{t('progress.pendingTasks')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--prio-high-text)' }}>{pendingTasks}</p>
        </div>
        <div className="dash-card card-tasks">
          <span className="card-super">{t('progress.superEfficiency')}</span>
          <h3>{t('progress.efficiency')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0' }}>{progressPct}%</p>
          <div className="pb-track" style={{ marginTop: '0.5rem' }}><div className="pb-fill" style={{ width: `${progressPct}%` }}></div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="dash-card card-progress" style={{ minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="card-super">{t('progress.weeklySummary')}</span>
              <h2>{t('progress.focusTimeMinutes')}</h2>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '2rem', padding: '0 1rem' }}>
            {weeklyData.map((secs, i) => {
              const h = Math.round((secs / maxWd) * 100);
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', flex: 1 }} title={`${Math.round(secs / 60)} ${t('common.min')}`}>
                  <div style={{ width: '32px', height: '200px', background: 'var(--color-track-bg)', borderRadius: '16px', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${h}%`, background: h > 80 ? 'var(--color-btn-dark)' : 'var(--color-accent-main)', opacity: h > 0 ? (h > 80 ? 1 : 0.6) : 0, borderRadius: '16px', transition: 'height 0.3s ease' }}></div>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    {formatDay(i + 1, { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dash-card card-focus">
            <span className="card-super">{t('progress.dailyProductivity')}</span>
            <h2>{t('progress.dailyFocus')}</h2>
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 600 }}>{t('progress.sessionsCompleted')}</span>
                <span className="badge alta">{todaySessions.length}</span>
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
            <span className="card-super">{t('progress.recentHistory')}</span>
            <h3>{t('progress.latestSessions')}</h3>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {focus.sessions.filter((s: FocusSession) => s.completed && s.mode === 'focus').length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{t('progress.noSessionsYet')}</p>
              ) : (
                focus.sessions.filter((s: FocusSession) => s.completed && s.mode === 'focus').slice(-4).reverse().map((s: FocusSession) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icons.TrendingUp />
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
