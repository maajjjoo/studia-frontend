import { useState } from 'react';
import { StudentProfile } from './types';
import { Icons } from './Icons';
import { FIELD_LIMITS, validateProfileInput, validateSubjectName } from './scheduleValidation';
import { useTranslation } from './i18n/LanguageContext';

interface Props {
  onComplete: (profile: StudentProfile) => void;
}

export function OnboardingScreen({ onComplete }: Props) {
  const { t, language } = useTranslation();
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
  const [error, setError] = useState('');

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!profile.name.trim()) {
        setError(t('onboarding.nameRequired'));
        return;
      }
      if (profile.name.trim().length > FIELD_LIMITS.userName) {
        setError(t('onboarding.nameTooLong', { max: FIELD_LIMITS.userName }));
        return;
      }
    }
    setStep(s => Math.min(s + 1, 4));
  };

  const prevStep = () => {
    setError('');
    setStep(s => Math.max(s - 1, 1));
  };

  const addSubject = () => {
    const subjErr = validateSubjectName(currentSubject, profile.subjects, language);
    if (subjErr) {
      setError(subjErr);
      return;
    }
    const trimmed = currentSubject.trim();
    setProfile({ ...profile, subjects: [...profile.subjects, trimmed] });
    setCurrentSubject('');
    setError('');
  };

  const removeSubject = (subj: string) => {
    setProfile({ ...profile, subjects: profile.subjects.filter(s => s !== subj) });
  };

  const handleFinish = () => {
    const validationErr = validateProfileInput(profile, language);
    if (validationErr) {
      setError(validationErr);
      setStep(1);
      return;
    }
    onComplete({
      ...profile,
      name: profile.name.trim(),
      program: profile.program.trim(),
      semester: profile.semester.trim(),
    });
  };

  return (
    <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg-base)' }}>
      <div className="dash-card" style={{ width: '100%', maxWidth: '600px', padding: '3rem', borderRadius: 'var(--radius-xl)' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-main)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Icons.Logo />
          </div>
          <h1 style={{ margin: '0 0 0.5rem 0' }}>{t('onboarding.setupTitle')}</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{t('onboarding.stepCounter', { step })}</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: '40px', height: '6px', borderRadius: '3px', background: i <= step ? 'var(--color-accent-main)' : 'var(--color-border)' }} />
            ))}
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {step === 1 && (
          <div className="onboarding-step" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2>{t('onboarding.step1Title')}</h2>
            <div className="form-group">
              <label className="form-label">
                <span>{t('onboarding.nameLabel')}</span>
                <span className="char-counter">{profile.name.length}/{FIELD_LIMITS.userName}</span>
              </label>
              <input
                type="text"
                className="form-input"
                maxLength={FIELD_LIMITS.userName}
                value={profile.name}
                onChange={e => {
                  setProfile({ ...profile, name: e.target.value });
                  if (error) setError('');
                }}
                placeholder={t('onboarding.namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <span>{t('onboarding.programLabel')}</span>
                <span className="char-counter">{profile.program.length}/{FIELD_LIMITS.programName}</span>
              </label>
              <input
                type="text"
                className="form-input"
                maxLength={FIELD_LIMITS.programName}
                value={profile.program}
                onChange={e => setProfile({ ...profile, program: e.target.value })}
                placeholder={t('onboarding.programPlaceholder')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <span>{t('onboarding.semesterLabel')}</span>
                <span className="char-counter">{profile.semester.length}/{FIELD_LIMITS.semesterName}</span>
              </label>
              <input
                type="text"
                className="form-input"
                maxLength={FIELD_LIMITS.semesterName}
                value={profile.semester}
                onChange={e => setProfile({ ...profile, semester: e.target.value })}
                placeholder={t('onboarding.semesterPlaceholder')}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2>{t('onboarding.step2Title')}</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>{t('onboarding.step2Desc')}</p>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                maxLength={FIELD_LIMITS.subjectName}
                value={currentSubject}
                onChange={e => {
                  setCurrentSubject(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={e => e.key === 'Enter' && addSubject()}
                placeholder={t('onboarding.subjectPlaceholder')}
                autoFocus
              />
              <button className="btn btn-primary" onClick={addSubject}>{t('onboarding.addBtn')}</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {profile.subjects.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{t('onboarding.noSubjectsAdded')}</p>
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
          <div className="onboarding-step" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2>{t('onboarding.step3Title')}</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>{t('onboarding.step3Desc')}</p>
            <div className="form-group">
              <label className="form-label">{t('onboarding.sessionDurationLabel')}</label>
              <select className="form-select" value={profile.studyPreferences.preferredSessionDuration} onChange={e => setProfile({ ...profile, studyPreferences: { ...profile.studyPreferences, preferredSessionDuration: parseInt(e.target.value, 10) } })}>
                <option value={15}>{t('onboarding.opt15')}</option>
                <option value={25}>{t('onboarding.opt25')}</option>
                <option value={45}>{t('onboarding.opt45')}</option>
                <option value={50}>{t('onboarding.opt50')}</option>
                <option value={60}>{t('onboarding.opt60')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('onboarding.breakDurationLabel')}</label>
              <select className="form-select" value={profile.studyPreferences.preferredBreakDuration} onChange={e => setProfile({ ...profile, studyPreferences: { ...profile.studyPreferences, preferredBreakDuration: parseInt(e.target.value, 10) } })}>
                <option value={5}>{t('onboarding.opt5')}</option>
                <option value={10}>{t('onboarding.opt10')}</option>
                <option value={15}>{t('onboarding.opt15')}</option>
              </select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-step" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2>{t('onboarding.step4Title')}</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>{t('onboarding.step4Desc')}</p>
            <div style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginTop: '1rem' }}>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--color-text-main)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li><strong>{t('onboarding.summaryStudent')}</strong> {profile.name || t('onboarding.unspecified')}</li>
                <li><strong>{t('onboarding.summarySubjects')}</strong> {t('onboarding.registeredCount', { count: profile.subjects.length })}</li>
                <li><strong>{t('onboarding.summaryFocus')}</strong> {t('onboarding.summaryFocusDetail', { study: profile.studyPreferences.preferredSessionDuration, break: profile.studyPreferences.preferredBreakDuration })}</li>
              </ul>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={prevStep}>{t('common.back')}</button>
          ) : <div></div>}

          {step < 4 ? (
            <button className="btn btn-primary" onClick={nextStep} disabled={step === 1 && !profile.name.trim()}>{t('common.next')} <Icons.ChevronRight /></button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish}>{t('onboarding.finishBtn')} <Icons.Check /></button>
          )}
        </div>
      </div>
    </div>
  );
}
