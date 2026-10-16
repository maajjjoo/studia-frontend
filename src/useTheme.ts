import { useState, useEffect, useCallback } from "react";

export type ThemeMode = 'rose' | 'blue';
export type ThemeAppearance = 'light' | 'dark' | 'system';
export type ResolvedAppearance = 'light' | 'dark';

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveEffectiveAppearance(
  appearance: ThemeAppearance,
  systemPrefersDark: boolean
): ResolvedAppearance {
  if (appearance === 'dark') return 'dark';
  if (appearance === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('studia_theme');
      return saved === 'blue' ? 'blue' : 'rose';
    } catch {
      return 'rose';
    }
  });

  const [appearance, setAppearance] = useState<ThemeAppearance>(() => {
    try {
      const saved = localStorage.getItem('studia_appearance');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
      return 'system';
    } catch {
      return 'system';
    }
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => getSystemPrefersDark());

  const resolvedAppearance = resolveEffectiveAppearance(appearance, systemDark);

  // Sync attributes with documentElement (single source of truth)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-scheme', resolvedAppearance);
  }, [resolvedAppearance]);

  // Listen to OS color scheme changes dynamically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    // Keep systemDark in sync
    setSystemDark(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handler);
      return () => (mediaQuery as any).removeListener(handler);
    }
  }, []);

  const changeTheme = useCallback((newTheme: ThemeMode) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('studia_theme', newTheme);
    } catch {}
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const changeAppearance = useCallback((newAppearance: ThemeAppearance) => {
    setAppearance(newAppearance);
    try {
      localStorage.setItem('studia_appearance', newAppearance);
    } catch {}
    const resolved = resolveEffectiveAppearance(newAppearance, getSystemPrefersDark());
    document.documentElement.setAttribute('data-color-scheme', resolved);
  }, []);

  const toggleAppearance = useCallback(() => {
    // If currently dark (resolved), toggle to light. Otherwise toggle to dark.
    const next: ThemeAppearance = resolvedAppearance === 'dark' ? 'light' : 'dark';
    changeAppearance(next);
  }, [resolvedAppearance, changeAppearance]);

  return {
    theme,
    changeTheme,
    appearance,
    changeAppearance,
    resolvedAppearance,
    toggleAppearance,
  };
}
