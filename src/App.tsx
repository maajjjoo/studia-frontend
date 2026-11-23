import { useState } from "react";
import { flushSync } from "react-dom";
import "./App.css";
import { useTheme } from "./useTheme";
import { useTasks } from "./useTasks";
import { useSchedule } from "./useSchedule";
import { useFocus } from "./useFocus";
import { useAi } from "./useAi";
import { useProfile } from "./useProfile";
import { OnboardingScreen } from "./OnboardingScreen";
import { TimetableScreen } from "./TimetableScreen";
import { PlannerScreen } from "./PlannerScreen";
import { SettingsScreen } from "./SettingsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { TasksScreen } from "./screens/TasksScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { FocusScreen } from "./screens/FocusScreen";
import { AiScreen } from "./screens/AiScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { Sidebar } from "./components/Sidebar";
import { TaskModal } from "./components/TaskModal";
import { ActivityModal } from "./components/ActivityModal";
import { LanguageProvider, useTranslation } from "./i18n/LanguageContext";
import { useAuth, type Account } from "./useAuth";
import { AuthScreen } from "./AuthScreen";

function AppContent({ account, onLogout, themeState }: { account: Account; onLogout: () => void; themeState: ReturnType<typeof useTheme> }) {
  const [activeTab, setActiveTab] = useState("inicio");

  // Same navigation as before; it only adds a cross-screen animation where the webview supports it.
  const navigate = (tab: string) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (tab === activeTab || !doc.startViewTransition || reduced) { setActiveTab(tab); return; }
    // The tab change must never wait on the animation: if the webview stalls the
    // transition, the safety timer applies it anyway (the second call is a no-op).
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      flushSync(() => setActiveTab(tab));
    };
    try {
      doc.startViewTransition(apply);
    } catch {
      apply();
      return;
    }
    window.setTimeout(apply, 250);
  };
  const { language } = useTranslation();
  const { theme, changeTheme, appearance, changeAppearance, resolvedAppearance, toggleAppearance } = themeState;
  const { profile, isLoaded: profileLoaded, saveProfile, addClassSession, updateClassSession, deleteClassSession } = useProfile();
  const { tasks, isLoaded: tasksLoaded, addTask, updateTask, deleteTask, toggleTaskStatus } = useTasks();
  const { activities, isScheduleLoaded, addActivity, addActivities, updateActivity, deleteActivity } = useSchedule();
  const focus = useFocus();
  const ai = useAi(language);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  if (!tasksLoaded || !isScheduleLoaded || !focus.isLoaded || !ai.isLoaded || !profileLoaded) return null;

  if (!profile) {
    return (
      <div className="layout">
        <OnboardingScreen onComplete={saveProfile} />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "inicio":
        return (
          <HomeScreen
            profile={profile}
            tasks={tasks}
            activities={activities}
            focus={focus}
            appearance={appearance}
            resolvedAppearance={resolvedAppearance}
            onToggleAppearance={toggleAppearance}
            onNavigate={navigate}
            onOpenNewTask={() => setIsTaskModalOpen(true)}
            onOpenNewActivity={() => setIsActivityModalOpen(true)}
            onToggleTask={toggleTaskStatus}
          />
        );
      case "tareas":
        return <TasksScreen tasks={tasks} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} onToggle={toggleTaskStatus} />;
      case "planificador":
        return (
          <PlannerScreen
            profile={profile}
            tasks={tasks}
            activities={activities}
            onSaveBlocks={(blocks) => {
              addActivities(blocks);
              navigate('calendario');
            }}
          />
        );
      case "horario":
        return (
          <TimetableScreen
            profile={profile}
            onAddClass={addClassSession}
            onUpdateClass={updateClassSession}
            onDeleteClass={deleteClassSession}
            onUpdateProfile={saveProfile}
          />
        );
      case "calendario":
        return <CalendarScreen activities={activities} onAdd={addActivity} onUpdate={updateActivity} onDelete={deleteActivity} />;
      case "enfoque":
        return <FocusScreen focus={focus} profile={profile} />;
      case "asistente":
        return <AiScreen profile={profile} ai={ai} tasks={tasks} activities={activities} focus={focus} />;
      case "progreso":
        return <ProgressScreen tasks={tasks} focus={focus} />;
      case "ajustes":
        return (
          <SettingsScreen
            theme={theme}
            onChangeTheme={changeTheme}
            appearance={appearance}
            onChangeAppearance={changeAppearance}
            profile={profile}
            onUpdateProfile={saveProfile}
          />
        );
      default:
        return (
          <HomeScreen
            profile={profile}
            tasks={tasks}
            activities={activities}
            focus={focus}
            appearance={appearance}
            resolvedAppearance={resolvedAppearance}
            onToggleAppearance={toggleAppearance}
            onNavigate={navigate}
            onOpenNewTask={() => setIsTaskModalOpen(true)}
            onOpenNewActivity={() => setIsActivityModalOpen(true)}
            onToggleTask={toggleTaskStatus}
          />
        );
    }
  };

  return (
    <div className="layout">
      <Sidebar activeTab={activeTab} onSelectTab={navigate} profile={profile} account={account} onLogout={onLogout} />

      {renderContent()}

      <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={addTask} editingTask={null} />
      <ActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} onSave={addActivity} editingActivity={null} />
    </div>
  );
}

function AuthGate() {
  const themeState = useTheme();
  const { account, login, register, enter, logout } = useAuth();

  if (!account) {
    return (
      <div className="layout auth-layout">
        <AuthScreen onLogin={login} onRegister={register} onEnter={enter} />
      </div>
    );
  }

  // Keyed by account so every hook reloads that account's own data.
  return <AppContent key={account.id} account={account} onLogout={logout} themeState={themeState} />;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthGate />
    </LanguageProvider>
  );
}
