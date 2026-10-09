import React, { useState } from 'react';
import { Icons } from './Icons';
import { StudentProfile, ClassSession } from './types';
import { checkScheduleConflict } from './scheduleValidation';

interface Props {
  profile: StudentProfile;
  onAddClass: (session: Omit<ClassSession, 'id'>) => void;
  onUpdateClass: (id: string, session: Omit<ClassSession, 'id'>) => void;
  onDeleteClass: (id: string) => void;
  onUpdateProfile: (profile: StudentProfile) => void;
}

export function TimetableScreen({ profile, onAddClass, onUpdateClass, onDeleteClass, onUpdateProfile }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const openNew = () => {
    setEditingSession(null);
    setIsModalOpen(true);
  };

  const openEdit = (session: ClassSession) => {
    setEditingSession(session);
    setIsModalOpen(true);
  };

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>Horario Académico</h1>
          <p>Organiza tus clases semanales y actividades fijas.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Icons.Plus /> Nueva clase
        </button>
      </div>

      {profile.subjects.length === 0 && profile.classTimetable.length === 0 ? (
        <div className="empty-state dash-card" style={{marginTop: '2rem'}}>
          <Icons.Calendar />
          <h3>No has registrado materias</h3>
          <p>Para crear tu horario, primero necesitas registrar tus asignaturas.</p>
          <div style={{display: 'flex', gap: '0.5rem', maxWidth: '400px', margin: '2rem auto 0'}}>
            <input 
              id="new-subject-input"
              type="text" 
              className="form-input" 
              placeholder="Ej. Matemáticas"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val && !profile.subjects.includes(val)) {
                    onUpdateProfile({ ...profile, subjects: [...profile.subjects, val] });
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
            <button className="btn btn-primary" onClick={() => {
              const input = document.getElementById('new-subject-input') as HTMLInputElement;
              const val = input.value.trim();
              if (val && !profile.subjects.includes(val)) {
                onUpdateProfile({ ...profile, subjects: [...profile.subjects, val] });
                input.value = '';
              }
            }}>Añadir</button>
          </div>
        </div>
      ) : (
        <div className="timetable-grid" style={{
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem', 
          marginTop: '2rem'
        }}>
          {days.map((dayName, index) => {
            const dayNum = index + 1;
            const dayClasses = profile.classTimetable
              .filter(c => c.dayOfWeek === dayNum)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div key={dayNum} className="dash-card" style={{padding: '1.5rem'}}>
                <h3 style={{margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem'}}>
                  {dayName}
                  <span className="badge" style={{background: 'var(--color-bg-base)'}}>{dayClasses.length}</span>
                </h3>
                
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {dayClasses.length === 0 ? (
                    <p style={{color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center'}}>Sin clases</p>
                  ) : dayClasses.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => openEdit(c)}
                      style={{
                        background: 'var(--color-bg-base)', 
                        border: '1px solid var(--color-border)',
                        borderLeft: '4px solid var(--color-accent-main)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1rem',
                        cursor: 'pointer',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <h4 style={{margin: '0 0 0.5rem 0', color: 'var(--color-text-main)'}}>{c.subject}</h4>
                      <p style={{margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                        <Icons.Clock /> {c.startTime} - {c.endTime}
                      </p>
                      {(c.room || c.description) && (
                        <p style={{margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>
                          {c.room && <span style={{display: 'block'}}>📍 {c.room}</span>}
                          {c.teacher && <span style={{display: 'block'}}>👤 {c.teacher}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClassModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSave={(data: Omit<ClassSession, 'id'>) => {
          if (editingSession) onUpdateClass(editingSession.id, data);
          else onAddClass(data);
          setIsModalOpen(false);
        }}
        onDelete={(id: string) => {
          onDeleteClass(id);
          setIsModalOpen(false);
        }}
        editingSession={editingSession}
        profile={profile}
      />
    </div>
  );
}

function ClassModal({ isOpen, onClose, onSave, onDelete, editingSession, profile }: any) {
  const [formData, setFormData] = useState<Omit<ClassSession, 'id'>>({
    subject: profile.subjects[0] || '',
    description: '',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
    room: '',
    teacher: ''
  });
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (editingSession) {
      setFormData(editingSession);
    } else {
      setFormData({
        subject: profile.subjects[0] || '',
        description: '',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '10:00',
        room: '',
        teacher: ''
      });
    }
    setError('');
  }, [editingSession, isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.subject) {
      setError('Debes seleccionar una materia.');
      return;
    }

    try {
      const conflict = checkScheduleConflict(formData, profile.classTimetable, editingSession?.id);
      if (conflict) {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        setError(`Cruce de horario con "${conflict.subject}" (${days[conflict.dayOfWeek-1]} de ${conflict.startTime} a ${conflict.endTime}).`);
        return;
      }
      onSave(formData);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la clase.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{editingSession ? 'Editar clase' : 'Nueva clase'}</h2>
        
        {error && <div style={{background: 'var(--prio-high-bg)', color: 'var(--prio-high-text)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem'}}>{error}</div>}

        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
          <div className="form-group">
            <label className="form-label">Materia</label>
            <select className="form-select" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required>
              {profile.subjects.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div className="form-group" style={{flex: 1}}>
              <label className="form-label">Día de la semana</label>
              <select className="form-select" value={formData.dayOfWeek} onChange={e => setFormData({...formData, dayOfWeek: parseInt(e.target.value)})}>
                <option value={1}>Lunes</option>
                <option value={2}>Martes</option>
                <option value={3}>Miércoles</option>
                <option value={4}>Jueves</option>
                <option value={5}>Viernes</option>
                <option value={6}>Sábado</option>
                <option value={7}>Domingo</option>
              </select>
            </div>
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div className="form-group" style={{flex: 1}}>
              <label className="form-label">Hora de inicio</label>
              <input type="time" className="form-input" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} required />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label className="form-label">Hora de fin</label>
              <input type="time" className="form-input" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Aula / Ubicación (Opcional)</label>
            <input type="text" className="form-input" value={formData.room || ''} onChange={e => setFormData({...formData, room: e.target.value})} placeholder="Ej. Edificio A, Aula 102" />
          </div>

          <div className="form-group">
            <label className="form-label">Profesor (Opcional)</label>
            <input type="text" className="form-input" value={formData.teacher || ''} onChange={e => setFormData({...formData, teacher: e.target.value})} placeholder="Nombre del docente" />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción (Opcional)</label>
            <input type="text" className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ej. Laboratorio práctico" />
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem'}}>
            {editingSession ? (
              <button type="button" className="btn btn-secondary" style={{color: 'var(--prio-high-text)'}} onClick={() => onDelete(editingSession.id)}>Eliminar</button>
            ) : <div />}
            <div style={{display: 'flex', gap: '1rem'}}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
