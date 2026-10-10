import { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { StudentProfile } from './types';

interface Props {
  theme: string;
  onChangeTheme: (theme: 'rose' | 'blue') => void;
  profile: StudentProfile;
  onUpdateProfile: (profile: StudentProfile) => void;
}

export function SettingsScreen({ theme, onChangeTheme, profile, onUpdateProfile }: Props) {
  const [formData, setFormData] = useState<StudentProfile>(profile);
  const [isDirty, setIsDirty] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setFormData(profile);
    setIsDirty(false);
  }, [profile]);

  const handleChange = (field: keyof StudentProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handlePreferencesChange = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      studyPreferences: { ...prev.studyPreferences, [field]: value }
    }));
    setIsDirty(true);
  };

  const addSubject = () => {
    const val = newSubject.trim();
    if (val && !formData.subjects.includes(val)) {
      handleChange('subjects', [...formData.subjects, val]);
      setNewSubject('');
    }
  };

  const removeSubject = (sub: string) => {
    handleChange('subjects', formData.subjects.filter(s => s !== sub));
  };

  const [error, setError] = useState('');

  const handleSave = () => {
    setError('');
    
    // Check if any removed subject is still used in the timetable
    const removedSubjects = profile.subjects.filter(s => !formData.subjects.includes(s));
    for (const sub of removedSubjects) {
      const isUsed = formData.classTimetable?.some(c => c.subject === sub);
      if (isUsed) {
        setError(`No puedes eliminar la materia "${sub}" porque está asignada a una clase en tu Horario. Edita o elimina la clase primero.`);
        return;
      }
    }

    setShowConfirm(true);
  };

  const confirmSave = () => {
    onUpdateProfile(formData);
    setIsDirty(false);
    setShowConfirm(false);
  };

  const addAvailability = (dayOfWeek: number) => {
    const newAvail = { dayOfWeek, startTime: '14:00', endTime: '20:00' };
    handleChange('studyAvailability', [...(formData.studyAvailability || []), newAvail]);
  };

  const removeAvailability = (index: number) => {
    const newAvail = [...(formData.studyAvailability || [])];
    newAvail.splice(index, 1);
    handleChange('studyAvailability', newAvail);
  };

  const updateAvailability = (index: number, field: string, value: string) => {
    const newAvail = [...(formData.studyAvailability || [])];
    newAvail[index] = { ...newAvail[index], [field]: value };
    handleChange('studyAvailability', newAvail);
  };

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <div className="main-content" style={{paddingBottom: '4rem'}}>
      <div className="screen-header">
        <div>
          <h1>Ajustes Académicos</h1>
          <p>Configura tu perfil, preferencias de estudio y disponibilidad.</p>
        </div>
        {isDirty && (
          <div style={{display: 'flex', gap: '1rem'}}>
            <button className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={() => { setFormData(profile); setIsDirty(false); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar cambios</button>
          </div>
        )}
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem'}}>
        {error && (
          <div style={{gridColumn: '1 / -1', background: 'var(--prio-high-bg)', color: 'var(--prio-high-text)', padding: '1rem', borderRadius: 'var(--radius-sm)'}}>
            <strong>Error de validación:</strong> {error}
          </div>
        )}
        {/* Perfil */}
        <div className="dash-card">
          <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Users /> Perfil del Estudiante</h3>
          <div className="form-group">
            <label className="form-label">Nombre completo</label>
            <input type="text" className="form-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} />
          </div>
          <div style={{display: 'flex', gap: '1rem'}}>
            <div className="form-group" style={{flex: 2}}>
              <label className="form-label">Carrera / Programa</label>
              <input type="text" className="form-input" value={formData.program} onChange={e => handleChange('program', e.target.value)} />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label className="form-label">Semestre</label>
              <input type="text" className="form-input" value={formData.semester} onChange={e => handleChange('semester', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Preferencias y Tema */}
        <div className="dash-card">
          <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Settings /> Preferencias y Apariencia</h3>
          <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
            <div className="form-group" style={{flex: 1}}>
              <label className="form-label">Duración Pomodoro (min)</label>
              <input type="number" className="form-input" value={formData.studyPreferences?.preferredSessionDuration || 25} onChange={e => handlePreferencesChange('preferredSessionDuration', parseInt(e.target.value))} />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label className="form-label">Descanso corto (min)</label>
              <input type="number" className="form-input" value={formData.studyPreferences?.preferredBreakDuration || 5} onChange={e => handlePreferencesChange('preferredBreakDuration', parseInt(e.target.value))} />
            </div>
          </div>

          <label className="form-label">Tema visual</label>
          <div className="theme-selector" style={{gridTemplateColumns: '1fr 1fr'}}>
            <div className={`theme-card ${theme === 'rose' ? 'active' : ''}`} onClick={() => onChangeTheme('rose')}>
              <div className="theme-preview" style={{background: '#FDF3F5'}}><div className="tp-a1" style={{background: '#D48E9B'}}></div><div className="tp-a2" style={{background: '#F8F9FA'}}></div></div>
              <span style={{fontWeight: 600, fontSize: '0.85rem'}}>Rosa Monocromático</span>
            </div>
            <div className={`theme-card ${theme === 'blue' ? 'active' : ''}`} onClick={() => onChangeTheme('blue')}>
              <div className="theme-preview" style={{background: '#F3F8FC'}}><div className="tp-b1" style={{background: '#7FA3C1'}}></div><div className="tp-b2" style={{background: '#F8F9FA'}}></div></div>
              <span style={{fontWeight: 600, fontSize: '0.85rem'}}>Azul Monocromático</span>
            </div>
          </div>
        </div>

        {/* Materias */}
        <div className="dash-card">
          <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Book /> Materias Inscritas</h3>
          <p style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Añade las asignaturas que cursas actualmente.</p>
          <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1rem'}}>
            <input type="text" className="form-input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Ej. Álgebra Lineal" onKeyDown={e => e.key === 'Enter' && addSubject()} />
            <button className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={addSubject}><Icons.Plus /> Añadir</button>
          </div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
            {formData.subjects.map(s => (
              <span key={s} className="badge" style={{display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', padding: '0.4rem 0.75rem', background: 'var(--color-bg-base)'}}>
                {s}
                <button style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--color-text-muted)'}} onClick={() => removeSubject(s)}><Icons.Close /></button>
              </span>
            ))}
          </div>

          <div style={{marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)'}}>
            <h4 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Calendar /> Horario de Clases</h4>
            <p style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Tienes {formData.classTimetable?.length || 0} clases registradas en tu semana.</p>
            <p style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>La gestión de clases, cruces y aulas se realiza en la sección dedicada de Horario.</p>
          </div>
        </div>

        {/* Disponibilidad */}
        <div className="dash-card">
          <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Icons.Clock /> Disponibilidad de Estudio</h3>
          <p style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Agrega tus ventanas de tiempo libres. El planificador deducirá tus clases automáticamente.</p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
            {(formData.studyAvailability || []).map((avail, i) => (
              <div key={i} style={{display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--color-bg-base)', padding: '0.5rem', borderRadius: 'var(--radius-sm)'}}>
                <select className="form-select" style={{flex: 1, padding: '0.4rem'}} value={avail.dayOfWeek} onChange={e => updateAvailability(i, 'dayOfWeek', e.target.value)}>
                  {days.map((d, idx) => <option key={d} value={idx + 1}>{d}</option>)}
                </select>
                <input type="time" className="form-input" style={{width: '90px', padding: '0.4rem'}} value={avail.startTime} onChange={e => updateAvailability(i, 'startTime', e.target.value)} />
                <span style={{color: 'var(--color-text-muted)'}}>-</span>
                <input type="time" className="form-input" style={{width: '90px', padding: '0.4rem'}} value={avail.endTime} onChange={e => updateAvailability(i, 'endTime', e.target.value)} />
                <button className="btn btn-secondary" style={{padding: '0.4rem', color: 'var(--color-destructive)', display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => removeAvailability(i)}><Icons.Trash /></button>
              </div>
            ))}
            
            <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.5rem'}}>
              <select id="new-avail-day" className="form-select" style={{flex: 1}}>
                {days.map((d, idx) => <option key={d} value={idx + 1}>{d}</option>)}
              </select>
              <button className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={() => {
                const day = parseInt((document.getElementById('new-avail-day') as HTMLSelectElement).value);
                addAvailability(day);
              }}><Icons.Plus /> Añadir ventana</button>
            </div>
          </div>
        </div>

      </div>

      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{marginTop: 0}}>Confirmar cambios académicos</h2>
            <p>Estás a punto de guardar cambios en tu perfil, materias o disponibilidad. Ten en cuenta lo siguiente:</p>
            <ul style={{color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: '1.6'}}>
              <li>Tus clases recurrentes en el <strong>Horario</strong> no se eliminarán ni moverán automáticamente. Si eliminaste una materia, deberás editar las clases manualmente.</li>
              <li>Tus <strong>bloques de estudio</strong> generados previamente en el Calendario se conservarán intactos.</li>
              <li>Para que el Planificador use tu nueva disponibilidad, deberás generar una nueva propuesta.</li>
            </ul>
            <div className="modal-actions" style={{marginTop: '2rem'}}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmSave}>Entendido, Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
