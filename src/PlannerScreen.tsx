import { useState } from 'react';
import { Icons } from './Icons';
import { Task, Activity, StudentProfile } from './types';
import { generateStudyPlan, PlannerProposal } from './studyPlanner';
import { useTranslation } from './i18n/LanguageContext';

interface Props {
  profile: StudentProfile;
  tasks: Task[];
  activities: Activity[];
  onSaveBlocks: (blocks: Omit<Activity, 'id' | 'createdAt'>[]) => void;
}

export function PlannerScreen({ profile, tasks, activities, onSaveBlocks }: Props) {
  const { t, formatDate } = useTranslation();
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const defaultSessionDuration = profile.studyPreferences?.preferredSessionDuration || 25;
  const allPendingTasks = tasks.filter(tItem => tItem.status === 'pending');

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} ${t('common.min')}`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} ${t('common.hours')}` : `${h} ${t('common.hours')} ${m} ${t('common.min')}`;
  };

  const pendingTasksWithDuration = allPendingTasks
    .map(tItem => {
      const isDefault = !(typeof tItem.estimatedDuration === 'number' && tItem.estimatedDuration > 0);
      const effectiveEstimated = isDefault ? defaultSessionDuration : tItem.estimatedDuration!;
      const scheduled = activities
        .filter(a => a.category === 'study_block' && a.taskId === tItem.id)
        .reduce((acc, curr) => {
          const [h1, m1] = curr.startTime.split(':').map(Number);
          const [h2, m2] = curr.endTime.split(':').map(Number);
          return acc + ((h2 * 60 + m2) - (h1 * 60 + m1));
        }, 0);
      return {
        ...tItem,
        remainingDuration: Math.max(0, effectiveEstimated - scheduled),
        isDefaultDuration: isDefault,
      };
    })
    .filter(tItem => tItem.remainingDuration > 0);

  const totalPendingMinutes = pendingTasksWithDuration.reduce((acc, tItem) => acc + tItem.remainingDuration, 0);

  const handleGenerate = () => {
    if (isGenerating) return;
    setInfoMessage(null);

    if (allPendingTasks.length === 0) {
      setInfoMessage(t('planner.emptyNoTasks'));
      return;
    }

    if (pendingTasksWithDuration.length === 0) {
      setInfoMessage(t('planner.emptyAllScheduled'));
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
        setInfoMessage(t('planner.unexpectedError'));
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
      title: `${t('planner.studyBlockTitlePrefix')}${p.taskTitle}`,
      description: t('planner.studyBlockDesc'),
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

  const priorityLabels = {
    high: t('tasks.priorityHigh'),
    medium: t('tasks.priorityMedium'),
    low: t('tasks.priorityLow'),
  };
  const priorityColors = {
    high: 'var(--color-destructive)',
    medium: 'var(--color-accent-main)',
    low: 'var(--color-text-muted)'
  };

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
          <div style={{fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent-main)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.5rem'}}>
            {t('planner.superTitle')}
          </div>
          <h1 style={{fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--color-text-main)', letterSpacing: '-0.02em', fontFamily: 'var(--font-family)'}}>
            {t('planner.title')}
          </h1>
          <p style={{margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem'}}>
            {t('planner.description')}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}
        >
          <span style={{width: '16px', height: '16px', display: 'flex'}}><Icons.Spark /></span>
          {isGenerating ? t('planner.generatingBtn') : hasGenerated ? t('planner.regenerateBtn') : t('planner.generateBtn')}
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
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Tareas por organizar (Top Section) */}
      <div className="dash-card" style={{marginBottom: '2rem', padding: '0'}}>
        <div style={{padding: '1.5rem 1.5rem 0.5rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <h3 style={{margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--color-text-main)'}}>{t('planner.tasksToOrganize')}</h3>
            <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>
              {t('planner.tasksSummary', { count: pendingTasksWithDuration.length, duration: formatDuration(totalPendingMinutes) })}
            </p>
          </div>
        </div>

        {pendingTasksWithDuration.length > 0 ? (
          <div style={{display: 'flex', flexDirection: 'column'}}>
            {pendingTasksWithDuration.map((tItem, index) => (
              <div key={tItem.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                padding: '1.5rem', 
                borderBottom: index < pendingTasksWithDuration.length - 1 ? '1px solid var(--color-border)' : 'none'
              }}>
                <div style={{display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 2}}>
                  <div style={{width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[tItem.priority], marginTop: '0.35rem', flexShrink: 0}}></div>
                  <div>
                    <div style={{fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem'}}>{tItem.title}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem'}}>{t('tasks.academicTaskLabel')}</div>
                  </div>
                </div>
                
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem'}}>{t('planner.deliveryLabel')}</div>
                  <div style={{fontSize: '0.85rem', color: 'var(--color-text-main)'}}>{tItem.dueDate ? formatDate(tItem.dueDate) : t('tasks.noDueDate')}</div>
                </div>

                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem'}}>{t('planner.priorityLabel')}</div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-main)'}}>
                    <div style={{width: '6px', height: '6px', borderRadius: '50%', background: priorityColors[tItem.priority]}}></div>
                    {priorityLabels[tItem.priority]}
                  </div>
                </div>

                <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)', fontSize: '0.85rem', justifyContent: 'flex-end'}}>
                  <span style={{width: '16px', height: '16px', display: 'flex', color: 'var(--color-text-muted)'}}><Icons.Clock /></span>
                  <span>{formatDuration(tItem.remainingDuration)}</span>
                  {tItem.isDefaultDuration && (
                    <span style={{fontSize: '0.65rem', color: 'var(--color-accent-main)', background: 'var(--color-bg-base)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-border)', textTransform: 'uppercase'}} title={t('planner.defaultSuggestedTitle')}>
                      {t('planner.defaultSuggestedBadge')}
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
            <h3 style={{marginBottom: '0.5rem'}}>{t('planner.emptyCaughtUpTitle')}</h3>
            <p>{allPendingTasks.length === 0 ? t('planner.emptyNoTasks') : t('planner.emptyAllScheduled')}</p>
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
               <h3 style={{marginBottom: '0.5rem'}}>{t('planner.plannerStandbyTitle')}</h3>
               <p style={{maxWidth: '320px', margin: 0}}>{t('planner.plannerStandbyDesc')}</p>
             </div>
          ) : proposals.length === 0 ? (
             <div className="empty-state dash-card" style={{height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem'}}>
               {pendingTasksWithDuration.length === 0 ? (
                 <>
                   <Icons.CheckSquare />
                   <h3 style={{marginBottom: '0.5rem'}}>{t('planner.allPlanned')}</h3>
                   <p style={{maxWidth: '320px', margin: 0}}>{t('planner.allPlannedDesc')}</p>
                 </>
               ) : (
                 <>
                   <Icons.Clock />
                   <h3 style={{marginBottom: '0.5rem'}}>{t('planner.noAvailableSlots')}</h3>
                   <p style={{maxWidth: '340px', margin: 0}}>{t('planner.noAvailableSlotsDesc')}</p>
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
                        <h3 style={{margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--color-text-main)'}}>{t('planner.proposalsTitle')}</h3>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-main)', background: 'var(--color-bg-base)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)'}}>
                        <span style={{width: '14px', height: '14px', display: 'flex'}}><Icons.Clock /></span>
                        {formatDuration(totalMin)}
                      </div>
                    </div>

                    <div style={{background: 'rgba(var(--color-accent-soft-rgb), 0.08)', border: '1px solid rgba(var(--color-accent-soft-rgb), 0.2)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '2rem'}}>
                      <span style={{color: 'var(--color-accent-soft)', width: '16px', height: '16px', display: 'flex', marginTop: '0.1rem'}}><Icons.Spark /></span>
                      <div>
                        <div style={{fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)', marginBottom: '0.25rem'}}>{t('planner.structuredDayPlan')}</div>
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.5'}}>
                          {t('planner.structuredDayDesc')}
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
                            <div style={{width: '8px', height: '8px', borderRadius: '50%', background: priorityColors[tasks.find(tItem => tItem.id === p.taskId)?.priority || 'medium'], zIndex: 1}}></div>
                            {i < blocks.length - 1 && (
                              <div style={{flex: 1, width: '2px', background: 'var(--color-border)', margin: '0.25rem 0'}}></div>
                            )}
                          </div>

                          <div style={{flex: 1, background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i === blocks.length - 1 ? '0' : '1rem'}}>
                            <div>
                              <div style={{fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-main)', marginBottom: '0.25rem'}}>{p.taskTitle}</div>
                              <div style={{fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>{t('tasks.academicTaskLabel')}</div>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
                              <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>{formatDuration(p.duration)}</div>
                              <button className="btn btn-secondary" style={{padding: '0.4rem', color: 'var(--color-text-muted)'}} onClick={() => handleReject(pIndex)} title={t('planner.rejectBlockTitle')}>
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
                        <div style={{fontSize: '0.85rem', color: 'var(--color-text-muted)'}}>{t('planner.confirmQuestion')}</div>
                        <button className="btn btn-primary" onClick={handleSave}>{t('planner.saveToCalendarBtn')}</button>
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
            <h3 style={{margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: 'var(--color-text-main)'}}>{t('planner.availabilityTitle')}</h3>
            <p style={{margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem'}}>{t('planner.availabilitySubtitle')}</p>
            
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
              <span style={{width: '14px', height: '14px', display: 'flex', color: 'var(--color-accent-main)'}}><Icons.Check /></span>
              {t('planner.basedOnPrefs')}
            </div>

            <h4 style={{fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0 0 1rem 0'}}>{t('planner.suggestedDistribution')}</h4>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.75rem'}}>
              <span style={{color: 'var(--color-text-muted)'}}>{t('planner.studySessions')}</span>
              <span style={{fontWeight: 600, color: 'var(--color-text-main)'}}>{formatDuration(profile.studyPreferences?.preferredSessionDuration || 25)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)'}}>
              <span style={{color: 'var(--color-text-muted)'}}>{t('planner.breaks')}</span>
              <span style={{fontWeight: 600, color: 'var(--color-text-main)'}}>{formatDuration(profile.studyPreferences?.preferredBreakDuration || 5)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'}}>
              <span style={{color: 'var(--color-text-muted)'}}>{t('planner.bufferMargin')}</span>
              <span style={{fontWeight: 600, color: 'var(--color-text-main)'}}>30 {t('common.min')}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
