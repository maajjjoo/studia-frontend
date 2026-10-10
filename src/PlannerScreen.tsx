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

  const pendingTasksWithDuration = tasks.filter(t => t.status === 'pending' && (t.estimatedDuration || 0) > 0);
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
      title: `Estudiar: ${p.taskTitle}`,
      description: 'Bloque de estudio generado automáticamente',
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      category: 'study_block' as const,
      taskId: p.taskId
    }));
    
    if (newActivities.length > 0) {
      onSaveBlocks(newActivities);
    }
    
    // Reset view
    setProposals([]);
    setRejectedIds(new Set());
    setHasGenerated(false);
  };

  const activeProposals = proposals.filter((_, i) => !rejectedIds.has(i));
  const missingTime = pendingTasksWithDuration.length > 0 && activeProposals.length === 0 && hasGenerated;

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>Planificador Inteligente</h1>
          <p>Genera bloques de estudio según tus tareas, horario de clases y disponibilidad.</p>
        </div>
      </div>

      <div style={{display: 'flex', gap: '2rem', marginTop: '1rem'}}>
        
        {/* Panel izquierdo: Controles e info */}
        <div style={{flex: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '350px'}}>
          <div className="dash-card">
            <h3 style={{marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <Icons.Settings /> Estado Actual
            </h3>
            <ul style={{paddingLeft: '1.2rem', margin: '0 0 1rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: '1.6'}}>
              <li><strong>{pendingTasksWithDuration.length}</strong> tareas listas para planificar.</li>
              <li>{pendingTasksMissingDuration.length} tareas sin duración estimada (ignoradas).</li>
              <li>Bloques sugeridos de {profile.studyPreferences?.preferredSessionDuration || 25} min.</li>
            </ul>
            <button className="btn btn-primary" style={{width: '100%', justifyContent: 'center'}} onClick={handleGenerate}>
              <Icons.Activity /> {hasGenerated ? 'Regenerar plan' : 'Generar plan semanal'}
            </button>
          </div>

          {missingTime && (
            <div className="dash-card" style={{background: 'var(--prio-high-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)'}}>
              <h4 style={{marginTop: 0, color: 'var(--prio-high-text)'}}>Tiempo insuficiente</h4>
              <p style={{fontSize: '0.85rem', margin: 0, lineHeight: 1.5}}>No se encontraron espacios libres en los próximos 7 días para ubicar todas tus tareas. Considera ampliar tu disponibilidad o dividir las tareas.</p>
            </div>
          )}
        </div>

        {/* Panel derecho: Propuestas */}
        <div style={{flex: '2'}}>
          {!hasGenerated ? (
            <div className="empty-state dash-card" style={{height: '100%', minHeight: '300px'}}>
              <Icons.Calendar />
              <h3>Plan no generado</h3>
              <p>Presiona "Generar plan semanal" para buscar espacios en tu agenda.</p>
            </div>
          ) : activeProposals.length === 0 && !missingTime ? (
            <div className="empty-state dash-card" style={{height: '100%', minHeight: '300px'}}>
              <Icons.Check />
              <h3>¡Todo planificado!</h3>
              <p>No tienes tareas pendientes con duración estimada por asignar.</p>
            </div>
          ) : (
            <div className="dash-card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', marginBottom: '1rem'}}>
                <h3 style={{margin: 0}}>Propuesta de estudio ({activeProposals.length} bloques)</h3>
                <button className="btn btn-primary" onClick={handleSave}>Confirmar y Guardar</button>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                {proposals.map((p, index) => {
                  if (rejectedIds.has(index)) return null;
                  const [, m, d] = p.date.split('-');
                  const fDate = `${d}/${m}`;
                  return (
                    <div key={index} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', 
                      borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem'
                    }}>
                      <div>
                        <h5 style={{margin: '0 0 0.25rem 0'}}>{p.taskTitle}</h5>
                        <p style={{margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <span><Icons.Calendar /> {fDate}</span>
                          <span><Icons.Clock /> {p.startTime} - {p.endTime}</span>
                          <span className="badge" style={{background: 'var(--color-bg-main)'}}>{p.duration} min</span>
                        </p>
                      </div>
                      <button className="btn btn-secondary" style={{color: 'var(--prio-high-text)', padding: '0.4rem'}} onClick={() => handleReject(index)} title="Rechazar bloque">
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
