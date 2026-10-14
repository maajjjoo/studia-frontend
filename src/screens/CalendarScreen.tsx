import { useState, useMemo } from "react";
import { Icons } from "../Icons";
import { Activity } from "../types";
import { ActivityModal } from "../components/ActivityModal";

export function CalendarScreen({ activities, onAdd, onUpdate, onDelete }: any) {
  const localTodayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(localTodayStr);
  const [viewMonthDate, setViewMonthDate] = useState(new Date(localTodayStr + 'T12:00:00Z'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const year = viewMonthDate.getUTCFullYear();
  const month = viewMonthDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = new Date(Date.UTC(year, month, 1)).getUTCDay() === 0 ? 6 : new Date(Date.UTC(year, month, 1)).getUTCDay() - 1;

  const calendarDays = [];
  for (let i = 0; i < startOffset; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const dayActivities = useMemo(
    () => activities.filter((a: Activity) => a.date === selectedDate).sort((a: Activity, b: Activity) => a.startTime.localeCompare(b.startTime)),
    [activities, selectedDate]
  );
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
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginRight: '0.5rem' }} onClick={() => {
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
                  <div className="fc-dots">{dayActs.slice(0, 3).map((_: any, idx: number) => <div key={idx} className="fc-dot" />)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fc-agenda">
          <div className="fc-agenda-header">
            <h3>{new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => { setEditingActivity(null); setIsModalOpen(true); }}><Icons.Plus /> Crear</button>
          </div>
          <div className="fc-agenda-list">
            {dayActivities.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>No hay eventos para este día.</p>
            ) : dayActivities.map((act: Activity) => (
              <div key={act.id} className="fc-agenda-item">
                <span className="fc-agenda-time">{act.startTime}</span>
                <div className="fc-agenda-info" style={{ flex: 1 }}>
                  <h4>{act.title}</h4>
                  <p>{act.category === 'class' ? 'Clase' : act.category === 'exam' ? 'Examen' : act.category === 'assignment' ? 'Tarea' : 'Personal'}</p>
                </div>
                <div className="task-actions" style={{ opacity: 1, alignSelf: 'center' }}>
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
