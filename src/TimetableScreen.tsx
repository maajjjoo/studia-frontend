import React, { useState } from 'react';
import { Icons } from './Icons';
import { StudentProfile, ClassSession } from './types';
import {
  FIELD_LIMITS,
  validateClassSessionInput,
  validateSubjectName,
} from './scheduleValidation';
import { useTranslation } from './i18n/LanguageContext';

interface Props {
  profile: StudentProfile;
  onAddClass: (session: Omit<ClassSession, 'id'>) => void;
  onUpdateClass: (id: string, session: Omit<ClassSession, 'id'>) => void;
  onDeleteClass: (id: string) => void;
  onUpdateProfile: (profile: StudentProfile) => void;
}

export function TimetableScreen({ profile, onAddClass, onUpdateClass, onDeleteClass, onUpdateProfile }: Props) {
  const { t, language, formatDay } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [quickSubject, setQuickSubject] = useState('');
  const [quickSubjectError, setQuickSubjectError] = useState('');

  const openNew = () => {
    setEditingSession(null);
    setIsModalOpen(true);
  };

  const openEdit = (session: ClassSession) => {
    setEditingSession(session);
    setIsModalOpen(true);
  };

  const handleQuickAddSubject = () => {
    const validationErr = validateSubjectName(quickSubject, profile.subjects, language);
    if (validationErr) {
      setQuickSubjectError(validationErr);
      return;
    }
    const trimmed = quickSubject.trim();
    onUpdateProfile({ ...profile, subjects: [...profile.subjects, trimmed] });
    setQuickSubject('');
    setQuickSubjectError('');
  };

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>{t('timetable.title')}</h1>
          <p>{t('timetable.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} disabled={profile.subjects.length === 0}>
          <Icons.Plus /> {t('timetable.addClassBtn')}
        </button>
      </div>

      {profile.subjects.length === 0 && profile.classTimetable.length === 0 ? (
        <div className="empty-state dash-card" style={{ marginTop: '2rem' }}>
          <Icons.Calendar />
          <h3>{t('timetable.noSubjectsRegistered')}</h3>
          <p>{t('timetable.noSubjectsDesc')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '420px', margin: '2rem auto 0' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="new-subject-input"
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                value={quickSubject}
                maxLength={FIELD_LIMITS.subjectName}
                placeholder={t('settings.addSubjectPlaceholder')}
                onChange={e => {
                  setQuickSubject(e.target.value);
                  if (quickSubjectError) setQuickSubjectError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddSubject();
                  }
                }}
              />
              <button className="btn btn-primary" onClick={handleQuickAddSubject}>
                {t('settings.addSubjectBtn')}
              </button>
            </div>
            {quickSubjectError && (
              <div className="error-msg" style={{ margin: 0, textAlign: 'left' }}>
                {quickSubjectError}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="timetable-grid">
          {[1, 2, 3, 4, 5, 6, 7].map(dayNum => {
            const dayName = formatDay(dayNum, { weekday: 'long' });
            const dayClasses = profile.classTimetable
              .filter(c => c.dayOfWeek === dayNum)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            return (
              <div key={dayNum} className="dash-card timetable-day-card">
                <h3 className="timetable-day-header">
                  {dayName}
                  <span className="badge" style={{ background: 'var(--color-bg-base)' }}>{dayClasses.length}</span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {dayClasses.length === 0 ? (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' }}>{t('timetable.emptyDay')}</p>
                  ) : dayClasses.map(c => (
                    <div
                      key={c.id}
                      className="timetable-class-card"
                      onClick={() => openEdit(c)}
                    >
                      <h4 className="timetable-class-title">{c.subject}</h4>
                      <p className="timetable-class-time">
                        <Icons.Clock />
                        <span>{c.startTime} - {c.endTime}</span>
                      </p>
                      {(c.room || c.teacher || c.description) && (
                        <div className="timetable-class-meta">
                          {c.room && <span>📍 {c.room}</span>}
                          {c.teacher && <span>👤 {c.teacher}</span>}
                          {c.description && <span>📝 {c.description}</span>}
                        </div>
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
  const { t, language, formatDay } = useTranslation();
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
      setFormData({
        subject: editingSession.subject,
        description: editingSession.description || '',
        dayOfWeek: editingSession.dayOfWeek,
        startTime: editingSession.startTime,
        endTime: editingSession.endTime,
        room: editingSession.room || '',
        teacher: editingSession.teacher || '',
      });
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

    const sanitizedData: Omit<ClassSession, 'id'> = {
      subject: (formData.subject || '').trim(),
      dayOfWeek: Number(formData.dayOfWeek),
      startTime: (formData.startTime || '').trim(),
      endTime: (formData.endTime || '').trim(),
      room: (formData.room || '').trim() || undefined,
      teacher: (formData.teacher || '').trim() || undefined,
      description: (formData.description || '').trim() || undefined,
    };

    const validationError = validateClassSessionInput(
      sanitizedData,
      profile.classTimetable || [],
      editingSession?.id,
      language
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    onSave(sanitizedData);
  };

  const descLength = (formData.description || '').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content timetable-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingSession ? t('timetable.modalEditTitle') : t('timetable.modalNewTitle')}</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icons.Close />
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="timetable-modal-form" noValidate>
          <div className="form-group">
            <label className="form-label">{t('timetable.fieldSubject')} *</label>
            <select
              className="form-select"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              required
            >
              {profile.subjects.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="timetable-schedule-box">
            <div className="timetable-schedule-box-header">
              <Icons.Clock />
              <span>{t('timetable.sessionScheduleBox')}</span>
            </div>
            <div className="timetable-time-grid">
              <div className="form-group">
                <label className="form-label">{t('timetable.dayLabel')} *</label>
                <select
                  className="form-select"
                  value={formData.dayOfWeek}
                  onChange={e => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value, 10) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(dayNum => (
                    <option key={dayNum} value={dayNum}>{formatDay(dayNum, { weekday: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('timetable.startLabel')} *</label>
                <input
                  type="time"
                  className="form-input"
                  min="00:00"
                  max="23:59"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('timetable.endLabel')} *</label>
                <input
                  type="time"
                  className="form-input"
                  min="00:00"
                  max="23:59"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="timetable-details-grid">
            <div className="form-group">
              <label className="form-label">
                <span>{t('timetable.roomLabel')}</span>
                <span className="char-counter">{(formData.room || '').length}/{FIELD_LIMITS.classRoom}</span>
              </label>
              <input
                type="text"
                className="form-input"
                maxLength={FIELD_LIMITS.classRoom}
                value={formData.room || ''}
                onChange={e => setFormData({ ...formData, room: e.target.value })}
                placeholder={t('timetable.roomPlaceholder')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>{t('timetable.teacherLabel')}</span>
                <span className="char-counter">{(formData.teacher || '').length}/{FIELD_LIMITS.classTeacher}</span>
              </label>
              <input
                type="text"
                className="form-input"
                maxLength={FIELD_LIMITS.classTeacher}
                value={formData.teacher || ''}
                onChange={e => setFormData({ ...formData, teacher: e.target.value })}
                placeholder={t('timetable.teacherPlaceholder')}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>{t('timetable.descLabel')}</span>
              <span className="char-counter">{descLength}/{FIELD_LIMITS.classDescription}</span>
            </label>
            <input
              type="text"
              className="form-input"
              maxLength={FIELD_LIMITS.classDescription}
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('timetable.descPlaceholder')}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            {editingSession ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: 'var(--prio-high-text)' }}
                onClick={() => onDelete(editingSession.id)}
              >
                {t('common.delete')}
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary">{t('common.save')}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
