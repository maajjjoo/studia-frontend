import { useState, useMemo } from "react";
import { EmptyArt } from "../components/EmptyArt";
import { Icons } from "../Icons";
import { Task } from "../types";
import { TaskModal } from "../components/TaskModal";
import { useTranslation } from "../i18n/LanguageContext";

export function TasksScreen({ tasks, onAdd, onUpdate, onDelete, onToggle }: any) {
  const { t, formatDate } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(
    () => tasks.filter((tItem: Task) => (filter === 'all' || tItem.status === filter)).sort((a: Task, b: Task) => b.createdAt - a.createdAt),
    [tasks, filter]
  );

  const getPriorityLabel = (p: string) =>
    p === 'high' ? t('tasks.priorityHigh') : p === 'medium' ? t('tasks.priorityMedium') : t('tasks.priorityLow');

  return (
    <div className="main-content">
      <div className="screen-header">
        <div className="screen-title">
          <span className="screen-icon" aria-hidden="true"><Icons.CheckSquare /></span>
          <h1>{t('tasks.title')}</h1>
          <p>{t('tasks.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingTask(null); setIsModalOpen(true); }}>
          <Icons.Plus /> {t('tasks.newTaskBtn')}
        </button>
      </div>

      <div className="tasks-filters">
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          {t('tasks.filterPending')}
        </button>
        <button className={`filter-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
          {t('tasks.filterCompleted')}
        </button>
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          {t('tasks.filterAll')}
        </button>
      </div>

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <EmptyArt kind="tasks" />
            <h3>{t('tasks.emptyTitle')}</h3>
            <p>{t('tasks.emptySubtitle')}</p>
          </div>
        ) : filteredTasks.map((task: Task) => (
          <div key={task.id} className={`task-item ${task.status === 'completed' ? 'is-completed' : ''}`}>
            <div className={`task-checkbox ${task.status === 'completed' ? 'completed' : ''}`} onClick={() => onToggle(task.id)}>
              <Icons.Check />
            </div>
            <div className="task-content">
              <h3 className="task-title">{task.title}</h3>
              <div className="task-meta">
                <span className={`badge ${task.priority === 'high' ? 'alta' : task.priority === 'medium' ? 'media' : 'baja'}`}>
                  {getPriorityLabel(task.priority)}
                </span>
                {task.dueDate && <span><Icons.Clock /> {formatDate(task.dueDate)}</span>}
              </div>
            </div>
            <div className="task-actions">
              <button className="icon-btn" onClick={() => { setEditingTask(task); setIsModalOpen(true); }}><Icons.Edit /></button>
              <button className="icon-btn danger" onClick={() => window.confirm(t('tasks.confirmDelete')) && onDelete(task.id)}><Icons.Trash /></button>
            </div>
          </div>
        ))}
      </div>
      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(tItem: any) => editingTask ? onUpdate(editingTask.id, tItem) : onAdd(tItem)} editingTask={editingTask} />
    </div>
  );
}
