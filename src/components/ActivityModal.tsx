import React, { useState, useEffect } from "react";
import { Icons } from "../Icons";
import { Activity, ActivityCategory } from "../types";
import { FIELD_LIMITS, validateActivityInput } from "../scheduleValidation";

export interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  editingActivity: Activity | null;
  initialDate?: string;
}

export function ActivityModal({ isOpen, onClose, onSave, editingActivity, initialDate }: ActivityModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("class");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      if (editingActivity) {
        setTitle(editingActivity.title);
        setDescription(editingActivity.description || "");
        setDate(editingActivity.date);
        setStartTime(editingActivity.startTime);
        setEndTime(editingActivity.endTime);
        setCategory(editingActivity.category);
      } else {
        const d = initialDate || new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        setTitle("");
        setDescription("");
        setDate(d);
        setStartTime("08:00");
        setEndTime("09:00");
        setCategory("class");
      }
    }
  }, [isOpen, editingActivity, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateActivityInput({
      title,
      description,
      date,
      startTime,
      endTime,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      category,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingActivity ? "Editar evento" : "Nuevo evento"}</h2>
          <button className="modal-close" onClick={onClose}><Icons.Close /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label className="form-label">
              <span>Título *</span>
              <span className="char-counter">{title.length}/{FIELD_LIMITS.activityTitle}</span>
            </label>
            <input
              type="text"
              className="form-input"
              maxLength={FIELD_LIMITS.activityTitle}
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                if (error) setError("");
              }}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              <span>Descripción</span>
              <span className="char-counter">{description.length}/{FIELD_LIMITS.activityDescription}</span>
            </label>
            <textarea
              className="form-textarea"
              maxLength={FIELD_LIMITS.activityDescription}
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                if (error) setError("");
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value as ActivityCategory)}>
              <option value="class">Clase</option><option value="exam">Examen</option><option value="assignment">Tarea</option><option value="personal">Personal</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Inicio *</label>
              <input
                type="time"
                className="form-input"
                min="00:00"
                max="23:59"
                value={startTime}
                onChange={e => {
                  setStartTime(e.target.value);
                  if (error) setError("");
                }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fin *</label>
              <input
                type="time"
                className="form-input"
                min="00:00"
                max="23:59"
                value={endTime}
                onChange={e => {
                  setEndTime(e.target.value);
                  if (error) setError("");
                }}
                required
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
