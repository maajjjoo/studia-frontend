import { Icons } from './Icons';
import { Task, Activity, FocusSession, StudentProfile } from './types';

interface Props {
  profile: StudentProfile;
  tasks: Task[];
  activities: Activity[];
  focus: { sessions: FocusSession[] };
  onNavigate: (tab: string) => void;
  onOpenNewTask: () => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

export function HomeScreen({ profile, tasks, activities, focus, onNavigate, onOpenNewTask, onToggleTask, onEditTask }: Props) {
  
  const todayDateObj = new Date();
  const formattedDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(todayDateObj);
  const localTodayStr = new Date(todayDateObj.getTime() - (todayDateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const todayDayOfWeek = todayDateObj.getDay() || 7;

  const firstName = profile?.name ? profile.name.split(' ')[0] : 'Estudiante';
  
  const messages = [
    "Un buen día para avanzar un paso más.",
    "El esfuerzo constante trae grandes recompensas.",
    "Organiza tu tiempo, multiplica tus resultados.",
    "Cada pequeña tarea te acerca a tu meta.",
    "Concéntrate en lo importante, y el resto fluirá."
  ];
  const todayMessage = messages[todayDateObj.getDate() % messages.length];

  // --- B. Today's Agenda ---
  // Recurring classes
  const todayClasses = profile?.classTimetable?.filter((c: any) => c.dayOfWeek === todayDayOfWeek).map((c: any) => ({
    id: `class-${c.id}`,
    title: c.subject,
    date: localTodayStr,
    startTime: c.startTime,
    endTime: c.endTime,
    category: 'class_session',
    subject: c.subject
  })) || [];

  // Activities (includes Study Blocks 'study_block' and regular events)
  const todayActivities = activities.filter(a => a.date === localTodayStr);

  // Deadlines (Tasks due today)
  const todayDeadlines = tasks
    .filter(t => t.status === 'pending' && t.dueDate === localTodayStr)
    .map(t => ({
      id: `deadline-${t.id}`,
      title: `Entrega: ${t.title}`,
      date: localTodayStr,
      startTime: '23:59', // Default to end of day for sorting purposes
      endTime: '23:59',
      category: 'deadline',
      originalTask: t
    }));

  const agendaItems = [...todayClasses, ...todayActivities, ...todayDeadlines]
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // --- C. Academic Priorities ---
  // Pending tasks sorted by urgency and priority
  const priorityTasks = [...tasks]
    .filter(t => t.status === 'pending')
    .sort((a, b) => {
      // 1. Overdue
      const aOverdue = a.dueDate && a.dueDate < localTodayStr ? 1 : 0;
      const bOverdue = b.dueDate && b.dueDate < localTodayStr ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue; // overdue first
      
      // 2. Upcoming deadlines
      if (a.dueDate && b.dueDate) {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      } else if (a.dueDate && !b.dueDate) {
        return -1;
      } else if (!a.dueDate && b.dueDate) {
        return 1;
      }
      
      // 3. Priority
      const pWeight = { high: 3, medium: 2, low: 1 };
      return pWeight[b.priority] - pWeight[a.priority];
    })
    .slice(0, 4); // Top 4

  // --- D. Study Planning Summary ---
  const todayStudyBlocks = todayActivities.filter(a => a.category === 'study_block');
  const totalStudyMinutes = todayStudyBlocks.reduce((acc, block) => {
    const [h1, m1] = block.startTime.split(':').map(Number);
    const [h2, m2] = block.endTime.split(':').map(Number);
    return acc + ((h2 * 60 + m2) - (h1 * 60 + m1));
  }, 0);
  
  // Format planned time
  const plannedHours = Math.floor(totalStudyMinutes / 60);
  const plannedMinutes = totalStudyMinutes % 60;
  const plannedTimeStr = plannedHours > 0 ? `${plannedHours}h ${plannedMinutes}m` : `${plannedMinutes}m`;

  // --- E. Focus and Progress ---
  const todaySessions = focus.sessions.filter((s: FocusSession) => {
    const sDate = new Date(s.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    return sDate === localTodayStr && s.mode === 'focus' && s.completed;
  });
  const todayFocusSecs = todaySessions.reduce((acc, s) => acc + s.duration, 0);
  const todayFocusMins = Math.round(todayFocusSecs / 60);

  // Weekly Focus Time
  const oneWeekAgoStr = new Date(todayDateObj.getTime() - 7 * 24 * 60 * 60 * 1000 - (todayDateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const weeklySessions = focus.sessions.filter((s: FocusSession) => {
    const sDate = new Date(s.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    return sDate >= oneWeekAgoStr && s.mode === 'focus' && s.completed;
  });
  const weeklyFocusSecs = weeklySessions.reduce((acc, s) => acc + s.duration, 0);
  const weeklyFocusHours = (weeklyFocusSecs / 3600).toFixed(1);

  // Weekly Task Completion
  const weeklyCompletedTasks = tasks.filter(t => t.status === 'completed' && t.dueDate && t.dueDate >= oneWeekAgoStr).length;

  return (
    <div className="main-content" style={{paddingBottom: '4rem'}}>
      {/* A. Welcome Header */}
      <div className="screen-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <span style={{fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600}}>
            {formattedDate}
          </span>
          <h1 style={{marginTop: '0.25rem', marginBottom: '0.25rem'}}>¡Hola, {firstName}!</h1>
          <p style={{margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem'}}>{todayMessage}</p>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem'}}>
        
        {/* Left Column (8/12) */}
        <div style={{gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          
          {/* F. Quick Actions */}
          <div style={{display: 'flex', gap: '1rem'}}>
            <button className="btn btn-primary" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}} onClick={onOpenNewTask}>
              <Icons.CheckSquare /> Tarea
            </button>
            <button className="btn btn-secondary" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}} onClick={() => onNavigate('horario')}>
              <Icons.Book /> Horario
            </button>
            <button className="btn btn-secondary" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}} onClick={() => onNavigate('planificador')}>
              <Icons.Edit /> Planificador
            </button>
            <button className="btn btn-secondary" style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}} onClick={() => onNavigate('enfoque')}>
              <Icons.Play /> Enfoque
            </button>
          </div>

          {/* B. Today's Agenda */}
          <div className="dash-card">
            <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Calendar /> Tu Agenda de Hoy</h3>
            {agendaItems.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem'}}>
                {agendaItems.map((item: any) => {
                  let icon = <Icons.Calendar />;
                  let typeLabel = 'Evento';
                  
                  if (item.category === 'class_session') {
                    icon = <Icons.Book />;
                    typeLabel = 'Clase';
                  } else if (item.category === 'study_block') {
                    icon = <Icons.Activity />;
                    typeLabel = 'Bloque de Estudio';
                  } else if (item.category === 'deadline') {
                    icon = <Icons.CheckSquare />;
                    typeLabel = 'Entrega';
                  } else if (item.category === 'exam') {
                    icon = <Icons.TrendingUp />; // Reusing as Exam indicator
                    typeLabel = 'Examen';
                  }

                  return (
                    <div key={item.id} style={{
                      display: 'flex', gap: '1rem', alignItems: 'center', 
                      background: 'var(--color-bg-base)', padding: '0.75rem 1rem', 
                      borderRadius: 'var(--radius-sm)', borderLeft: `4px solid ${item.category === 'deadline' ? 'var(--color-destructive)' : 'var(--color-accent-main)'}`
                    }}>
                      <div style={{minWidth: '60px', fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.95rem'}}>
                        {item.startTime === '23:59' ? 'Hoy' : item.startTime}
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
                        <span style={{fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem'}}>{item.title}</span>
                        <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                          {icon} {typeLabel} {item.subject && `· ${item.subject}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{padding: '2rem 1rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-sm)'}}>
                <Icons.Check />
                <h4>Sin actividades programadas</h4>
                <p>Tu día está completamente libre.</p>
              </div>
            )}
          </div>

        </div>

        {/* Right Column (4/12) */}
        <div style={{gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          
          {/* C. Academic Priorities */}
          <div className="dash-card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <h3 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Activity /> Prioridades</h3>
              <button style={{background: 'none', border: 'none', color: 'var(--color-accent-main)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem'}} onClick={() => onNavigate('tareas')}>
                Ver todas
              </button>
            </div>
            
            {priorityTasks.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                {priorityTasks.map(t => {
                  const isOverdue = t.dueDate && t.dueDate < localTodayStr;
                  const isToday = t.dueDate === localTodayStr;
                  
                  return (
                    <div key={t.id} style={{
                      background: 'var(--color-bg-base)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                      border: isOverdue ? '1px solid var(--color-destructive)' : '1px solid var(--color-border)'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                        <h4 style={{margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <input type="checkbox" checked={false} onChange={() => onToggleTask(t.id)} style={{margin: 0, cursor: 'pointer'}} />
                          {t.title}
                        </h4>
                        <button style={{background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0}} onClick={() => onEditTask(t)}>
                          <Icons.Edit />
                        </button>
                      </div>
                      <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingLeft: '1.5rem', marginTop: '0.25rem'}}>
                        {t.dueDate && (
                          <span style={{fontSize: '0.75rem', color: isOverdue ? 'var(--color-destructive)' : isToday ? 'var(--color-text-main)' : 'var(--color-text-muted)', fontWeight: isOverdue || isToday ? 600 : 400}}>
                            {isOverdue ? 'Atrasada' : isToday ? 'Para hoy' : `Vence: ${t.dueDate}`}
                          </span>
                        )}
                        {t.estimatedDuration && (
                          <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                            · {t.estimatedDuration} min
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{padding: '1.5rem 1rem'}}>
                <Icons.CheckSquare />
                <p>No tienes tareas pendientes.</p>
              </div>
            )}
          </div>

          {/* D. Study Planning Summary */}
          <div className="dash-card">
            <h3 style={{margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Edit /> Plan de Estudio</h3>
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg-base)', padding: '1rem', borderRadius: 'var(--radius-sm)'}}>
              <div style={{background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', padding: '0.75rem', borderRadius: '50%'}}>
                <Icons.Clock />
              </div>
              <div>
                <h4 style={{margin: 0, fontSize: '1.2rem'}}>{todayStudyBlocks.length} bloques hoy</h4>
                <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>
                  {totalStudyMinutes > 0 ? `Total: ${plannedTimeStr} confirmados` : 'Ningún bloque guardado'}
                </p>
              </div>
            </div>
            <button className="btn btn-secondary" style={{width: '100%', marginTop: '0.75rem', fontSize: '0.85rem'}} onClick={() => onNavigate('planificador')}>
              Generar nueva propuesta
            </button>
          </div>

          {/* E. Focus and Progress */}
          <div className="dash-card">
            <h3 style={{margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.TrendingUp /> Tu Progreso</h3>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-base)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)'}}>
                <span style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600}}>Enfoque Hoy</span>
                <span style={{fontWeight: 700, color: 'var(--color-accent-main)'}}>{todayFocusMins} min</span>
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-base)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)'}}>
                <span style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600}}>Enfoque Semanal</span>
                <span style={{fontWeight: 700}}>{weeklyFocusHours}h</span>
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-base)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)'}}>
                <span style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600}}>Tareas Semanales</span>
                <span style={{fontWeight: 700}}>{weeklyCompletedTasks} resueltas</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
