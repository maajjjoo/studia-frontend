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

export function PlannerScreen({ profile, tasks, activities, onSaveBlocks }: Props) {
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);

  const pendingTasksWithDuration = tasks
    .filter(t => t.status === 'pending' && (t.estimatedDuration || 0) > 0)
    .map(t => {
      const scheduled = activities
        .filter(a => a.category === 'study_block' && a.taskId === t.id)
        .reduce((acc, curr) => {
          const [h1, m1] = curr.startTime.split(':').map(Number);
          const [h2, m2] = curr.endTime.split(':').map(Number);
          return acc + ((h2 * 60 + m2) - (h1 * 60 + m1));
        }, 0);
      return { ...t, remainingDuration: Math.max(0, (t.estimatedDuration || 0) - scheduled) };
    })
    .filter(t => t.remainingDuration > 0);

  const pendingTasksMissingDuration = tasks.filter(t => t.status === 'pending' && (!t.estimatedDuration || t.estimatedDuration === 0));

  const handleGenerate = () => {
    const generated = generateStudyPlan(profile, tasks, activities, new Date(), 7);
    setProposals(generated);
    setRejectedIds(new Set());
    setHasGenerated(true);
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
      description: 'Bloque de estudio generado inteligentemente.',
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
    setRejectedIds(new Set());
    setHasGenerated(false);
  };

  const activeProposals = proposals.filter((_, i) => !rejectedIds.has(i));
  const missingTime = pendingTasksWithDuration.length > 0 && activeProposals.length === 0 && hasGenerated;

  const priorityLabels = { high: 'Alta', medium: 'Media', low: 'Baja' };
  const priorityColors = { high: 'var(--color-destructive)', medium: 'var(--color-accent-main)', low: 'var(--color-text-muted)' };

  return (
    <div className="main-content" style={{paddingBottom: '4rem'}}>
      <div className="screen-header">
        <div>
          <h1>Planificador Inteligente</h1>
          <p>Organiza tu tiempo de estudio considerando tus clases, fechas límite y disponibilidad.</p>
        </div>
      </div>

      <div style={{display: 'flex', gap: '2.5rem', marginTop: '2rem'}}>
        
        {/* Panel izquierdo: Entradas */}
        <div style={{flex: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '350px'}}>
          
          <div className="dash-card">
            <h4 style={{fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <span style={{width: '18px', height: '18px', display: 'flex'}}><Icons.CheckSquare /></span> Tareas a planificar
            </h4>
            
            {pendingTasksWithDuration.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem'}}>
                {pendingTasksWithDuration.map(t => (
                  <div key={t.id} style={{background: 'var(--color-bg-base)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)'}}>
                    <h4 style={{margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--color-text-main)'}}>{t.title}</h4>
                    <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem'}}>
                      <span style={{color: priorityColors[t.priority], fontWeight: 600}}>
                        Prioridad {priorityLabels[t.priority]}
                      </span>
                      {t.dueDate && (
                        <span style={{color: 'var(--color-text-muted)'}}>• Vence: {t.dueDate}</span>
                      )}
                      <span style={{color: 'var(--color-text-muted)'}}>• Quedan {t.remainingDuration} min</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{padding: '1.5rem 1rem'}}>
                <Icons.Check />
                <p>No tienes tareas pendientes con duración estimada.</p>
              </div>
            )}
          </div>

          {pendingTasksMissingDuration.length > 0 && (
            <div style={{background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start'}}>
              <div style={{color: 'var(--color-text-muted)', paddingTop: '0.1rem', width: '16px', height: '16px', display: 'flex'}}><Icons.Activity /></div>
              <div>
                <h4 style={{margin: '0 0 0.25rem 0', fontSize: '0.9rem'}}>Tareas omitidas</h4>
                <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.5'}}>
                  Hay {pendingTasksMissingDuration.length} tarea(s) sin duración estimada. Edítalas en la pestaña de Tareas para incluirlas en el plan.
                </p>
              </div>
            </div>
          )}

          <div className="dash-card" style={{background: 'var(--color-surface)', border: 'none', boxShadow: 'none'}}>
            <button className="btn btn-primary" style={{width: '100%', justifyContent: 'center'}} onClick={handleGenerate} disabled={pendingTasksWithDuration.length === 0}>
              <Icons.Spark /> {hasGenerated ? 'Regenerar Propuesta' : 'Generar Propuesta'}
            </button>
            <p style={{textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.75rem 0 0 0'}}>
              Basado en bloques de {profile.studyPreferences?.preferredSessionDuration || 25} minutos.
            </p>
          </div>
        </div>

        {/* Panel derecho: Propuesta */}
        <div style={{flex: '1.5', display: 'flex', flexDirection: 'column'}}>
          {!hasGenerated ? (
            <div className="empty-state dash-card" style={{height: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <Icons.Calendar />
              <h3 style={{marginBottom: '0.5rem'}}>Planificador en pausa</h3>
              <p style={{maxWidth: '300px', margin: 0}}>Haz clic en "Generar Propuesta" para encontrar los mejores espacios de estudio en tu agenda.</p>
            </div>
          ) : activeProposals.length === 0 && !missingTime ? (
            <div className="empty-state dash-card" style={{height: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
              <Icons.CheckSquare />
              <h3 style={{marginBottom: '0.5rem'}}>¡Todo planificado!</h3>
              <p style={{maxWidth: '300px', margin: 0}}>Tus tareas pendientes ya están cubiertas o no tienes tareas por planificar.</p>
            </div>
          ) : (
            <div className="dash-card" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1.5rem'}}>
                <div>
                  <h4 style={{margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-main)'}}>Propuesta de estudio</h4>
                  <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>Revisa los {activeProposals.length} bloques sugeridos antes de confirmar.</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={activeProposals.length === 0}>
                  Guardar en Calendario
                </button>
              </div>

              {missingTime && (
                <div style={{background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.5rem'}}>
                  <div style={{color: '#EF4444', paddingTop: '0.1rem', width: '16px', height: '16px', display: 'flex'}}><Icons.Bell /></div>
                  <div>
                    <h4 style={{margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#B91C1C'}}>Tiempo insuficiente</h4>
                    <p style={{margin: 0, fontSize: '0.85rem', color: '#991B1B', lineHeight: '1.5'}}>
                      No se encontraron espacios libres suficientes en los próximos 7 días para ubicar todas tus tareas. Considera ampliar tu disponibilidad en los Ajustes.
                    </p>
                  </div>
                </div>
              )}

              <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', paddingRight: '0.5rem'}}>
                {proposals.map((p, index) => {
                  if (rejectedIds.has(index)) return null;
                  
                  const task = tasks.find(t => t.id === p.taskId);
                  
                  return (
                    <div key={index} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                      background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderLeft: '4px solid var(--color-accent-main)',
                      borderRadius: 'var(--radius-sm)', padding: '1rem'
                    }}>
                      <div style={{minWidth: '80px'}}>
                        <div style={{fontWeight: 600, color: 'var(--color-text-main)'}}>{p.date.substring(5).replace('-', '/')}</div>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>{p.startTime} - {p.endTime}</div>
                      </div>
                      
                      <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', borderLeft: '1px solid var(--color-border)', paddingLeft: '1rem'}}>
                        <span style={{fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem'}}>{p.taskTitle}</span>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>
                          <span style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}><span style={{width: '14px', height: '14px', display: 'flex'}}><Icons.Clock /></span> {p.duration} min</span>
                          {task && <span style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>• <span style={{width: '14px', height: '14px', display: 'flex'}}><Icons.Activity /></span> Prioridad {priorityLabels[task.priority]}</span>}
                        </div>
                      </div>
                      
                      <button className="btn btn-secondary" style={{padding: '0.5rem', color: 'var(--color-text-muted)'}} onClick={() => handleReject(index)} title="Rechazar bloque sugerido">
                        <Icons.Close />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
