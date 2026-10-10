import React, { useState, useMemo, useEffect, useRef } from "react";
import "./App.css";
import { Icons } from "./Icons";
import { useTasks } from "./useTasks";
import { useSchedule } from "./useSchedule";
import { useFocus } from "./useFocus";
import { useAi } from "./useAi";
import { useProfile } from "./useProfile";
import { OnboardingScreen } from "./OnboardingScreen";
import { TimetableScreen } from "./TimetableScreen";
import { PlannerScreen } from "./PlannerScreen";
import { SettingsScreen } from "./SettingsScreen";
import { Task, Priority, Activity, ActivityCategory, FocusSession, AiMessage } from "./types";

// Extracted SVGs (Spark, Bell, Play, Pause, Reset)

// --- Hooks ---
function useTheme() {
  const [theme, setTheme] = useState<'rose' | 'blue'>('rose');

  useEffect(() => {
    const saved = localStorage.getItem('studia_theme');
    if (saved === 'rose' || saved === 'blue') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      localStorage.setItem('studia_theme', 'rose');
      document.documentElement.setAttribute('data-theme', 'rose');
    }
  }, []);

  const changeTheme = (newTheme: 'rose' | 'blue') => {
    setTheme(newTheme);
    localStorage.setItem('studia_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return { theme, changeTheme };
}

// --- Modals ---
function TaskModal({ isOpen, onClose, onSave, editingTask }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title); setDescription(editingTask.description || "");
        setPriority(editingTask.priority); setDueDate(editingTask.dueDate || "");
        setEstimatedDuration(editingTask.estimatedDuration ? String(editingTask.estimatedDuration) : "");
      } else {
        setTitle(""); setDescription(""); setPriority("medium"); setDueDate(""); setEstimatedDuration("");
      }
    }
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ 
      title: title.trim(), 
      description: description.trim() || undefined, 
      priority, 
      dueDate: dueDate || undefined, 
      estimatedDuration: estimatedDuration ? parseInt(estimatedDuration, 10) : undefined,
      status: editingTask ? editingTask.status : 'pending' 
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingTask ? "Editar tarea" : "Nueva tarea"}</h2>
          <button className="modal-close" onClick={onClose}><Icons.Close /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de entrega</label>
              <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Duración estimada (minutos)</label>
            <input type="number" className="form-input" value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)} min="5" step="5" placeholder="Ej. 60" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivityModal({ isOpen, onClose, onSave, editingActivity, initialDate }: any) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [date, setDate] = useState(""); const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState(""); const [category, setCategory] = useState<ActivityCategory>("class");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      if (editingActivity) {
        setTitle(editingActivity.title); setDescription(editingActivity.description || "");
        setDate(editingActivity.date); setStartTime(editingActivity.startTime);
        setEndTime(editingActivity.endTime); setCategory(editingActivity.category);
      } else {
        const d = initialDate || new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        setTitle(""); setDescription(""); setDate(d); setStartTime("08:00"); setEndTime("09:00"); setCategory("class");
      }
    }
  }, [isOpen, editingActivity, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!title.trim() || !date || !startTime || !endTime) return;
    if (endTime <= startTime) { setError("La hora de finalización debe ser posterior a la de inicio."); return; }
    onSave({ title: title.trim(), description: description.trim() || undefined, date, startTime, endTime, category });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingActivity ? "Editar evento" : "Nuevo evento"}</h2>
          <button className="modal-close" onClick={onClose}><Icons.Close /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value as ActivityCategory)}>
              <option value="class">Clase</option><option value="exam">Examen</option><option value="assignment">Tarea</option><option value="personal">Personal</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Inicio *</label>
              <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Fin *</label>
              <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Helper Functions ---
const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const getWeeklyFocusData = (sessions: FocusSession[]) => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const weeklyData = [0, 0, 0, 0, 0, 0, 0];
  
  sessions.forEach(s => {
    if (!s.completed || s.mode !== 'focus') return;
    const sDate = new Date(s.startTime);
    // Exclude future dates just in case, and only count from Monday of this week
    if (sDate >= monday && sDate.getTime() <= now.getTime()) {
      let d = sDate.getDay();
      let idx = d === 0 ? 6 : d - 1;
      weeklyData[idx] += s.duration; // in seconds
    }
  });

  return weeklyData;
};

// --- Screens ---
function Home({ profile, tasks, activities, focus, onNavigate, onOpenNewTask, onOpenNewActivity, onToggleTask }: any) {
  const pendingTasks = tasks.filter((t: Task) => t.status === 'pending').slice(0, 3);
  const totalCompleted = tasks.filter((t: Task) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100);
  
  const todayDateObj = new Date();
  const formattedDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(todayDateObj);
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

  const getPriorityLabel = (p: string) => p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja';

  // Focus specific
  const todaySessions = focus.sessions.filter((s: FocusSession) => {
    const sDate = new Date(s.startTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    return sDate === localTodayStr;
  });

  // Helper for mini calendar
  const year = todayDateObj.getFullYear(); const month = todayDateObj.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const miniCal = [];
  for (let i = 0; i < startOffset; i++) miniCal.push(null);
  for (let i = 1; i <= daysInMonth; i++) miniCal.push(i);

  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(todayDateObj).toUpperCase();

  const firstName = profile?.name ? profile.name.split(' ')[0] : 'Estudiante';
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="main-content">
      <div className="top-header">
        <div className="header-titles">
          <span className="super-title">Mi Espacio</span>
          <h1>¡Hola, {firstName}!</h1>
          <p>Organiza tus ideas, avanza a tu ritmo y disfruta tu progreso.</p>
        </div>
        <div className="header-actions">
          <div className="header-date">
            <span className="date-label">Hoy</span>
            <span className="date-value">{formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}</span>
          </div>
          <button className="icon-circle"><Icons.Bell /></button>
          <div className="icon-circle" style={{background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', fontWeight: 700}}>{profile ? getInitials(profile.name) : 'ST'}</div>
        </div>
      </div>

      <div className="quick-actions-bar">
        <span className="quick-label">Acciones rápidas</span>
        <button className="action-pill" onClick={onOpenNewTask}><Icons.Plus /> Nueva tarea</button>
        <button className="action-pill" onClick={onOpenNewActivity}><Icons.Calendar /> Añadir evento</button>
        <button className="action-pill" onClick={() => { if(!focus.isRunning) focus.start(); onNavigate("enfoque"); }}><Icons.Play /> Iniciar enfoque</button>
        <button className="action-pill" onClick={() => onNavigate("asistente")}><Icons.Spark /> Consultar IA</button>
      </div>

      <div className="dashboard-grid">
        {/* Mis Tareas */}
        <div className="dash-card card-tasks">
          <button className="card-plus-btn" onClick={onOpenNewTask}><Icons.Plus /></button>
          <span className="card-super">Para hoy</span>
          <h2>Mis tareas</h2>
          
          <div className="progress-bar-wrapper">
            <div className="pb-header">
              <span>{totalCompleted} de {totalTasks} tareas completadas</span>
              <span>{progressPct}%</span>
            </div>
            <div className="pb-track"><div className="pb-fill" style={{width: `${progressPct}%`}}></div></div>
          </div>

          <div className="mini-task-list">
            {pendingTasks.length > 0 ? pendingTasks.map((t: Task) => (
              <div key={t.id} className="mini-task">
                <div className="mini-task-left">
                  <div className="mini-checkbox" onClick={() => onToggleTask(t.id)}></div>
                  <div className="mini-task-info">
                    <h4>{t.title}</h4>
                    {t.dueDate && <p><Icons.Clock /> {new Date(t.dueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</p>}
                  </div>
                </div>
                <span className={`badge ${t.priority === 'high' ? 'alta' : t.priority === 'medium' ? 'media' : 'baja'}`}>
                  {getPriorityLabel(t.priority)}
                </span>
              </div>
            )) : <p style={{fontSize: '0.9rem', opacity: 0.8}}>No tienes tareas pendientes.</p>}
          </div>
          
          <a className="card-link" onClick={() => onNavigate("tareas")}>Ver todas →</a>
        </div>

        {/* Mi Calendario */}
        <div className="dash-card card-calendar">
          <span className="card-super">{monthName}</span>
          <h2>Mi calendario</h2>
          
          <div className="mini-calendar-wrapper">
            <div className="mini-calendar-grid">
              <div className="mc-header">
                <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
              </div>
              <div className="mc-days">
                {miniCal.map((d, i) => {
                  if (!d) return <div key={i} className="mc-day"></div>;
                  const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isToday = dStr === localTodayStr;
                  const hasAct = activities.some((a:Activity) => a.date === dStr);
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
              <h4>Próximamente</h4>
              {upcomingActivities.length > 0 ? upcomingActivities.map((a: any) => (
                <div key={a.id} className="mini-agenda-item">
                  <span className="mini-agenda-time">{a.startTime}</span>
                  <div className="mini-agenda-info">
                    <h5>{a.title}</h5>
                    <p>{a.category === 'study_block' ? 'Bloque de Estudio' : a.category === 'class_session' ? 'Clase Recurrente' : a.category === 'class' ? 'Clase' : a.category === 'exam' ? 'Examen' : a.category === 'assignment' ? 'Tarea' : 'Personal'}</p>
                  </div>
                </div>
              )) : <p style={{fontSize: '0.8rem'}}>No hay eventos próximos.</p>}
            </div>
          </div>
          <a className="card-link" onClick={() => onNavigate("calendario")}>Ver calendario →</a>
        </div>

        {/* Tu Asistente IA */}
        <div className="dash-card card-ai">
          <span className="card-super">Tu compañera de estudio</span>
          <h2>Tu asistente IA</h2>
          <p style={{margin: 0, fontSize: '0.95rem'}}>¿Qué necesitas organizar hoy?</p>
          <div className="ai-input-wrapper">
            <input type="text" className="ai-input" placeholder="Escribe tu pregunta..." onClick={() => onNavigate('asistente')} readOnly />
            <button className="ai-btn" onClick={() => onNavigate('asistente')}>→</button>
          </div>
          <div className="ai-tags">
            <button className="ai-tag" onClick={() => onNavigate('asistente')}>Organizar mi semana</button>
            <button className="ai-tag" onClick={() => onNavigate('asistente')}>Dividir una tarea</button>
          </div>
        </div>

        {/* Pomodoro */}
        <div className="dash-card card-focus" onClick={() => onNavigate("enfoque")} style={{cursor: 'pointer'}}>
          <span className="card-super" style={{display: 'flex', justifyContent: 'space-between'}}>
            <span>Pomodoro</span>
            <span>{todaySessions.length} sesiones hoy</span>
          </span>
          <h2>Tiempo de enfoque</h2>
          <div className="focus-timer">
            <div className="timer-circle">
              <span className="timer-time">{formatTime(focus.timeLeft)}</span>
              <span className="timer-label">
                {focus.mode === 'focus' ? 'Enfoque' : focus.mode === 'shortBreak' ? 'Descanso corto' : 'Descanso largo'}
              </span>
            </div>
            <div className="timer-controls" onClick={e => e.stopPropagation()}>
              {focus.isRunning ? (
                <button className="btn-play" onClick={focus.pause}><Icons.Pause /></button>
              ) : (
                <button className="btn-play" onClick={focus.start}><Icons.Play /></button>
              )}
              <button className="btn-reset" onClick={focus.reset}><Icons.Reset /></button>
            </div>
          </div>
        </div>

        {/* Progreso Semanal */}
        <div className="dash-card card-progress" onClick={() => onNavigate("progreso")} style={{cursor: 'pointer'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <span className="card-super">Esta semana</span>
              <h2>Mi progreso semanal</h2>
            </div>
            <select className="form-select" style={{width: 'auto', padding: '0.5rem 1rem'}} defaultValue="esta" onClick={e => e.stopPropagation()}>
              <option value="esta">Esta semana</option>
            </select>
          </div>
          <div style={{height: '140px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '1rem', padding: '0 1rem'}}>
            {(() => {
              const wd = getWeeklyFocusData(focus.sessions);
              const maxWd = Math.max(...wd, 1800); // at least 30 mins to scale
              return wd.map((secs, i) => {
                const h = Math.round((secs / maxWd) * 100);
                return (
                  <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1}} title={`${Math.round(secs/60)} min`}>
                    <div style={{width: '16px', height: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'flex-end'}}>
                      <div style={{width: '100%', height: `${h}%`, background: h > 80 ? 'var(--color-btn-dark)' : 'var(--color-accent-main)', opacity: h > 0 ? (h > 80 ? 1 : 0.6) : 0, borderRadius: '8px', transition: 'height 0.3s ease'}}></div>
                    </div>
                    <span style={{fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)'}}>
                      {['L','M','X','J','V','S','D'][i]}
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

function TasksScreen({ tasks, onAdd, onUpdate, onDelete, onToggle }: any) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => tasks.filter((t: Task) => (filter === 'all' || t.status === filter)).sort((a: Task, b: Task) => b.createdAt - a.createdAt), [tasks, filter]);

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>Tus tareas</h1>
          <p>Administra y organiza todo lo que necesitas hacer.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingTask(null); setIsModalOpen(true); }}><Icons.Plus /> Nueva tarea</button>
      </div>

      <div className="tasks-filters">
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pendientes</button>
        <button className={`filter-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completadas</button>
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas</button>
      </div>

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <Icons.CheckSquare />
            <h3>No hay tareas aquí</h3>
            <p>Estás al día. ¡Disfruta tu tiempo libre!</p>
          </div>
        ) : filteredTasks.map((task: Task) => (
          <div key={task.id} className={`task-item ${task.status === 'completed' ? 'is-completed' : ''}`}>
            <div className={`task-checkbox ${task.status === 'completed' ? 'completed' : ''}`} onClick={() => onToggle(task.id)}>
              <Icons.Check />
            </div>
            <div className="task-content">
              <h3 className="task-title">{task.title}</h3>
              <div className="task-meta">
                <span className={`badge ${task.priority === 'high' ? 'alta' : task.priority === 'medium' ? 'media' : 'baja'}`}>
                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                </span>
                {task.dueDate && <span><Icons.Clock /> {new Date(task.dueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</span>}
              </div>
            </div>
            <div className="task-actions">
              <button className="icon-btn" onClick={() => { setEditingTask(task); setIsModalOpen(true); }}><Icons.Edit /></button>
              <button className="icon-btn danger" onClick={() => window.confirm("¿Eliminar tarea?") && onDelete(task.id)}><Icons.Trash /></button>
            </div>
          </div>
        ))}
      </div>
      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(t: any) => editingTask ? onUpdate(editingTask.id, t) : onAdd(t)} editingTask={editingTask} />
    </div>
  );
}

function CalendarScreen({ activities, onAdd, onUpdate, onDelete }: any) {
  const localTodayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(localTodayStr);
  const [viewMonthDate, setViewMonthDate] = useState(new Date(localTodayStr + 'T12:00:00Z'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const year = viewMonthDate.getUTCFullYear(); const month = viewMonthDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = new Date(Date.UTC(year, month, 1)).getUTCDay() === 0 ? 6 : new Date(Date.UTC(year, month, 1)).getUTCDay() - 1;

  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const dayActivities = useMemo(() => activities.filter((a: Activity) => a.date === selectedDate).sort((a: Activity, b: Activity) => a.startTime.localeCompare(b.startTime)), [activities, selectedDate]);
  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(viewMonthDate);

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>Calendario</h1>
          <p>Visualiza y planifica tus actividades del mes.</p>
        </div>
      </div>

      <div className="full-calendar-container">
        <div className="fc-main">
          <div className="fc-header">
            <h2 className="fc-title">{monthName}</h2>
            <div className="fc-nav">
              <button className="btn btn-secondary" style={{padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginRight: '0.5rem'}} onClick={() => {
                setViewMonthDate(new Date(localTodayStr + 'T12:00:00Z'));
                setSelectedDate(localTodayStr);
              }}>Hoy</button>
              <button className="fc-nav-btn" onClick={() => setViewMonthDate(new Date(Date.UTC(year, month - 1, 1)))}><Icons.ChevronLeft /></button>
              <button className="fc-nav-btn" onClick={() => setViewMonthDate(new Date(Date.UTC(year, month + 1, 1)))}><Icons.ChevronRight /></button>
            </div>
          </div>
          <div className="fc-grid">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="fc-day-head">{d}</div>)}
            {calendarDays.map((d, i) => {
              if (!d) return <div key={i} className="fc-cell empty" />;
              const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isSelected = dStr === selectedDate;
              const isToday = dStr === localTodayStr;
              const dayActs = activities.filter((a: Activity) => a.date === dStr);
              return (
                <div key={dStr} className={`fc-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => setSelectedDate(dStr)}>
                  {d}
                  <div className="fc-dots">{dayActs.slice(0,3).map((_: any, idx: number) => <div key={idx} className="fc-dot"/>)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fc-agenda">
          <div className="fc-agenda-header">
            <h3>{new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <button className="btn btn-primary" style={{padding: '0.4rem 1rem', fontSize: '0.8rem'}} onClick={() => { setEditingActivity(null); setIsModalOpen(true); }}><Icons.Plus /> Crear</button>
          </div>
          <div className="fc-agenda-list">
            {dayActivities.length === 0 ? (
              <p style={{color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0'}}>No hay eventos para este día.</p>
            ) : dayActivities.map((act: Activity) => (
              <div key={act.id} className="fc-agenda-item">
                <span className="fc-agenda-time">{act.startTime}</span>
                <div className="fc-agenda-info" style={{flex: 1}}>
                  <h4>{act.title}</h4>
                  <p>{act.category === 'class' ? 'Clase' : act.category === 'exam' ? 'Examen' : act.category === 'assignment' ? 'Tarea' : 'Personal'}</p>
                </div>
                <div className="task-actions" style={{opacity: 1, alignSelf: 'center'}}>
                  <button className="icon-btn" onClick={() => { setEditingActivity(act); setIsModalOpen(true); }}><Icons.Edit /></button>
                  <button className="icon-btn danger" onClick={() => window.confirm("¿Eliminar actividad?") && onDelete(act.id)}><Icons.Trash /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ActivityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(a: any) => editingActivity ? onUpdate(editingActivity.id, a) : onAdd(a)} editingActivity={editingActivity} initialDate={selectedDate} />
    </div>
  );
}

function FocusScreen({ focus }: any) {
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
          </div>

          <div className="focus-actions">
            {focus.isRunning ? (
              <button className="btn-focus-action active" onClick={focus.pause}><Icons.Pause /> Pausar</button>
            ) : (
              <button className="btn-focus-action" onClick={focus.start}><Icons.Play /> Iniciar</button>
            )}
            <button className="btn-focus-action outline" onClick={focus.reset}><Icons.Reset /> Reiniciar</button>
          </div>
        </div>

        <div className="focus-sidebar">
          <div className="fc-agenda">
            <div className="fc-agenda-header">
              <h3>Historial de hoy</h3>
              <span className="badge alta">{todaySessions.length} completados</span>
            </div>
            
            <div className="fc-agenda-list" style={{maxHeight: '400px', overflowY: 'auto'}}>
              {todaySessions.length === 0 ? (
                <div className="empty-state">
                  <Icons.TrendingUp />
                  <p>Inicia una sesión de enfoque para ver tu historial aquí.</p>
                </div>
              ) : (
                todaySessions.reverse().map((s: FocusSession) => (
                  <div key={s.id} className="fc-agenda-item" style={{padding: '0.75rem', gap: '0.75rem'}}>
                    <div style={{background: 'var(--color-bg-base)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Icons.Check />
                    </div>
                    <div className="fc-agenda-info">
                      <h4>{getModeLabel(s.mode)}</h4>
                      <p>{Math.round(s.duration / 60)} min • {new Date(s.startTime).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}</p>
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

function AiScreen({ profile, ai, tasks, activities, focus }: any) {
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ai.messages, ai.isLoading]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || ai.isLoading) return;
    ai.sendMessage(input, { tasks, activities, focusSessions: focus.sessions });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    "Organizar mi semana de estudio.",
    "Dividir una tarea en pasos pequeños.",
    "Crear un plan para preparar un examen.",
    "Explicarme un tema que no entiendo."
  ];

  const firstName = profile?.name ? profile.name.split(' ')[0] : 'Estudiante';

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '2.5rem 3.5rem 1.5rem 3.5rem' }}>
      <div className="screen-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1>Tu asistente IA</h1>
          <p>Consulta, planifica y optimiza tu estudio.</p>
        </div>
        <button className="btn btn-secondary" onClick={ai.clearHistory}>Nueva conversación</button>
      </div>

      <div className="ai-chat-container">
        <div className="ai-messages-area">
          {ai.messages.length === 0 && (
            <div className="ai-empty-state">
              <div style={{ background: 'var(--card-ai-bg)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--color-accent-main)' }}>
                <Icons.Spark />
              </div>
              <h3 style={{fontSize: '1.5rem'}}>¿En qué te puedo ayudar hoy, {firstName}?</h3>
              <p>Puedes pedirme que estructure tus tareas, planifique tu semana o te explique un concepto difícil.</p>
              <div className="ai-suggested-grid">
                {suggestedPrompts.map(p => (
                  <button key={p} className="ai-suggested-btn" onClick={() => {
                    ai.sendMessage(p, { tasks, activities, focusSessions: focus.sessions });
                  }}>{p}</button>
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
                <div className="ai-message-bubble assistant loading">Escribiendo...</div>
             </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {ai.error && <div className="error-msg" style={{textAlign: 'center', marginBottom: '1rem'}}>{ai.error}</div>}

        <div className="ai-input-area">
          <textarea 
            className="ai-textarea" 
            placeholder="Escribe tu pregunta... (Shift + Enter para nueva línea)" 
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

function ProgressScreen({ tasks, focus }: any) {
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
          <h1>Progreso</h1>
          <p>Tus estadísticas y métricas de estudio en un solo lugar.</p>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '1.5rem'}}>
        <div className="dash-card">
          <span className="card-super">General</span>
          <h3>Total Tareas</h3>
          <p style={{fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--color-text-main)'}}>{totalTasks}</p>
        </div>
        <div className="dash-card">
          <span className="card-super">Logros</span>
          <h3>Completadas</h3>
          <p style={{fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--color-accent-main)'}}>{completedTasks}</p>
        </div>
        <div className="dash-card">
          <span className="card-super">Por hacer</span>
          <h3>Pendientes</h3>
          <p style={{fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--prio-high-text)'}}>{pendingTasks}</p>
        </div>
        <div className="dash-card card-tasks">
          <span className="card-super">Eficiencia</span>
          <h3>Avance</h3>
          <p style={{fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0'}}>{progressPct}%</p>
          <div className="pb-track" style={{marginTop: '0.5rem'}}><div className="pb-fill" style={{width: `${progressPct}%`}}></div></div>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem'}}>
        <div className="dash-card card-progress" style={{minHeight: '350px', display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <span className="card-super">Resumen Semanal</span>
              <h2>Tiempo de enfoque (Minutos)</h2>
            </div>
          </div>
          <div style={{flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '2rem', padding: '0 1rem'}}>
            {weeklyData.map((secs, i) => {
              const h = Math.round((secs / maxWd) * 100);
              return (
                <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', flex: 1}} title={`${Math.round(secs/60)} min`}>
                  <div style={{width: '32px', height: '200px', background: 'rgba(0,0,0,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'flex-end'}}>
                    <div style={{width: '100%', height: `${h}%`, background: h > 80 ? 'var(--color-btn-dark)' : 'var(--color-accent-main)', opacity: h > 0 ? (h > 80 ? 1 : 0.6) : 0, borderRadius: '16px', transition: 'height 0.3s ease'}}></div>
                  </div>
                  <span style={{fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)'}}>
                    {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          <div className="dash-card card-focus">
             <span className="card-super">Productividad de Hoy</span>
             <h2>Enfoque Diario</h2>
             <div style={{marginTop: '1.5rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                   <span style={{fontWeight: 600}}>Sesiones completadas</span>
                   <span className="badge alta">{todaySessions.length}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                   <span style={{fontWeight: 600}}>Tiempo hoy</span>
                   <span>{Math.round(todayFocusSecs/60)} min</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                   <span style={{fontWeight: 600}}>Tiempo semanal</span>
                   <span>{Math.round(weeklyFocusSecs/60)} min</span>
                </div>
             </div>
          </div>

          <div className="dash-card" style={{flex: 1, overflowY: 'auto'}}>
            <span className="card-super">Historial reciente</span>
            <h3>Últimas sesiones</h3>
            <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {focus.sessions.filter((s: FocusSession) => s.completed && s.mode === 'focus').length === 0 ? (
                <p style={{color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>No hay sesiones de enfoque completadas aún.</p>
              ) : (
                focus.sessions.filter((s: FocusSession) => s.completed && s.mode === 'focus').slice(-4).reverse().map((s: FocusSession) => (
                  <div key={s.id} style={{display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)'}}>
                    <div style={{background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Icons.TrendingUp />
                    </div>
                    <div>
                      <h5 style={{margin: 0}}>{new Date(s.startTime).toLocaleDateString('es-ES', {weekday: 'short', day: 'numeric'})}</h5>
                      <span style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>{Math.round(s.duration/60)} min</span>
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

// --- App ---
function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const { theme, changeTheme } = useTheme();
  const { profile, isLoaded: profileLoaded, saveProfile, addClassSession, updateClassSession, deleteClassSession } = useProfile();
  const { tasks, isLoaded: tasksLoaded, addTask, updateTask, deleteTask, toggleTaskStatus } = useTasks();
  const { activities, isScheduleLoaded, addActivity, updateActivity, deleteActivity } = useSchedule();
  const focus = useFocus();
  const ai = useAi();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  if (!tasksLoaded || !isScheduleLoaded || !focus.isLoaded || !ai.isLoaded || !profileLoaded) return null;

  if (!profile) {
    return <div className="layout" data-theme={theme}><OnboardingScreen onComplete={saveProfile} /></div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "inicio": return <Home profile={profile} tasks={tasks} activities={activities} focus={focus} onNavigate={setActiveTab} onOpenNewTask={() => setIsTaskModalOpen(true)} onOpenNewActivity={() => setIsActivityModalOpen(true)} onToggleTask={toggleTaskStatus} />;
      case "tareas": return <TasksScreen tasks={tasks} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} onToggle={toggleTaskStatus} />;
      case "planificador": return <PlannerScreen profile={profile} tasks={tasks} activities={activities} onSaveBlocks={(blocks) => { blocks.forEach(b => addActivity(b as Activity)); setActiveTab('calendario'); }} />;
      case "horario": return <TimetableScreen profile={profile} onAddClass={addClassSession} onUpdateClass={updateClassSession} onDeleteClass={deleteClassSession} onUpdateProfile={saveProfile} />;
      case "calendario": return <CalendarScreen activities={activities} onAdd={addActivity} onUpdate={updateActivity} onDelete={deleteActivity} />;
      case "enfoque": return <FocusScreen focus={focus} />;
      case "asistente": return <AiScreen profile={profile} ai={ai} tasks={tasks} activities={activities} focus={focus} />;
      case "progreso": return <ProgressScreen tasks={tasks} focus={focus} />;
      case "ajustes": return <SettingsScreen theme={theme} onChangeTheme={changeTheme} profile={profile} onUpdateProfile={saveProfile} />;
      default: return <Home profile={profile} focus={focus} />;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="layout" data-theme={theme}>
      <aside className="sidebar">
        <div className="brand"><Icons.Logo /><span>Studia</span></div>
        <span className="menu-label">Menú</span>
        <nav className="nav-links">
          <button className={`nav-item ${activeTab === "inicio" ? "active" : ""}`} onClick={() => setActiveTab("inicio")}><Icons.Home /> Inicio</button>
          <button className={`nav-item ${activeTab === "tareas" ? "active" : ""}`} onClick={() => setActiveTab("tareas")}><Icons.CheckSquare /> Tareas</button>
          <button className={`nav-item ${activeTab === "planificador" ? "active" : ""}`} onClick={() => setActiveTab("planificador")}><Icons.Edit /> Planificador</button>
          <button className={`nav-item ${activeTab === "horario" ? "active" : ""}`} onClick={() => setActiveTab("horario")}><Icons.Book /> Horario</button>
          <button className={`nav-item ${activeTab === "calendario" ? "active" : ""}`} onClick={() => setActiveTab("calendario")}><Icons.Calendar /> Calendario</button>
          <button className={`nav-item ${activeTab === "enfoque" ? "active" : ""}`} onClick={() => setActiveTab("enfoque")}><Icons.TrendingUp /> Enfoque</button>
          <button className={`nav-item ${activeTab === "asistente" ? "active" : ""}`} onClick={() => setActiveTab("asistente")}><Icons.Spark /> Asistente IA</button>
          <button className={`nav-item ${activeTab === "progreso" ? "active" : ""}`} onClick={() => setActiveTab("progreso")}><Icons.Activity /> Progreso</button>
          
        </nav>
        
        <div className="sidebar-promo">
          <div className="promo-icon"><Icons.Activity /></div>
          <h4>Un paso a la vez</h4>
          <p>Tu constancia está dando frutos.</p>
        </div>

        <div className="user-profile" style={{position: 'relative', cursor: 'pointer', transition: 'var(--transition-smooth)', display: 'flex', alignItems: 'center'}} onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
          <div className="avatar">{getInitials(profile.name)}</div>
          <div className="user-info" style={{flex: 1}}>
            <span className="user-name">{profile.name}</span>
            <span className="user-role">{profile.program || 'Estudiante'}</span>
          </div>
          <div style={{color: 'var(--color-text-muted)'}}><Icons.ChevronUp /></div>
          {isProfileMenuOpen && (
            <>
              <div style={{position: 'fixed', inset: 0, zIndex: 99}} onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(false); }} />
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, width: '100%', marginBottom: '0.5rem',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)', zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderBottom: '1px solid var(--color-border)'}}>
                  <div className="avatar" style={{width: '32px', height: '32px', fontSize: '0.85rem'}}>{getInitials(profile.name)}</div>
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    <span style={{fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)'}}>{profile.name}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>estudiante@studia.edu</span>
                  </div>
                </div>
                <div style={{padding: '0.5rem'}}>
                  <button className="nav-item" style={{width: '100%', justifyContent: 'flex-start', background: 'transparent', padding: '0.5rem 0.75rem'}} onClick={(e) => e.stopPropagation()}>
                    <Icons.User /> Ver perfil
                  </button>
                  <button className="nav-item" style={{width: '100%', justifyContent: 'flex-start', background: 'var(--color-bg-base)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)'}} onClick={(e) => { e.stopPropagation(); setActiveTab("ajustes"); setIsProfileMenuOpen(false); }}>
                    <Icons.Settings /> Ajustes
                  </button>
                  <button className="nav-item" style={{width: '100%', justifyContent: 'flex-start', background: 'transparent', padding: '0.5rem 0.75rem'}} onClick={(e) => e.stopPropagation()}>
                    <Icons.HelpCircle /> Ayuda y soporte
                  </button>
                </div>
                <div style={{borderTop: '1px solid var(--color-border)', padding: '0.5rem'}}>
                  <button className="nav-item" style={{width: '100%', justifyContent: 'flex-start', background: 'transparent', padding: '0.5rem 0.75rem', color: 'var(--color-destructive)'}} onClick={(e) => e.stopPropagation()}>
                    <Icons.LogOut /> Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {renderContent()}

      <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={addTask} editingTask={null} />
      <ActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} onSave={addActivity} editingActivity={null} />
    </div>
  );
}

export default App;
