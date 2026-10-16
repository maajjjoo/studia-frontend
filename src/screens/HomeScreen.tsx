import { Icons } from "../Icons";
import { Task, Activity, FocusSession } from "../types";
import { formatTime, getWeeklyFocusData } from "../utils/studyHelpers";
import { useTranslation } from "../i18n/LanguageContext";

export function HomeScreen({
  profile,
  tasks,
  activities,
  focus,
  resolvedAppearance,
  onToggleAppearance,
  onNavigate,
  onOpenNewTask,
  onOpenNewActivity,
  onToggleTask,
}: any) {
  const { t, formatDate, formatDay } = useTranslation();

  const pendingTasks = tasks.filter((t: Task) => t.status === 'pending').slice(0, 3);
  const totalCompleted = tasks.filter((t: Task) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);

  const todayDateObj = new Date();
  const formattedDate = formatDate(todayDateObj, { weekday: 'long', day: 'numeric', month: 'long' });
  const localTodayStr = new Date(todayDateObj.getTime() - (todayDateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  const todayDayOfWeek = todayDateObj.getDay() || 7; // 1-7

  const todayClasses = profile?.classTimetable?.filter((c: any) => c.dayOfWeek === todayDayOfWeek).map((c: any) => ({
    id: `class-${c.id}`,
    title: c.subject,
    date: localTodayStr,
    startTime: c.startTime,
    endTime: c.endTime,
    category: 'class_session'
  })) || [];

  const upcomingActivities = [...activities, ...todayClasses]
    .filter((a: any) => a.date >= localTodayStr)
    .sort((a: any, b: any) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
    .slice(0, 3);

  const getPriorityLabel = (p: string) =>
    p === 'high' ? t('tasks.priorityHigh') : p === 'medium' ? t('tasks.priorityMedium') : t('tasks.priorityLow');

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'study_block': return t('calendar.categories.study_block');
      case 'class_session':
      case 'class': return t('calendar.categories.class_session');
      case 'exam': return t('calendar.categories.exam');
      case 'deadline':
      case 'assignment': return t('calendar.categories.deadline');
      default: return t('calendar.categories.personal');
    }
  };

  // Focus specific
  const restrictedApps = profile?.studyPreferences?.restrictedApps || [];
  const customRestrictedApps = profile?.studyPreferences?.customRestrictedApps || [];
  const restrictedWebsites = profile?.studyPreferences?.restrictedWebsites || [];

  const todaySessions = focus.sessions.filter((s: FocusSession) => {
    const sDate = new Date(s.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    return sDate === localTodayStr;
  });

  // Helper for mini calendar
  const year = todayDateObj.getFullYear();
  const month = todayDateObj.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const miniCal = [];
  for (let i = 0; i < startOffset; i++) miniCal.push(null);
  for (let i = 1; i <= daysInMonth; i++) miniCal.push(i);

  const monthName = formatDate(todayDateObj, { month: 'long', year: 'numeric' }).toUpperCase();
  const firstName = profile?.name ? profile.name.split(' ')[0] : t('nav.studentRole');

  return (
    <div className="main-content">
      <div className="top-header">
        <div className="header-titles">
          <span className="super-title">{t('dashboard.superTitle')}</span>
          <h1>{t('dashboard.greeting', { name: firstName })}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <div className="header-actions">
          <div className="header-date">
            <span className="date-label">{t('dashboard.today')}</span>
            <span className="date-value">{formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}</span>
          </div>
          <button
            className="icon-circle"
            onClick={onToggleAppearance}
            title={
              resolvedAppearance === 'dark'
                ? t('theme.toggleToLight')
                : t('theme.toggleToDark')
            }
            aria-label={
              resolvedAppearance === 'dark'
                ? t('theme.toggleToLight')
                : t('theme.toggleToDark')
            }
          >
            {resolvedAppearance === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
          </button>
        </div>
      </div>

      <div className="quick-actions-bar">
        <span className="quick-label">{t('dashboard.quickActions')}</span>
        <button className="action-pill" onClick={onOpenNewTask}><Icons.Plus /> {t('dashboard.newTask')}</button>
        <button className="action-pill" onClick={onOpenNewActivity}><Icons.Calendar /> {t('dashboard.addEvent')}</button>
        <button className="action-pill" onClick={() => { if (!focus.isRunning) focus.start(restrictedApps, customRestrictedApps, restrictedWebsites); onNavigate("enfoque"); }}><Icons.Play /> {t('dashboard.startFocus')}</button>
        <button className="action-pill" onClick={() => onNavigate("asistente")}><Icons.Spark /> {t('dashboard.askAi')}</button>
      </div>

      <div className="dashboard-grid">
        {/* Mis Tareas */}
        <div className="dash-card card-tasks">
          <button className="card-plus-btn" onClick={onOpenNewTask}><Icons.Plus /></button>
          <span className="card-super">{t('dashboard.forToday')}</span>
          <h2>{t('dashboard.myTasks')}</h2>

          <div className="progress-bar-wrapper">
            <div className="pb-header">
              <span>{t('dashboard.tasksCompletedSummary', { completed: totalCompleted, total: totalTasks })}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="pb-track"><div className="pb-fill" style={{ width: `${progressPct}%` }}></div></div>
          </div>

          <div className="mini-task-list">
            {pendingTasks.length > 0 ? pendingTasks.map((tItem: Task) => (
              <div key={tItem.id} className="mini-task">
                <div className="mini-task-left">
                  <div className="mini-checkbox" onClick={() => onToggleTask(tItem.id)}></div>
                  <div className="mini-task-info">
                    <h4>{tItem.title}</h4>
                    {tItem.dueDate && <p><Icons.Clock /> {formatDate(tItem.dueDate)}</p>}
                  </div>
                </div>
                <span className={`badge ${tItem.priority === 'high' ? 'alta' : tItem.priority === 'medium' ? 'media' : 'baja'}`}>
                  {getPriorityLabel(tItem.priority)}
                </span>
              </div>
            )) : <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>{t('dashboard.noPendingTasks')}</p>}
          </div>

          <a className="card-link" onClick={() => onNavigate("tareas")}>{t('dashboard.viewAll')}</a>
        </div>

        {/* Mi Calendario */}
        <div className="dash-card card-calendar">
          <span className="card-super">{monthName}</span>
          <h2>{t('dashboard.myCalendar')}</h2>

          <div className="mini-calendar-wrapper">
            <div className="mini-calendar-grid">
              <div className="mc-header">
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                  <span key={d}>{formatDay(d, { weekday: 'narrow' })}</span>
                ))}
              </div>
              <div className="mc-days">
                {miniCal.map((d, i) => {
                  if (!d) return <div key={i} className="mc-day"></div>;
                  const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const isToday = dStr === localTodayStr;
                  const hasAct = activities.some((a: Activity) => a.date === dStr);
                  return (
                    <div key={i} className={`mc-day ${isToday ? 'today' : ''}`}>
                      {d}
                      {hasAct && !isToday && <div className="dot"></div>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mini-agenda">
              <h4>{t('dashboard.upcoming')}</h4>
              {upcomingActivities.length > 0 ? upcomingActivities.map((a: any) => (
                <div key={a.id} className="mini-agenda-item">
                  <span className="mini-agenda-time">{a.startTime}</span>
                  <div className="mini-agenda-info">
                    <h5>{a.title}</h5>
                    <p>{getCategoryLabel(a.category)}</p>
                  </div>
                </div>
              )) : <p style={{ fontSize: '0.8rem' }}>{t('dashboard.noUpcoming')}</p>}
            </div>
          </div>
          <a className="card-link" onClick={() => onNavigate("calendario")}>{t('dashboard.viewCalendar')}</a>
        </div>

        {/* Tu Asistente IA */}
        <div className="dash-card card-ai">
          <span className="card-super">{t('dashboard.aiCompanion')}</span>
          <h2>{t('dashboard.aiCardTitle')}</h2>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>{t('dashboard.aiNeedOrganize')}</p>
          <div className="ai-input-wrapper">
            <input type="text" className="ai-input" placeholder={t('dashboard.aiPlaceholder')} onClick={() => onNavigate('asistente')} readOnly />
            <button className="ai-btn" onClick={() => onNavigate('asistente')}>→</button>
          </div>
          <div className="ai-tags">
            <button className="ai-tag" onClick={() => onNavigate('asistente')}>{t('dashboard.suggestedTags.planner')}</button>
            <button className="ai-tag" onClick={() => onNavigate('asistente')}>{t('dashboard.splitTask')}</button>
          </div>
        </div>

        {/* Pomodoro */}
        <div className="dash-card card-focus" onClick={() => onNavigate("enfoque")} style={{ cursor: 'pointer' }}>
          <span className="card-super" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Pomodoro</span>
            <span>{t('dashboard.sessionsToday', { count: todaySessions.length })}</span>
          </span>
          <h2>{t('dashboard.focusTime')}</h2>
          <div className="focus-timer">
            <div className="timer-circle">
              <span className="timer-time">{formatTime(focus.timeLeft)}</span>
              <span className="timer-label">
                {focus.mode === 'focus' ? t('focus.modeFocus') : focus.mode === 'shortBreak' ? t('focus.modeShort') : t('focus.modeLong')}
              </span>
            </div>
            <div className="timer-controls" onClick={e => e.stopPropagation()}>
              {focus.isRunning ? (
                <button className="btn-play" onClick={focus.pause}><Icons.Pause /></button>
              ) : (
                <button className="btn-play" onClick={() => focus.start(restrictedApps, customRestrictedApps, restrictedWebsites)}><Icons.Play /></button>
              )}
              <button className="btn-reset" onClick={focus.reset}><Icons.Reset /></button>
            </div>
          </div>
        </div>

        {/* Progreso Semanal */}
        <div className="dash-card card-progress" onClick={() => onNavigate("progreso")} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="card-super">{t('dashboard.thisWeek')}</span>
              <h2>{t('dashboard.weeklyProgress')}</h2>
            </div>
            <select className="form-select" style={{ width: 'auto', padding: '0.5rem 1rem' }} defaultValue="esta" onClick={e => e.stopPropagation()}>
              <option value="esta">{t('dashboard.thisWeek')}</option>
            </select>
          </div>
          <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '1rem', padding: '0 1rem' }}>
            {(() => {
              const wd = getWeeklyFocusData(focus.sessions);
              const maxWd = Math.max(...wd, 1800); // at least 30 mins to scale
              return wd.map((secs, i) => {
                const h = Math.round((secs / maxWd) * 100);
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }} title={`${Math.round(secs / 60)} min`}>
                    <div style={{ width: '16px', height: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${h}%`, background: h > 80 ? 'var(--color-btn-dark)' : 'var(--color-accent-main)', opacity: h > 0 ? (h > 80 ? 1 : 0.6) : 0, borderRadius: '8px', transition: 'height 0.3s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      {formatDay(i + 1, { weekday: 'narrow' })}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
