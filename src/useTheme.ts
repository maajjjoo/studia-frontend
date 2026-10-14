import { useState, useEffect } from "react";

export type ThemeMode = 'rose' | 'blue';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('rose');

  useEffect(() => {
    const saved = localStorage.getItem('studia_theme');
    if (saved === 'rose' || saved === 'blue') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      localStorage.setItem('studia_theme', 'rose');
      document.documentElement.setAttribute('data-theme', 'rose');
    }
  }, []);

  const changeTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    localStorage.setItem('studia_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return { theme, changeTheme };
}
