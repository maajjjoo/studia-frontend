import { useState, useRef, useLayoutEffect, useEffect, type ReactNode } from "react";
import { Icons } from "../Icons";
import { StudentProfile } from "../types";
import { getInitials } from "../utils/studyHelpers";
import { useTranslation } from "../i18n/LanguageContext";
import type { Account } from "../useAuth";

export interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  profile: StudentProfile;
  account: Account;
  onLogout: () => void;
}

const NAV: { id: string; label: string; icon: () => ReactNode }[] = [
  { id: "inicio", label: "nav.home", icon: Icons.Home },
  { id: "tareas", label: "nav.tasks", icon: Icons.CheckSquare },
  { id: "planificador", label: "nav.planner", icon: Icons.CalendarClock },
  { id: "horario", label: "nav.timetable", icon: Icons.LayoutGrid },
  { id: "calendario", label: "nav.calendar", icon: Icons.Calendar },
  { id: "enfoque", label: "nav.focus", icon: Icons.Timer },
  { id: "asistente", label: "nav.ai", icon: Icons.Spark },
  { id: "progreso", label: "nav.progress", icon: Icons.BarChart },
  { id: "ajustes", label: "nav.settings", icon: Icons.Settings },
];

export function Sidebar({ activeTab, onSelectTab, profile, account, onLogout }: SidebarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);

  // The highlight glides to whichever item is active.
  const measure = () => {
    const el = navRef.current?.querySelector<HTMLElement>(".nav-item.active");
    setPill(el ? { top: el.offsetTop, height: el.offsetHeight } : null);
  };
  useLayoutEffect(measure, [activeTab]);
  useEffect(() => {
    // Re-measure when item sizes change (web font swap, window resize, compact layout).
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    // border-box: the compact layout only changes padding, which content-box would miss.
    nav.querySelectorAll(".nav-item").forEach(el => ro.observe(el, { box: "border-box" }));
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand"><Icons.Logo /><span>Studia</span></div>
      <span className="menu-label">{t('nav.menu')}</span>
      <nav className="nav-links" ref={navRef}>
        {pill && <span className="nav-pill" aria-hidden="true" style={{ transform: `translateY(${pill.top}px)`, height: pill.height }} />}
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeTab === id ? "active" : ""}`}
            aria-current={activeTab === id ? "page" : undefined}
            onClick={() => onSelectTab(id)}
          >
            <Icon /> {t(label)}
          </button>
        ))}
      </nav>

      <div className="sidebar-promo">
        <div className="promo-icon"><Icons.Spark /></div>
        <h4>{t('nav.promoTitle')}</h4>
        <p>{t('nav.promoSubtitle')}</p>
      </div>

      <div
        className={`user-profile ${isProfileMenuOpen ? "is-open" : ""}`}
        style={{ position: 'relative', cursor: 'pointer', transition: 'var(--transition-smooth)', display: 'flex', alignItems: 'center' }}
        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
      >
        <div className="avatar">{getInitials(profile.name)}</div>
        <div className="user-info" style={{ flex: 1 }}>
          <span className="user-name">{profile.name}</span>
          <span className="user-role">@{account.username}</span>
        </div>
        <div className="user-chevron"><Icons.ChevronUp /></div>
        {isProfileMenuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(false); }} />
            <div className="profile-menu" style={{
              position: 'absolute', bottom: '100%', left: 0, width: '100%', marginBottom: '0.5rem',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)', zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <div className="profile-menu-head">
                <div className="avatar">{getInitials(profile.name)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span className="pm-name">{profile.name}</span>
                  <span className="pm-email" title={account.email}>{account.email}</span>
                  <span className="pm-role">{profile.program || t('nav.studentRole')}</span>
                </div>
              </div>
              <div className="profile-menu-actions">
                <button
                  className="pm-action"
                  onClick={(e) => { e.stopPropagation(); onSelectTab("ajustes"); setIsProfileMenuOpen(false); }}
                >
                  <Icons.Settings /> {t('nav.settings')}
                </button>
                <button
                  className="pm-action pm-logout"
                  onClick={(e) => { e.stopPropagation(); setIsProfileMenuOpen(false); onLogout(); }}
                >
                  <Icons.LogOut /> {t('auth.logout')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
