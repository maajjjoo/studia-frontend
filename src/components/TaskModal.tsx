import React, { useState, useEffect } from "react";
import { Icons } from "../Icons";
import { Task, Priority } from "../types";
import { DURATION_LIMITS, FIELD_LIMITS, validateTaskInput } from "../scheduleValidation";

export interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  editingTask: Task | null;
}

export function TaskModal({ isOpen, onClose, onSave, editingTask }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(editingTask.description || "");
        setPriority(editingTask.priority);
        setDueDate(editingTask.dueDate || "");
        setEstimatedDuration(editingTask.estimatedDuration ? String(editingTask.estimatedDuration) : "");
      } else {
        setTitle("");
        setDescription("");
        setPriority("medium");
        setDueDate("");
        setEstimatedDuration("");
      }
    }
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validateTaskInput({
      title,
      description,
      estimatedDuration,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedDuration = estimatedDuration.trim();
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      estimatedDuration: trimmedDuration ? parseInt(trimmedDuration, 10) : undefined,
      status: editingTask ? editingTask.status : 'pending'
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingTask ? "Editar tarea" : "Nueva tarea"}</h2>
          <button className="modal-close" onClick={onClose}><Icons.Close /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label className="form-label">
              <span>Título *</span>
              <span className="char-counter">{title.length}/{FIELD_LIMITS.taskTitle}</span>
            </label>
            <input
              type="text"
              className="form-input"
              maxLength={FIELD_LIMITS.taskTitle}
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
              <span className="char-counter">{description.length}/{FIELD_LIMITS.taskDescription}</span>
            </label>
            <textarea
              className="form-textarea"
              maxLength={FIELD_LIMITS.taskDescription}
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                if (error) setError("");
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de entrega</label>
              <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              <span>Duración estimada (minutos)</span>
              <span className="char-counter">{DURATION_LIMITS.taskMinMinutes}–{DURATION_LIMITS.taskMaxMinutes} min</span>
            </label>
            <input
              type="number"
              className="form-input"
              value={estimatedDuration}
              onChange={e => {
                setEstimatedDuration(e.target.value);
                if (error) setError("");
              }}
              min={DURATION_LIMITS.taskMinMinutes}
              max={DURATION_LIMITS.taskMaxMinutes}
              step="5"
              placeholder="Ej. 60"
            />
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
