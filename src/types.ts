export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: number;
}

export type ActivityCategory = 'class' | 'exam' | 'assignment' | 'personal';

export interface Activity {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  category: ActivityCategory;
  createdAt: number;
}

export type FocusMode = 'focus' | 'shortBreak' | 'longBreak';

export interface FocusSession {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  mode: FocusMode;
  completed: boolean;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ClassSession {
  id: string;
  subject: string;
  dayOfWeek: number; // 1 = Monday, 7 = Sunday
  startTime: string; // HH:mm
  endTime: string;
  room?: string;
}

export interface UnavailableBlock {
  id: string;
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface StudyAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface StudentProfile {
  name: string;
  program: string;
  semester: string;
  subjects: string[];
  classTimetable: ClassSession[];
  unavailableBlocks: UnavailableBlock[];
  studyPreferences: {
    preferredSessionDuration: number; // minutes
    preferredBreakDuration: number; // minutes
  };
  studyAvailability: StudyAvailability[];
}
