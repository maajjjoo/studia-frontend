import { useState, useEffect } from 'react';
import { Activity } from './types';

const STORAGE_KEY = 'studia_schedule_v1';

export function useSchedule() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setActivities(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse schedule", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveActivities = (newActs: Activity[]) => {
    setActivities(newActs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newActs));
  };

  const addActivity = (act: Omit<Activity, 'id' | 'createdAt'>) => {
    const newAct: Activity = {
      ...act,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    saveActivities([...activities, newAct]);
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    saveActivities(activities.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteActivity = (id: string) => {
    saveActivities(activities.filter(a => a.id !== id));
  };

  return { activities, isScheduleLoaded: isLoaded, addActivity, updateActivity, deleteActivity };
}
