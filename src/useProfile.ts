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

  return { profile, isLoaded, saveProfile };
}
