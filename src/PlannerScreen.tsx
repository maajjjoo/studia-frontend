import { useState } from 'react';
import { Icons } from './Icons';
import { Task, Activity, StudentProfile } from './types';
import { generateStudyPlan, PlannerProposal } from './studyPlanner';

interface Props {
  profile: StudentProfile;
  tasks: Task[];
  activities: Activity[];
  onSaveBlocks: (blocks: Omit<Activity, 'id' | 'createdAt'>[]) => void;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  let str = d.toLocaleDateString('es-ES', options);
  return str.charAt(0).toUpperCase() + str.slice(1); // Capitalize first letter
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function PlannerScreen({ profile, tasks, activities, onSaveBlocks }: Props) {
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const defaultSessionDuration = profile.studyPreferences?.preferredSessionDuration || 25;
  const allPendingTasks = tasks.filter(t => t.status === 'pending');

  const pendingTasksWithDuration = allPendingTasks
    .map(t => {
      const isDefault = !(typeof t.estimatedDuration === 'number' && t.estimatedDuration > 0);
      const effectiveEstimated = isDefault ? defaultSessionDuration : t.estimatedDuration!;
      const scheduled = activities
        .filter(a => a.category === 'study_block' && a.taskId === t.id)
        .reduce((acc, curr) => {
          const [h1, m1] = curr.startTime.split(':').map(Number);
          const [h2, m2] = curr.endTime.split(':').map(Number);
          return acc + ((h2 * 60 + m2) - (h1 * 60 + m1));
        }, 0);
      return {
        ...t,
        remainingDuration: Math.max(0, effectiveEstimated - scheduled),
        isDefaultDuration: isDefault,
      };
    })
    .filter(t => t.remainingDuration > 0);

  const totalPendingMinutes = pendingTasksWithDuration.reduce((acc, t) => acc + t.remainingDuration, 0);

  const handleGenerate = () => {
    if (isGenerating) return;
    setInfoMessage(null);

    if (allPendingTasks.length === 0) {
      setInfoMessage('No tienes tareas pendientes para organizar. Agrega al menos una tarea en la sección Tareas antes de generar el plan.');
      return;
    }

    if (pendingTasksWithDuration.length === 0) {
      setInfoMessage('Todas tus tareas pendientes ya tienen bloques de estudio asignados en el calendario.');
      return;
    }

    setIsGenerating(true);
    setTimeout(() => {
      try {
        const generated = generateStudyPlan(profile, tasks, activities, new Date(), 7);
        setProposals(generated);
        setRejectedIds(new Set());
        setHasGenerated(true);
      } catch (err: unknown) {
        console.error('Error al generar el planificador:', err);
        setInfoMessage('Ocurrió un error inesperado al calcular la propuesta de estudio. Revisa los datos de tu perfil.');
      } finally {
        setIsGenerating(false);
      }
    }, 120);
  };

  const handleReject = (index: number) => {
    const newRej = new Set(rejectedIds);
    newRej.add(index);
    setRejectedIds(newRej);
  };

  const handleSave = () => {
    const accepted = proposals.filter((_, i) => !rejectedIds.has(i));
    const newActivities = accepted.map(p => ({
      title: `Estudio: ${p.taskTitle}`,
      description: 'Bloque de estudio inteligente',
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      category: 'study_block' as const,
      taskId: p.taskId
    }));
    
    if (newActivities.length > 0) {
      onSaveBlocks(newActivities);
    }
    
    setProposals([]);
    setHasGenerated(false);
  };

  const priorityLabels = { high: 'Alta', medium: 'Media', low: 'Baja' };
  const priorityColors = { high: 'var(--color-destructive)', medium: 'var(--color-accent-main)', low: 'var(--color-text-muted)' };

  const proposalsByDate = proposals.reduce((acc: Record<string, {p: PlannerProposal, index: number}[]>, p, index) => { 
    if (!rejectedIds.has(index)) {
      acc[p.date] = acc[p.date] || []; 
      acc[p.date].push({p, index}); 
    }
    return acc; 
  }, {});

  return (
    <div className="main-content" style={{paddingBottom: '4rem'}}>
      
      {/* Header */}
      <div className="screen-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem'}}>
        <div>
          <div style={{fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent-soft)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem'}}>
            Organiza tu semana
          </div>
          <h1 style={{fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--color-text-main)', letterSpacing: '-0.02em', fontFamily: 'var(--font-family)'}}>
            Planificador inteligente
          </h1>
          <p style={{margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem'}}>
            Organiza tus sesiones de estudio según tus tareas académicas y el tiempo que tienes disponible.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}
        >
          <span style={{width: '16px', height: '16px', display: 'flex'}}><Icons.Spark /></span>
          {isGenerating ? 'Generando planificador...' : hasGenerated ? 'Regenerar planificador' : 'Generar planificador'}
        </button>
      </div>

      {infoMessage && (
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'var(--color-bg-base)',
          border: '1px solid var(--color-accent-soft)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text-main)',
          fontSize: '0.9rem',
        }}>
          <span>{infoMessage}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{padding: '0.25rem 0.6rem', fontSize: '0.75rem', marginLeft: '1rem'}}
            onClick={() => setInfoMessage(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Tareas por organizar (Top Section) */}
      <div className="dash-card" style={{marginBottom: '2rem', padding: '0'}}>
        <div style={{padding: '1.5rem 1.5rem 0.5rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <h3 style={{margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--color-text-main)'}}>Tareas por organizar</h3>
            <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>
              {pendingTasksWithDuration.length} tareas pendientes • {formatDuration(totalPendingMinutes)}
            </p>
          </div>
        </div>

        {pendingTasksWithDuration.length > 0 ? (
          <div style={{display: 'flex', flexDirection: 'column'}}>
            {pendingTasksWithDuration.map((t, index) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '1.5rem', 
                borderBottom: index < pendingTasksWithDuration.length - 1 ? '1px solid var(--color-border)' : 'none'
              }}>
                <div style={{display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 2}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[t.priority], marginTop: '0.35rem', flexShrink: 0}}></div>
                  <div>
                    <div style={{fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem'}}>{t.title}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem'}}>Tarea académica</div>
                  </div>
                </div>
                
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem'}}>Entrega</div>
                  <div style={{fontSize: '0.85rem', color: 'var(--color-text-main)'}}>{t.dueDate || 'Sin fecha'}</div>
                </div>

                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem'}}>Prioridad</div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-main)'}}>
                    <div style={{width: '6px', height: '6px', borderRadius: '50%', background: priorityColors[t.priority]}}></div>
                    {priorityLabels[t.priority]}
                  </div>
                </div>

                <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)', fontSize: '0.85rem', justifyContent: 'flex-end'}}>
                  <span style={{width: '16px', height: '16px', display: 'flex', color: 'var(--color-text-muted)'}}><Icons.Clock /></span>
                  <span>{formatDuration(t.remainingDuration)}</span>
                  {t.isDefaultDuration && (
                    <span style={{fontSize: '0.65rem', color: 'var(--color-accent-soft)', background: 'var(--color-bg-base)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-border)', textTransform: 'uppercase'}} title="Duración asignada según la sesión configurada en tus preferencias">
                      Sugerida
                    </span>
                  )}
                </div>
                
                <div style={{marginLeft: '1rem', color: 'var(--color-text-muted)'}}>
                  <span style={{width: '18px', height: '18px', display: 'flex'}}><Icons.ChevronRight /></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{padding: '3rem 1rem'}}>
            <Icons.CheckSquare />
            <h3 style={{marginBottom: '0.5rem'}}>Estás al día</h3>
            <p>{allPendingTasks.length === 0 ? 'No tienes tareas pendientes para organizar. Agrega tareas desde la sección Tareas.' : 'Todas tus tareas pendientes ya tienen bloques de estudio asignados en el calendario.'}</p>
          </div>
        )}
      </div>

      {/* Bottom Layout (Two Columns) */}
      <div style={{display: 'flex', gap: '2rem'}}>
        
        {/* Left Column: Propuesta de estudio */}
        <div style={{flex: 2, display: 'flex', flexDirection: 'column'}}>
          {!hasGenerated ? (
             <div className="empty-state dash-card" style={{height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
               <Icons.Calendar />
               <h3 style={{marginBottom: '0.5rem'}}>Planificador en espera</h3>
               <p style={{maxWidth: '320px', margin: 0}}>Haz clic en "Generar planificador" en la parte superior para crear una propuesta de estudio semanal.</p>
             </div>
          ) : proposals.length === 0 ? (
             <div className="empty-state dash-card" style={{height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem'}}>
               {pendingTasksWithDuration.length === 0 ? (
                 <>
                   <Icons.CheckSquare />
                   <h3 style={{marginBottom: '0.5rem'}}>¡Todo planificado!</h3>
                   <p style={{maxWidth: '320px', margin: 0}}>Tus tareas pendientes ya están cubiertas en el calendario.</p>
                 </>
               ) : (
                 <>
                   <Icons.Clock />
                   <h3 style={{marginBottom: '0.5rem'}}>Sin espacios disponibles</h3>
                   <p style={{maxWidth: '340px', margin: 0}}>No se encontraron suficientes espacios libres en tu horario para ubicar las tareas pendientes. Revisa tu disponibilidad en Ajustes o los horarios de tus clases.</p>
                 </>
               )}
             </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '2rem'}}>
              {Object.entries(proposalsByDate).map(([date, blocks], dateIndex) => {
                const totalMin = blocks.reduce((acc, b) => acc + b.p.duration, 0);
                return (
                  <div key={date} className="dash-card">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                      <div>
                        <h3 style={{margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--color-text-main)'}}>Propuesta de estudio</h3>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Hoy, {formatDate(date)}</div>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-main)', background: 'var(--color-bg-base)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)'}}>
                        <span style={{width: '14px', height: '14px', display: 'flex'}}><Icons.Clock /></span>
                        {formatDuration(totalMin)}
                      </div>
                    </div>

                    <div style={{background: 'rgba(var(--color-accent-soft-rgb), 0.08)', border: '1px solid rgba(var(--color-accent-soft-rgb), 0.2)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '2rem'}}>
                      <span style={{color: 'var(--color-accent-soft)', width: '16px', height: '16px', display: 'flex', marginTop: '0.1rem'}}><Icons.Spark /></span>
                      <div>
                        <div style={{fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)', marginBottom: '0.25rem'}}>Plan estructurado para este día</div>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.5'}}>
                          Plan generado localmente según tus prioridades, fechas de entrega y el tiempo disponible configurado.
                        </div>
                      </div>
                    </div>

                    <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                      {blocks.map(({p, index: pIndex}, i) => (
                        <div key={pIndex} style={{display: 'flex', gap: '1.5rem'}}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '45px', flexShrink: 0}}>
                            <div style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)'}}>{p.startTime}</div>
                            <div style={{fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem'}}>{p.endTime}</div>
                          </div>
                          
                          {/* Timeline dot and line */}
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.25rem'}}>
                            <div style={{width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[tasks.find(t => t.id === p.taskId)?.priority || 'medium'], zIndex: 1}}></div>
                            {i < blocks.length - 1 && (
                              <div style={{flex: 1, width: '2px', background: 'var(--color-border)', margin: '0.25rem 0'}}></div>
                            )}
                          </div>

                          <div style={{flex: 1, background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i === blocks.length - 1 ? '0' : '1rem'}}>
                            <div>
                              <div style={{fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-main)', marginBottom: '0.25rem'}}>{p.taskTitle}</div>
                              <div style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>Tarea académica</div>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
                              <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>{formatDuration(p.duration)}</div>
                              <button className="btn btn-secondary" style={{padding: '0.4rem', color: 'var(--color-text-muted)'}} onClick={() => handleReject(pIndex)} title="Rechazar bloque">
                                <span style={{width: '16px', height: '16px', display: 'flex'}}><Icons.Close /></span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Botón de confirmar al final del último día */}
                    {dateIndex === Object.keys(proposalsByDate).length - 1 && (
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', marginTop: '2rem'}}>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>¿Deseas confirmar este horario?</div>
                        <button className="btn btn-primary" onClick={handleSave}>Guardar en calendario</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Tu disponibilidad */}
        <div style={{flex: 1}}>
          <div className="dash-card">
            <h3 style={{margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--color-text-main)'}}>Tu disponibilidad</h3>
            <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem'}}>Configuración actual para estudiar</p>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem'}}>
               <div style={{border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', fontSize: '0.9rem', fontWeight: 600, background: 'var(--color-bg-base)'}}>
                 {profile.studyAvailability[0]?.startTime || '14:00'}
               </div>
               <div style={{flex: 1, height: '1px', background: 'var(--color-border)'}}></div>
               <div style={{border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', fontSize: '0.9rem', fontWeight: 600, background: 'var(--color-bg-base)'}}>
                 {profile.studyAvailability[0]?.endTime || '21:00'}
               </div>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '2rem'}}>
              <span style={{width: '14px', height: '14px', display: 'flex', color: 'var(--color-accent-soft)'}}><Icons.Check /></span>
              Basado en tus preferencias de horario.
            </div>

            <h4 style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>Distribución sugerida</h4>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.75rem'}}>
              <span style={{color: 'var(--color-text-muted)'}}>Sesiones de estudio</span>
              <span style={{fontWeight: 600, color: 'var(--color-text-main)'}}>{formatDuration(profile.studyPreferences?.preferredSessionDuration || 25)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)'}}>
              <span style={{color: 'var(--color-text-muted)'}}>Descansos</span>
              <span style={{fontWeight: 600, color: 'var(--color-text-main)'}}>{formatDuration(profile.studyPreferences?.preferredBreakDuration || 5)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'}}>
              <span style={{color: 'var(--color-text-muted)'}}>Margen libre recomendado</span>
              <span style={{fontWeight: 600, color: 'var(--color-text-main)'}}>30 min</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
