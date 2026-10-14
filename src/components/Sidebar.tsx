import { useState } from "react";
import { Icons } from "../Icons";
import { StudentProfile } from "../types";
import { getInitials } from "../utils/studyHelpers";

export interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  profile: StudentProfile;
}

export function Sidebar({ activeTab, onSelectTab, profile }: SidebarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="brand"><Icons.Logo /><span>Studia</span></div>
      <span className="menu-label">Menú</span>
      <nav className="nav-links">
        <button className={`nav-item ${activeTab === "inicio" ? "active" : ""}`} onClick={() => onSelectTab("inicio")}><Icons.Home /> Inicio</button>
        <button className={`nav-item ${activeTab === "tareas" ? "active" : ""}`} onClick={() => onSelectTab("tareas")}><Icons.CheckSquare /> Tareas</button>
        <button className={`nav-item ${activeTab === "planificador" ? "active" : ""}`} onClick={() => onSelectTab("planificador")}><Icons.Edit /> Planificador</button>
        <button className={`nav-item ${activeTab === "horario" ? "active" : ""}`} onClick={() => onSelectTab("horario")}><Icons.Book /> Horario</button>
        <button className={`nav-item ${activeTab === "calendario" ? "active" : ""}`} onClick={() => onSelectTab("calendario")}><Icons.Calendar /> Calendario</button>
        <button className={`nav-item ${activeTab === "enfoque" ? "active" : ""}`} onClick={() => onSelectTab("enfoque")}><Icons.TrendingUp /> Enfoque</button>
        <button className={`nav-item ${activeTab === "asistente" ? "active" : ""}`} onClick={() => onSelectTab("asistente")}><Icons.Spark /> Asistente IA</button>
        <button className={`nav-item ${activeTab === "progreso" ? "active" : ""}`} onClick={() => onSelectTab("progreso")}><Icons.Activity /> Progreso</button>
      </nav>

      <div className="sidebar-promo">
        <div className="promo-icon"><Icons.Activity /></div>
        <h4>Un paso a la vez</h4>
        <p>Tu constancia está dando frutos.</p>
      </div>

      <div
        className="user-profile"
        style={{ position: 'relative', cursor: 'pointer', transition: 'var(--transition-smooth)', display: 'flex', alignItems: 'center' }}
        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
      >
        <div className="avatar">{getInitials(profile.name)}</div>
        <div className="user-info" style={{ flex: 1 }}>
          <span className="user-name">{profile.name}</span>
          <span className="user-role">{profile.program || 'Estudiante'}</span>
        </div>
        <div style={{ color: 'var(--color-text-muted)' }}><Icons.ChevronUp /></div>
        {isProfileMenuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(false); }} />
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, width: '100%', marginBottom: '0.5rem',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)', zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>{getInitials(profile.name)}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>{profile.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{profile.program || 'Estudiante'}</span>
                </div>
              </div>
              <div style={{ padding: '0.5rem' }}>
                <button
                  className="nav-item"
                  style={{ width: '100%', justifyContent: 'flex-start', background: 'var(--color-bg-base)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
                  onClick={(e) => { e.stopPropagation(); onSelectTab("ajustes"); setIsProfileMenuOpen(false); }}
                >
                  <Icons.Settings /> Ajustes
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
