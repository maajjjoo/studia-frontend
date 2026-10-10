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
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('general');

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
      studyPreferences: {
        ...prev.studyPreferences,
        [field]: value
      }
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

  const handleSave = () => {
    setError('');
    const removedSubjects = profile.subjects.filter(s => !formData.subjects.includes(s));
    for (const sub of removedSubjects) {
      const isUsed = formData.classTimetable?.some(c => c.subject === sub);
      if (isUsed) {
        setError(`No puedes eliminar la materia "${sub}" porque está asignada a una clase en el horario.`);
        return;
      }
    }
    
    if (removedSubjects.length > 0 || (profile.studyAvailability !== formData.studyAvailability)) {
      setShowConfirm(true);
    } else {
      confirmSave();
    }
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
    (newAvail[index] as any)[field] = field === 'dayOfWeek' ? parseInt(value) : value;
    handleChange('studyAvailability', newAvail);
  };

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  return (
    <div className="main-content" style={{paddingBottom: '4rem', display: 'flex', flexDirection: 'column'}}>
      <div className="screen-header" style={{borderBottom: 'none', paddingBottom: 0, marginBottom: '2rem'}}>
        <div>
          <h1 style={{margin: '0 0 0.5rem 0'}}>Ajustes</h1>
          <p style={{color: 'var(--color-text-muted)', margin: 0}}>Administra tus preferencias y personaliza tu espacio de Studia.</p>
        </div>
        {isDirty && (
          <div style={{display: 'flex', gap: '1rem'}}>
            <button className="btn btn-secondary" onClick={() => { setFormData(profile); setIsDirty(false); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar cambios</button>
          </div>
        )}
      </div>

      {error && (
        <div style={{background: 'var(--color-destructive)', color: '#fff', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem'}}>
          <strong>Error de validación:</strong> {error}
        </div>
      )}

      <div style={{display: 'flex', gap: '4rem', flex: 1}}>
        {/* Left Navigation */}
        <div style={{width: '240px', display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
          <button className={`nav-item ${activeTab === 'general' ? 'active' : ''}`} style={{justifyContent: 'flex-start'}} onClick={() => setActiveTab('general')}>
            <Icons.Settings /> General
          </button>
          <button className={`nav-item ${activeTab === 'apariencia' ? 'active' : ''}`} style={{justifyContent: 'flex-start'}} onClick={() => setActiveTab('apariencia')}>
            <Icons.Database /> Apariencia
          </button>
          <button className={`nav-item ${activeTab === 'academico' ? 'active' : ''}`} style={{justifyContent: 'flex-start'}} onClick={() => setActiveTab('academico')}>
            <Icons.Book /> Académico
          </button>
        </div>

        {/* Right Content */}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingRight: '1rem'}}>
          
          {activeTab === 'general' && (
            <>
              {/* Account Section */}
              <div>
                <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Cuenta</h4>
                <div style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                  
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Nombre de usuario</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Tu identidad visible en Studia.</div>
                    </div>
                    <input type="text" className="form-input" style={{width: '250px'}} value={formData.name} onChange={e => handleChange('name', e.target.value)} />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Programa académico</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>La carrera o grado que estudias.</div>
                    </div>
                    <input type="text" className="form-input" style={{width: '250px'}} value={formData.program} onChange={e => handleChange('program', e.target.value)} />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Semestre actual</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Tu nivel de progreso actual.</div>
                    </div>
                    <input type="text" className="form-input" style={{width: '250px'}} value={formData.semester} onChange={e => handleChange('semester', e.target.value)} />
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'apariencia' && (
            <>
              {/* Theme Section */}
              <div>
                <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Tema y Estilo</h4>
                <div style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                  
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Paleta de colores</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Selecciona el acento principal de la interfaz.</div>
                    </div>
                    
                    <div style={{display: 'flex', gap: '1rem'}}>
                      <div className={`theme-card ${theme === 'rose' ? 'active' : ''}`} style={{width: '120px'}} onClick={() => onChangeTheme('rose')}>
                        <div className="theme-preview" style={{background: '#FDF3F5'}}><div className="tp-a1" style={{background: '#D48E9B'}}></div><div className="tp-a2" style={{background: '#F8F9FA'}}></div></div>
                        <span style={{fontWeight: 600, fontSize: '0.85rem'}}>Rosa</span>
                      </div>
                      <div className={`theme-card ${theme === 'blue' ? 'active' : ''}`} style={{width: '120px'}} onClick={() => onChangeTheme('blue')}>
                        <div className="theme-preview" style={{background: '#F3F8FC'}}><div className="tp-b1" style={{background: '#7FA3C1'}}></div><div className="tp-b2" style={{background: '#F8F9FA'}}></div></div>
                        <span style={{fontWeight: 600, fontSize: '0.85rem'}}>Azul</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Preferences Section */}
              <div>
                <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Preferencias de Enfoque</h4>
                <div style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                  
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Duración Pomodoro (min)</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Tiempo para cada bloque de enfoque.</div>
                    </div>
                    <input type="number" className="form-input" style={{width: '100px'}} value={formData.studyPreferences?.preferredSessionDuration || 25} onChange={e => handlePreferencesChange('preferredSessionDuration', parseInt(e.target.value))} />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Descanso corto (min)</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Pausa entre sesiones de estudio.</div>
                    </div>
                    <input type="number" className="form-input" style={{width: '100px'}} value={formData.studyPreferences?.preferredBreakDuration || 5} onChange={e => handlePreferencesChange('preferredBreakDuration', parseInt(e.target.value))} />
                  </div>

                </div>
              </div>
            </>
          )}

          {activeTab === 'academico' && (
            <>
              {/* Materias Section */}
              <div>
                <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Materias Inscritas</h4>
                <div style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                  
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input type="text" className="form-input" style={{flex: 1}} value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Ej. Álgebra Lineal" onKeyDown={e => e.key === 'Enter' && addSubject()} />
                    <button className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={addSubject}><Icons.Plus /> Añadir</button>
                  </div>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                    {formData.subjects.map(s => (
                      <span key={s} className="badge" style={{display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', padding: '0.4rem 0.75rem', background: 'var(--color-bg-base)'}}>
                        {s}
                        <button style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--color-text-muted)'}} onClick={() => removeSubject(s)}><Icons.Close /></button>
                      </span>
                    ))}
                    {formData.subjects.length === 0 && <span style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>No hay materias registradas.</span>}
                  </div>

                </div>
              </div>

              {/* Disponibilidad Section */}
              <div>
                <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Disponibilidad de Estudio</h4>
                <div style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                  
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
            </>
          )}

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
