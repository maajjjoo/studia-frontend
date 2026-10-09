import { useState, useEffect, useRef, useCallback } from 'react';
import { FocusSession, FocusMode } from './types';

const DURATIONS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export function useFocus() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [mode, setMode] = useState<FocusMode>('focus');
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);

  const targetEndTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('studia_focus_v1');
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading focus sessions", e);
      }
    }
    setIsLoaded(true);
    
    return () => {
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
      }
    };
  }, []);



  const addCompletedSession = useCallback((sessionMode: FocusMode, start: number, end: number, duration: number) => {
    if (sessionMode !== 'focus') return; // We only track focus sessions history
    setSessions(prev => {
      const newSession: FocusSession = {
        id: crypto.randomUUID(),
        startTime: start,
        endTime: end,
        duration,
        mode: sessionMode,
        completed: true
      };
      const updated = [...prev, newSession];
      localStorage.setItem('studia_focus_v1', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearTimer = useCallback(() => {
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const handleTimerComplete = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    if (sessionStartTimeRef.current !== null) {
      addCompletedSession(mode, sessionStartTimeRef.current, Date.now(), DURATIONS[mode]);
    }
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
    // Play sound or notification here if requested
    try {
      new Notification("Studia", { body: mode === 'focus' ? "¡Sesión de enfoque completada!" : "Descanso terminado." });
    } catch(e) {}
  }, [clearTimer, addCompletedSession, mode]);

  const tick = useCallback(() => {
    if (!targetEndTimeRef.current) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
    setTimeLeft(remaining);

    if (remaining <= 0) {
      handleTimerComplete();
    }
  }, [handleTimerComplete]);

  const start = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    
    // If not resuming (start from fresh), set start time
    if (timeLeft === DURATIONS[mode]) {
      sessionStartTimeRef.current = Date.now();
    }
    
    targetEndTimeRef.current = Date.now() + (timeLeft * 1000);
    tickIntervalRef.current = window.setInterval(tick, 250);
  }, [isRunning, timeLeft, mode, tick]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    clearTimer();
    setIsRunning(false);
    // Update timeLeft accurately on pause
    if (targetEndTimeRef.current) {
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
    }
    targetEndTimeRef.current = null;
  }, [isRunning, clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeLeft(DURATIONS[mode]);
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
  }, [clearTimer, mode]);

  const switchMode = useCallback((newMode: FocusMode) => {
    clearTimer();
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(DURATIONS[newMode]);
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
  }, [clearTimer]);

  return {
    isLoaded,
    sessions,
    mode,
    timeLeft,
    isRunning,
    start,
    pause,
    reset,
    switchMode
  };
}
