import { useState, useMemo } from "react";
import { Icons } from "../Icons";
import { Task } from "../types";
import { TaskModal } from "../components/TaskModal";

export function TasksScreen({ tasks, onAdd, onUpdate, onDelete, onToggle }: any) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(
    () => tasks.filter((t: Task) => (filter === 'all' || t.status === filter)).sort((a: Task, b: Task) => b.createdAt - a.createdAt),
    [tasks, filter]
  );

  return (
    <div className="main-content">
      <div className="screen-header">
        <div>
          <h1>Tus tareas</h1>
          <p>Administra y organiza todo lo que necesitas hacer.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingTask(null); setIsModalOpen(true); }}><Icons.Plus /> Nueva tarea</button>
      </div>

      <div className="tasks-filters">
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pendientes</button>
        <button className={`filter-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completadas</button>
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas</button>
      </div>

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <Icons.CheckSquare />
            <h3>No hay tareas aquí</h3>
            <p>Estás al día. ¡Disfruta tu tiempo libre!</p>
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
                  {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                </span>
                {task.dueDate && <span><Icons.Clock /> {new Date(task.dueDate).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</span>}
              </div>
            </div>
            <div className="task-actions">
              <button className="icon-btn" onClick={() => { setEditingTask(task); setIsModalOpen(true); }}><Icons.Edit /></button>
              <button className="icon-btn danger" onClick={() => window.confirm("¿Eliminar tarea?") && onDelete(task.id)}><Icons.Trash /></button>
            </div>
          </div>
        ))}
      </div>
      <TaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(t: any) => editingTask ? onUpdate(editingTask.id, t) : onAdd(t)} editingTask={editingTask} />
    </div>
  );
}
