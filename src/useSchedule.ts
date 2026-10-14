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

  const addActivity = (act: Omit<Activity, 'id' | 'createdAt'>) => {
    const newAct: Activity = {
      ...act,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setActivities(prev => {
      const updated = [...prev, newAct];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const addActivities = (acts: Omit<Activity, 'id' | 'createdAt'>[]) => {
    if (!acts || acts.length === 0) return;
    const newActs: Activity[] = acts.map(act => ({
      ...act,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }));
    setActivities(prev => {
      const updated = [...prev, ...newActs];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const updateActivity = (id: string, updates: Partial<Activity>) => {
    setActivities(prev => {
      const updated = prev.map(a => (a.id === id ? { ...a, ...updates } : a));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteActivity = (id: string) => {
    setActivities(prev => {
      const updated = prev.filter(a => a.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return {
    activities,
    isScheduleLoaded: isLoaded,
    addActivity,
    addActivities,
    updateActivity,
    deleteActivity,
  };
}
