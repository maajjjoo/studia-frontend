import { useState } from "react";
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

function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const { theme, changeTheme } = useTheme();
  const { profile, isLoaded: profileLoaded, saveProfile, addClassSession, updateClassSession, deleteClassSession } = useProfile();
  const { tasks, isLoaded: tasksLoaded, addTask, updateTask, deleteTask, toggleTaskStatus } = useTasks();
  const { activities, isScheduleLoaded, addActivity, addActivities, updateActivity, deleteActivity } = useSchedule();
  const focus = useFocus();
  const ai = useAi();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

  if (!tasksLoaded || !isScheduleLoaded || !focus.isLoaded || !ai.isLoaded || !profileLoaded) return null;

  if (!profile) {
    return (
      <div className="layout" data-theme={theme}>
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
            onNavigate={setActiveTab}
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
              setActiveTab('calendario');
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
        return <SettingsScreen theme={theme} onChangeTheme={changeTheme} profile={profile} onUpdateProfile={saveProfile} />;
      default:
        return (
          <HomeScreen
            profile={profile}
            tasks={tasks}
            activities={activities}
            focus={focus}
            onNavigate={setActiveTab}
            onOpenNewTask={() => setIsTaskModalOpen(true)}
            onOpenNewActivity={() => setIsActivityModalOpen(true)}
            onToggleTask={toggleTaskStatus}
          />
        );
    }
  };

  return (
    <div className="layout" data-theme={theme}>
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} profile={profile} />

      {renderContent()}

      <TaskModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} onSave={addTask} editingTask={null} />
      <ActivityModal isOpen={isActivityModalOpen} onClose={() => setIsActivityModalOpen(false)} onSave={addActivity} editingActivity={null} />
    </div>
  );
}

export default App;
