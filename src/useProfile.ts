import { useState, useEffect } from 'react';
import { StudentProfile } from './types';

export function useProfile() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('studia_profile_v1');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse profile", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveProfile = (newProfile: StudentProfile) => {
    setProfile(newProfile);
    localStorage.setItem('studia_profile_v1', JSON.stringify(newProfile));
  };

  const addClassSession = (session: Omit<import('./types').ClassSession, 'id'>) => {
    if (!profile) return;
    const newSession = { ...session, id: crypto.randomUUID() };
    saveProfile({ ...profile, classTimetable: [...profile.classTimetable, newSession] });
  };

  const updateClassSession = (id: string, updatedSession: Omit<import('./types').ClassSession, 'id'>) => {
    if (!profile) return;
    saveProfile({
      ...profile,
      classTimetable: profile.classTimetable.map(s => s.id === id ? { ...updatedSession, id } : s)
    });
  };

  const deleteClassSession = (id: string) => {
    if (!profile) return;
    saveProfile({
      ...profile,
      classTimetable: profile.classTimetable.filter(s => s.id !== id)
    });
  };

  return { profile, isLoaded, saveProfile, addClassSession, updateClassSession, deleteClassSession };
}
