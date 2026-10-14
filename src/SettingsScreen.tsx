import { open } from '@tauri-apps/plugin-dialog';
import { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { StudentProfile } from './types';
import {
  DAY_NAMES,
  DURATION_LIMITS,
  FIELD_LIMITS,
  validateProfileInput,
  validateSubjectName,
} from './scheduleValidation';

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
  const [subjectError, setSubjectError] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [websiteError, setWebsiteError] = useState('');
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
    if (error) setError('');
  };

  const normalizeDomain = (input: string): string | null => {
    const raw = input.trim().toLowerCase();
    if (!raw) return null;

    // Reject schemes, paths, queries, fragments, credentials, ports, spaces, and wildcards
    if (
      raw.includes('://') ||
      raw.includes('/') ||
      raw.includes('?') ||
      raw.includes('#') ||
      raw.includes('@') ||
      raw.includes(':') ||
      raw.includes('*') ||
      /\s/.test(raw)
    ) {
      return null;
    }

    const val = raw.replace(/^www\./, '');
    if (!val || val === 'localhost' || val.length > FIELD_LIMITS.domainName) return null;

    const labels = val.split('.');
    if (labels.length < 2) return null;

    // Reject IPv4 addresses
    if (labels.length === 4 && labels.every(l => /^\d+$/.test(l))) {
      return null;
    }

    // Validate each label (supports 1-char labels like x.com and subdomains like web.whatsapp.com)
    const labelRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    const tldRegex = /^[a-z]{2,63}$/;

    if (!labels.every(l => labelRegex.test(l))) return null;
    if (!tldRegex.test(labels[labels.length - 1])) return null;

    return val;
  };

  const handleAddWebsite = () => {
    const normalized = normalizeDomain(newWebsite);
    if (!normalized) {
      setWebsiteError('Dominio inválido. Ingresa solo el dominio (ej: x.com, web.whatsapp.com, instagram.com) sin https://, rutas ni comodines.');
      return;
    }

    const current = formData.studyPreferences?.restrictedWebsites || [];
    if (current.some(d => d.toLowerCase() === normalized)) {
      setWebsiteError('El dominio ya está en la lista.');
      return;
    }

    const updatedWebsites = [...current, normalized];
    const newProfile: StudentProfile = {
      ...formData,
      studyPreferences: {
        ...formData.studyPreferences,
        restrictedWebsites: updatedWebsites
      }
    };

    setFormData(newProfile);
    onUpdateProfile(newProfile);
    setIsDirty(false);
    setNewWebsite('');
    setWebsiteError('');
  };

  const handleRemoveWebsite = (domain: string) => {
    const current = formData.studyPreferences?.restrictedWebsites || [];
    const updatedWebsites = current.filter(d => d.toLowerCase() !== domain.toLowerCase());
    const newProfile: StudentProfile = {
      ...formData,
      studyPreferences: {
        ...formData.studyPreferences,
        restrictedWebsites: updatedWebsites
      }
    };

    setFormData(newProfile);
    onUpdateProfile(newProfile);
    setIsDirty(false);
  };

  const handlePreferencesChange = (field: keyof StudentProfile['studyPreferences'], value: any) => {
    setFormData(prev => ({
      ...prev,
      studyPreferences: {
        ...prev.studyPreferences,
        [field]: value
      }
    }));
    setIsDirty(true);
    if (error) setError('');
  };

  const addSubject = () => {
    const validationErr = validateSubjectName(newSubject, formData.subjects);
    if (validationErr) {
      setSubjectError(validationErr);
      return;
    }
    const val = newSubject.trim();
    handleChange('subjects', [...formData.subjects, val]);
    setNewSubject('');
    setSubjectError('');
  };

  const removeSubject = (sub: string) => {
    handleChange('subjects', formData.subjects.filter(s => s !== sub));
  };

  const handleSave = () => {
    setError('');
    const profileErr = validateProfileInput(formData);
    if (profileErr) {
      setError(profileErr);
      return;
    }

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
    const sanitized: StudentProfile = {
      ...formData,
      name: formData.name.trim(),
      program: formData.program.trim(),
      semester: formData.semester.trim(),
    };
    setFormData(sanitized);
    onUpdateProfile(sanitized);
    setIsDirty(false);
    setShowConfirm(false);
  };

  const addAvailability = (dayOfWeek: number) => {
    const existingForDay = (formData.studyAvailability || []).filter(a => a.dayOfWeek === dayOfWeek);
    let defaultStart = '14:00';
    let defaultEnd = '20:00';
    if (existingForDay.some(a => a.startTime < '20:00' && a.endTime > '14:00')) {
      defaultStart = '20:00';
      defaultEnd = '22:00';
    }
    const newAvail = { dayOfWeek, startTime: defaultStart, endTime: defaultEnd };
    handleChange('studyAvailability', [...(formData.studyAvailability || []), newAvail]);
  };

  const removeAvailability = (index: number) => {
    const newAvail = [...(formData.studyAvailability || [])];
    newAvail.splice(index, 1);
    handleChange('studyAvailability', newAvail);
  };

  const updateAvailability = (index: number, field: string, value: string) => {
    const newAvail = [...(formData.studyAvailability || [])];
    (newAvail[index] as any)[field] = field === 'dayOfWeek' ? parseInt(value, 10) : value;
    handleChange('studyAvailability', newAvail);
  };

  const days = DAY_NAMES;

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
            <button className={`nav-item ${activeTab === 'enfoque' ? 'active' : ''}`} style={{justifyContent: 'flex-start'}} onClick={() => setActiveTab('enfoque')}>
              <Icons.Shield /> Modo Enfoque
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
                    <input type="text" className="form-input" style={{width: '250px'}} maxLength={FIELD_LIMITS.userName} value={formData.name} onChange={e => handleChange('name', e.target.value)} />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Programa académico</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>La carrera o grado que estudias.</div>
                    </div>
                    <input type="text" className="form-input" style={{width: '250px'}} maxLength={FIELD_LIMITS.programName} value={formData.program} onChange={e => handleChange('program', e.target.value)} />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Semestre actual</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Tu nivel de progreso actual.</div>
                    </div>
                    <input type="text" className="form-input" style={{width: '250px'}} maxLength={FIELD_LIMITS.semesterName} value={formData.semester} onChange={e => handleChange('semester', e.target.value)} />
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
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Tiempo para cada bloque de enfoque ({DURATION_LIMITS.focusMinMinutes}–{DURATION_LIMITS.focusMaxMinutes} min).</div>
                    </div>
                    <input
                      type="number"
                      className="form-input"
                      style={{width: '100px'}}
                      min={DURATION_LIMITS.focusMinMinutes}
                      max={DURATION_LIMITS.focusMaxMinutes}
                      step="1"
                      value={formData.studyPreferences?.preferredSessionDuration ?? ''}
                      onChange={e => handlePreferencesChange('preferredSessionDuration', e.target.value === '' ? NaN : Number(e.target.value))}
                    />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontWeight: 500, color: 'var(--color-text-main)'}}>Descanso corto (min)</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Pausa entre sesiones de estudio ({DURATION_LIMITS.breakMinMinutes}–{DURATION_LIMITS.breakMaxMinutes} min).</div>
                    </div>
                    <input
                      type="number"
                      className="form-input"
                      style={{width: '100px'}}
                      min={DURATION_LIMITS.breakMinMinutes}
                      max={DURATION_LIMITS.breakMaxMinutes}
                      step="1"
                      value={formData.studyPreferences?.preferredBreakDuration ?? ''}
                      onChange={e => handlePreferencesChange('preferredBreakDuration', e.target.value === '' ? NaN : Number(e.target.value))}
                    />
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
                  
                  <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <input
                        type="text"
                        className="form-input"
                        style={{flex: 1}}
                        maxLength={FIELD_LIMITS.subjectName}
                        value={newSubject}
                        onChange={e => {
                          setNewSubject(e.target.value);
                          if (subjectError) setSubjectError('');
                        }}
                        placeholder="Ej. Álgebra Lineal"
                        onKeyDown={e => e.key === 'Enter' && addSubject()}
                      />
                      <button className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={addSubject}><Icons.Plus /> Añadir</button>
                    </div>
                    {subjectError && <div style={{color: 'var(--color-destructive)', fontSize: '0.8rem'}}>{subjectError}</div>}
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
                        <input type="time" min="00:00" max="23:59" className="form-input" style={{width: '105px', padding: '0.4rem'}} value={avail.startTime} onChange={e => updateAvailability(i, 'startTime', e.target.value)} />
                        <span style={{color: 'var(--color-text-muted)'}}>-</span>
                        <input type="time" min="00:00" max="23:59" className="form-input" style={{width: '105px', padding: '0.4rem'}} value={avail.endTime} onChange={e => updateAvailability(i, 'endTime', e.target.value)} />
                        <button className="btn btn-secondary" style={{padding: '0.4rem', color: 'var(--color-destructive)', display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => removeAvailability(i)}><Icons.Trash /></button>
                      </div>
                    ))}
                    
                    <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.5rem'}}>
                      <select id="new-avail-day" className="form-select" style={{flex: 1}}>
                        {days.map((d, idx) => <option key={d} value={idx + 1}>{d}</option>)}
                      </select>
                      <button className="btn btn-secondary" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={() => {
                        const day = parseInt((document.getElementById('new-avail-day') as HTMLSelectElement).value, 10);
                        addAvailability(day);
                      }}><Icons.Plus /> Añadir ventana</button>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}


          {activeTab === 'enfoque' && (
            <>
              <div>
                <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Bloqueo de Aplicaciones</h4>

                <div style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>

                  <div style={{background: 'rgba(var(--color-accent-soft-rgb), 0.08)', border: '1px solid rgba(var(--color-accent-soft-rgb), 0.2)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start'}}>
                    <span style={{color: 'var(--color-accent-soft)', width: '16px', height: '16px', display: 'flex', marginTop: '0.1rem'}}><Icons.Shield /></span>
                    <div>
                      <div style={{fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)', marginBottom: '0.25rem'}}>¿Qué es el Modo Enfoque Estricto?</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.5'}}>
                        El modo estricto cerrará automáticamente las aplicaciones seleccionadas si intentas abrirlas durante tu sesión de estudio.
                        <br/><br/>
                        <strong>Advertencia:</strong> Guarda cualquier trabajo pendiente en ellas antes de continuar. Esta función no bloquea sitios web y las aplicaciones podrán reabrirse al finalizar la sesión.
                      </div>
                    </div>
                  </div>

                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)'}}>
                    <div>
                      <div style={{fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem'}}>Activar Modo Estricto</div>
                      <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem'}}>Aplicar restricciones automáticamente al iniciar un Pomodoro.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox"
                        checked={formData.studyPreferences?.strictFocusMode || false}
                        onChange={(e) => {
                          const newProfile: StudentProfile = {
                            ...formData,
                            studyPreferences: {
                              ...formData.studyPreferences,
                              strictFocusMode: e.target.checked
                            }
                          };
                          setFormData(newProfile);
                          onUpdateProfile(newProfile);
                          setIsDirty(false);
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>


                  <div style={{marginTop: '2rem'}}>
                    <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>

                      {/* Apps Column */}
                      <div style={{flex: '1 1 300px'}}>
                        <h5 style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Aplicaciones Soportadas</h5>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                          {[
                            { id: 'discord.exe', name: 'Discord' },
                            { id: 'whatsapp.exe', name: 'WhatsApp' },
                            { id: 'steam.exe', name: 'Steam' },
                            { id: 'spotify.exe', name: 'Spotify' },
                            { id: 'telegram.exe', name: 'Telegram' },
                            { id: 'leagueclient.exe', name: 'League of Legends' }
                          ].map(app => {
                            const isSelected = (formData.studyPreferences?.restrictedApps || []).includes(app.id);
                            return (
                              <div key={app.id} style={{display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg-base)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'}}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const current = formData.studyPreferences?.restrictedApps || [];
                                    const updated = isSelected ? current.filter(id => id !== app.id) : [...current, app.id];
                                    const newProfile: StudentProfile = {
                                      ...formData,
                                      studyPreferences: {
                                        ...formData.studyPreferences,
                                        restrictedApps: updated
                                      }
                                    };
                                    setFormData(newProfile);
                                    onUpdateProfile(newProfile);
                                    setIsDirty(false);
                                  }}
                                  disabled={!(formData.studyPreferences?.strictFocusMode)}
                                  style={{cursor: 'pointer'}}
                                />
                                <div style={{flex: 1, fontWeight: 500, color: 'var(--color-text-main)', opacity: formData.studyPreferences?.strictFocusMode ? 1 : 0.5}}>
                                  {app.name}
                                </div>
                                <div style={{fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace'}}>
                                  {app.id}
                                </div>
                              </div>
                            );
                          })}

                        </div>

                        <div style={{marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <h5 style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)', margin: 0}}>Aplicaciones Personalizadas</h5>
                          <button
                            className="btn btn-secondary"
                            style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem'}}
                            disabled={!(formData.studyPreferences?.strictFocusMode)}
                            onClick={async () => {
                              try {
                                const selected = await open({
                                  multiple: false,
                                  filters: [{ name: 'Ejecutable', extensions: ['exe'] }]
                                });
                                if (selected && typeof selected === 'string') {
                                  const current = formData.studyPreferences?.customRestrictedApps || [];
                                  if (!current.includes(selected)) {
                                    const updatedApps = [...current, selected];
                                    const newProfile = {
                                      ...formData,
                                      studyPreferences: {
                                        ...formData.studyPreferences,
                                        customRestrictedApps: updatedApps
                                      }
                                    };
                                    setFormData(newProfile);
                                    onUpdateProfile(newProfile);
                                    setIsDirty(false);
                                  }
                                }
                              } catch (e) {
                                console.error('Error opening dialog:', e);
                              }
                            }}
                          >
                            <Icons.Plus /> Agregar aplicación
                          </button>
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem'}}>
                          {(formData.studyPreferences?.customRestrictedApps || []).map(appPath => {
                            const fileName = appPath.split('\\').pop() || appPath;
                            return (
                              <div key={appPath} style={{display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg-base)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'}}>
                                <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
                                  <span style={{fontWeight: 500, color: 'var(--color-text-main)', opacity: formData.studyPreferences?.strictFocusMode ? 1 : 0.5}}>{fileName}</span>
                                  <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px'}} title={appPath}>{appPath}</span>
                                </div>
                                <button
                                  title="Eliminar aplicación"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: formData.studyPreferences?.strictFocusMode ? 'pointer' : 'default',
                                    padding: '0.5rem',
                                    color: 'var(--color-destructive)',
                                    opacity: formData.studyPreferences?.strictFocusMode ? 1 : 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'background 0.2s ease'
                                  }}
                                  onMouseOver={(e) => { if(formData.studyPreferences?.strictFocusMode) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'none'; }}
                                  disabled={!(formData.studyPreferences?.strictFocusMode)}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    const current = formData.studyPreferences?.customRestrictedApps || [];
                                    const updatedApps = current.filter(p => p !== appPath);

                                    const newProfile = {
                                      ...formData,
                                      studyPreferences: {
                                        ...formData.studyPreferences,
                                        customRestrictedApps: updatedApps
                                      }
                                    };

                                    setFormData(newProfile);
                                    onUpdateProfile(newProfile);
                                    setIsDirty(false);
                                  }}
                                >
                                  <span style={{width: '18px', height: '18px', display: 'flex'}}>
                                    <Icons.Trash />
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                          {(formData.studyPreferences?.customRestrictedApps || []).length === 0 && (
                            <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '0.5rem 0'}}>No has agregado aplicaciones personalizadas.</div>
                          )}
                        </div>
                      </div>


                      {/* Websites Column */}
                      <div style={{flex: '1 1 300px'}}>
                        <h5 style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 0.25rem 0'}}>Sitios Web</h5>
                        <div style={{fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: '1.4'}}>
                          Los dominios configurados se bloquearán en el archivo <code>hosts</code> de Windows durante el Modo Enfoque (requiere permisos UAC). Nota: el navegador puede reutilizar conexiones o caché de pestañas que ya estaban abiertas antes de iniciar la sesión; cierra las pestañas abiertas del sitio o prueba en una ventana nueva/incógnito.
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                          <div style={{display: 'flex', gap: '0.5rem', flexDirection: 'column'}}>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <input
                                type="text"
                                className="form-input"
                                style={{flex: 1}}
                                maxLength={FIELD_LIMITS.domainName}
                                value={newWebsite}
                                onChange={e => setNewWebsite(e.target.value)}
                                placeholder="Ej. instagram.com"
                                onKeyDown={e => e.key === 'Enter' && handleAddWebsite()}
                                disabled={!(formData.studyPreferences?.strictFocusMode)}
                              />
                              <button
                                className="btn btn-secondary"
                                style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}
                                onClick={handleAddWebsite}
                                disabled={!(formData.studyPreferences?.strictFocusMode) || !newWebsite.trim()}
                              >
                                <Icons.Plus /> Añadir
                              </button>
                            </div>
                            {websiteError && <div style={{color: 'var(--color-destructive)', fontSize: '0.8rem'}}>{websiteError}</div>}
                          </div>

                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                            {(formData.studyPreferences?.restrictedWebsites || []).map(site => (
                              <span key={site} className="badge" style={{display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', opacity: formData.studyPreferences?.strictFocusMode ? 1 : 0.5}}>
                                {site}
                                <button
                                  style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--color-text-muted)'}}
                                  onClick={() => handleRemoveWebsite(site)}
                                  disabled={!(formData.studyPreferences?.strictFocusMode)}
                                >
                                  <span style={{width: '14px', height: '14px', display: 'flex'}}><Icons.Close /></span>
                                </button>
                              </span>
                            ))}
                            {(formData.studyPreferences?.restrictedWebsites || []).length === 0 && (
                              <span style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic'}}>No hay sitios web restringidos.</span>
                            )}
                          </div>
                        </div>
                      </div>

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
