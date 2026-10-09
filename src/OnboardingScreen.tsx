import { useState } from 'react';
import { StudentProfile } from './types';
import { Icons } from './Icons';

interface Props {
  onComplete: (profile: StudentProfile) => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<StudentProfile>({
    name: '',
    program: '',
    semester: '',
    subjects: [],
    classTimetable: [],
    unavailableBlocks: [],
    studyPreferences: {
      preferredSessionDuration: 25,
      preferredBreakDuration: 5
    },
    studyAvailability: []
  });

  const [currentSubject, setCurrentSubject] = useState('');

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const addSubject = () => {
    if (currentSubject.trim() && !profile.subjects.includes(currentSubject.trim())) {
      setProfile({ ...profile, subjects: [...profile.subjects, currentSubject.trim()] });
      setCurrentSubject('');
    }
  };

  const removeSubject = (subj: string) => {
    setProfile({ ...profile, subjects: profile.subjects.filter(s => s !== subj) });
  };

  const handleFinish = () => {
    if (!profile.name.trim()) {
      alert("Por favor, ingresa tu nombre.");
      setStep(1);
      return;
    }
    onComplete(profile);
  };

  return (
    <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg-base)' }}>
      <div className="dash-card" style={{ width: '100%', maxWidth: '600px', padding: '3rem', borderRadius: 'var(--radius-xl)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Icons.Logo />
          </div>
          <h1 style={{ margin: '0 0 0.5rem 0' }}>Configura tu espacio</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Paso {step} de 4</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: '40px', height: '6px', borderRadius: '3px', background: i <= step ? 'var(--color-accent-main)' : 'var(--color-border)' }} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="onboarding-step" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
            <h2>Sobre ti</h2>
            <div className="form-group">
              <label className="form-label">¿Cómo te llamas?</label>
              <input type="text" className="form-input" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} placeholder="Ej. María José" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">¿Qué estudias?</label>
              <input type="text" className="form-input" value={profile.program} onChange={e => setProfile({...profile, program: e.target.value})} placeholder="Ej. Ingeniería de Software" />
            </div>
            <div className="form-group">
              <label className="form-label">Semestre actual</label>
              <input type="text" className="form-input" value={profile.semester} onChange={e => setProfile({...profile, semester: e.target.value})} placeholder="Ej. 6to Semestre" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
            <h2>Tus materias</h2>
            <p style={{color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0}}>Añade las asignaturas que estás cursando este semestre.</p>
            <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="form-input" value={currentSubject} onChange={e => setCurrentSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="Nombre de la materia..." autoFocus />
              <button className="btn btn-primary" onClick={addSubject}>Añadir</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {profile.subjects.length === 0 ? (
                <p style={{color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>Aún no has añadido materias.</p>
              ) : profile.subjects.map(subj => (
                <div key={subj} style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', padding: '0.5rem 1rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                  {subj}
                  <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeSubject(subj)}>&times;</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
            <h2>Preferencias de estudio</h2>
            <p style={{color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0}}>¿Cómo te gusta organizar tu tiempo de concentración?</p>
            <div className="form-group">
              <label className="form-label">Duración de cada sesión (minutos)</label>
              <select className="form-select" value={profile.studyPreferences.preferredSessionDuration} onChange={e => setProfile({...profile, studyPreferences: {...profile.studyPreferences, preferredSessionDuration: parseInt(e.target.value)}})}>
                <option value={15}>15 minutos</option>
                <option value={25}>25 minutos (Pomodoro clásico)</option>
                <option value={45}>45 minutos</option>
                <option value={50}>50 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duración del descanso corto (minutos)</label>
              <select className="form-select" value={profile.studyPreferences.preferredBreakDuration} onChange={e => setProfile({...profile, studyPreferences: {...profile.studyPreferences, preferredBreakDuration: parseInt(e.target.value)}})}>
                <option value={5}>5 minutos</option>
                <option value={10}>10 minutos</option>
                <option value={15}>15 minutos</option>
              </select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-step" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
            <h2>Todo listo</h2>
            <p style={{color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0}}>Has configurado tu perfil básico. Podrás añadir tu horario de clases específico y otras disponibilidades directamente desde el módulo "Horario académico".</p>
            <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginTop: '1rem' }}>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--color-text-main)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><strong>Estudiante:</strong> {profile.name || 'No especificado'}</li>
                <li><strong>Materias:</strong> {profile.subjects.length} registradas</li>
                <li><strong>Enfoque:</strong> {profile.studyPreferences.preferredSessionDuration} min estudio / {profile.studyPreferences.preferredBreakDuration} min descanso</li>
              </ul>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={prevStep}>Atrás</button>
          ) : <div></div>}
          
          {step < 4 ? (
            <button className="btn btn-primary" onClick={nextStep} disabled={step === 1 && !profile.name.trim()}>Siguiente <Icons.ChevronRight /></button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish}>Comenzar <Icons.Check /></button>
          )}
        </div>
      </div>
    </div>
  );
}
