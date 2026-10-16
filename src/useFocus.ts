import { useState, useEffect, useRef, useCallback } from 'react';
import { FocusSession, FocusMode } from './types';
import { invoke } from '@tauri-apps/api/core';

const DURATIONS = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export interface UacPromptState {
  appsToBlock?: string[];
  customAppsToBlock?: string[];
  websitesToBlock?: string[];
  isError?: boolean;
  errorMessage?: string;
}

export function useFocus() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [mode, setMode] = useState<FocusMode>('focus');
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);

  // Website blocking state
  const [isWebsitesBlocked, setIsWebsitesBlocked] = useState(false);
  const [isUacPending, setIsUacPending] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [uacPrompt, setUacPrompt] = useState<UacPromptState | null>(null);

  // Track apps that the user has explicitly consented to block in the current session
  const [consentedApps, setConsentedApps] = useState<{ default: string[]; custom: string[] } | null>(null);

  // Active configurations for the ongoing session (persists across pause/resume and repeated sessions)
  const activeAppsRef = useRef<string[]>([]);
  const activeCustomAppsRef = useRef<string[]>([]);
  const activeWebsitesRef = useRef<string[]>([]);
  const [activeWebsites, setActiveWebsites] = useState<string[]>([]);
  const isWebsitesBlockedRef = useRef(false);
  const isUacPendingRef = useRef(false);
  const isPausedRef = useRef(false);
  const operationIdRef = useRef(0);
  const pendingOpPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const isRunningRef = useRef(false);
  const isMountedRef = useRef(false);
  const hasReconciledMountRef = useRef(false);
  const unmountCleanupTimeoutRef = useRef<number | null>(null);

  const targetEndTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  const enqueueBackendOp = useCallback((fn: () => Promise<void>): Promise<void> => {
    const next = pendingOpPromiseRef.current.then(fn, fn);
    pendingOpPromiseRef.current = next;
    return next;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (unmountCleanupTimeoutRef.current !== null) {
      window.clearTimeout(unmountCleanupTimeoutRef.current);
      unmountCleanupTimeoutRef.current = null;
    }

    const saved = localStorage.getItem('studia_focus_v1');
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading focus sessions", e);
      }
    }
    setIsLoaded(true);

    // Reconcile website blocking state with helper backend once on initial mount
    if (!hasReconciledMountRef.current) {
      hasReconciledMountRef.current = true;
      invoke<boolean>('check_website_blocking_active')
        .then(isActive => {
          if (!isMountedRef.current) return;
          // Only clean up stale blocking if no session is currently running or starting
          if (!isRunningRef.current && !isUacPendingRef.current && operationIdRef.current === 0) {
            if (isActive) {
              invoke('disable_website_blocking').catch(console.error);
            }
            isWebsitesBlockedRef.current = false;
            setIsWebsitesBlocked(false);
          }
        })
        .catch(() => {});
    }

    const handleBeforeUnload = () => {
      invoke('disable_website_blocking').catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (tickIntervalRef.current !== null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      // Defer backend cleanup so React StrictMode's immediate simulated remount cancels it
      unmountCleanupTimeoutRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) {
          invoke('disable_website_blocking').catch(() => {});
        }
      }, 150);
    };
  }, []);

  // Periodically verify helper liveness and hosts block while website blocking is marked active
  useEffect(() => {
    if (!isRunning || !isWebsitesBlocked) return;
    const interval = window.setInterval(() => {
      if (!isRunningRef.current || !isWebsitesBlockedRef.current) return;
      invoke<boolean>('check_website_blocking_active')
        .then(active => {
          if (!isMountedRef.current || !isRunningRef.current || !isWebsitesBlockedRef.current) return;
          if (!active) {
            isWebsitesBlockedRef.current = false;
            setIsWebsitesBlocked(false);
            setWebsiteError('El servicio de bloqueo web se detuvo inesperadamente y las reglas ya no están activas.');
          }
        })
        .catch(() => {
          if (!isMountedRef.current || !isRunningRef.current || !isWebsitesBlockedRef.current) return;
          isWebsitesBlockedRef.current = false;
          setIsWebsitesBlocked(false);
          setWebsiteError('No se pudo verificar el estado del bloqueo de sitios web.');
        });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isRunning, isWebsitesBlocked]);

  const startBackendAppMonitoring = useCallback((apps?: string[], customApps?: string[]) => {
    if (mode !== 'focus') return;
    const targetApps = Array.isArray(apps) ? apps : activeAppsRef.current;
    const targetCustomApps = Array.isArray(customApps) ? customApps : activeCustomAppsRef.current;
    if (targetApps.length > 0 || targetCustomApps.length > 0) {
      try {
        invoke('start_focus_mode', { apps: targetApps, customApps: targetCustomApps })
          .catch(err => console.error("Tauri start_focus_mode error:", err));
      } catch (e) {
        console.error("invoke start_focus_mode error:", e);
      }
    }
  }, [mode]);

  const stopBackendAppMonitoring = useCallback(() => {
    try {
      invoke('stop_focus_mode').catch(err => console.error("Tauri stop_focus_mode error:", err));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const stopBackendWebsiteBlocking = useCallback(async (opId?: number) => {
    try {
      await invoke('disable_website_blocking');
    } catch (e) {
      console.error("Tauri disable_website_blocking error:", e);
    }
    if (opId === undefined || operationIdRef.current === opId) {
      isWebsitesBlockedRef.current = false;
      setIsWebsitesBlocked(false);
    }
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

  const handleTimerComplete = useCallback(async () => {
    const opId = ++operationIdRef.current;
    clearTimer();
    isRunningRef.current = false;
    isPausedRef.current = false;
    setIsRunning(false);
    stopBackendAppMonitoring();
    setUacPrompt(null);

    if (sessionStartTimeRef.current !== null) {
      addCompletedSession(mode, sessionStartTimeRef.current, Date.now(), DURATIONS[mode]);
    }
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
    setTimeLeft(DURATIONS[mode]);

    await enqueueBackendOp(async () => {
      await stopBackendWebsiteBlocking(opId);
    });

    try {
      const isEnglish = typeof window !== 'undefined' && localStorage.getItem('studia_language') === 'en';
      const notificationBody = isEnglish
        ? (mode === 'focus' ? 'Focus session completed!' : 'Break finished.')
        : (mode === 'focus' ? '¡Sesión de enfoque completada!' : 'Descanso terminado.');
      new Notification("Studia", { body: notificationBody });
    } catch (e) {}
  }, [clearTimer, addCompletedSession, mode, stopBackendAppMonitoring, stopBackendWebsiteBlocking, enqueueBackendOp]);

  const tick = useCallback(() => {
    if (!targetEndTimeRef.current) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
    setTimeLeft(remaining);

    if (remaining <= 0) {
      handleTimerComplete();
    }
  }, [handleTimerComplete]);

  const startTimerOnly = useCallback((appsToBlock?: string[], customAppsToBlock?: string[]) => {
    isRunningRef.current = true;
    isPausedRef.current = false;
    setIsRunning(true);
    setWebsiteError(null);

    // Trigger apps monitoring independently
    startBackendAppMonitoring(appsToBlock, customAppsToBlock);

    if (timeLeft === DURATIONS[mode] && sessionStartTimeRef.current === null) {
      sessionStartTimeRef.current = Date.now();
    }

    targetEndTimeRef.current = Date.now() + (timeLeft * 1000);
    clearTimer();
    tickIntervalRef.current = window.setInterval(tick, 250);
  }, [mode, timeLeft, tick, clearTimer, startBackendAppMonitoring]);

  const start = useCallback(async (appsToBlock?: string[], customAppsToBlock?: string[], websitesToBlock?: string[]) => {
    if (isRunningRef.current || isUacPendingRef.current) return;
    const opId = ++operationIdRef.current;
    setWebsiteError(null);

    // Validate parameters or fall back to preserved refs (ignoring MouseEvent or undefined).
    // When resuming from a paused session, preserve the session's configured domain list if caller omitted it.
    const targetApps = Array.isArray(appsToBlock) && (appsToBlock.length > 0 || !isPausedRef.current)
      ? appsToBlock
      : activeAppsRef.current;
    const targetCustomApps = Array.isArray(customAppsToBlock) && (customAppsToBlock.length > 0 || !isPausedRef.current)
      ? customAppsToBlock
      : activeCustomAppsRef.current;
    const targetWebsites = Array.isArray(websitesToBlock) && (websitesToBlock.length > 0 || !isPausedRef.current)
      ? websitesToBlock
      : activeWebsitesRef.current;

    activeAppsRef.current = targetApps;
    activeCustomAppsRef.current = targetCustomApps;
    activeWebsitesRef.current = targetWebsites;
    setActiveWebsites(targetWebsites);

    // 1. Desktop application blocking starts independently of website blocking
    if (mode === 'focus') {
      startBackendAppMonitoring(targetApps, targetCustomApps);
    }

    // 2. Manage website blocking if domains configured
    const sites = (mode === 'focus' && targetWebsites.length > 0) ? targetWebsites : [];

    if (sites.length > 0) {
      isUacPendingRef.current = true;
      setIsUacPending(true);

      await enqueueBackendOp(async () => {
        if (operationIdRef.current !== opId) {
          isUacPendingRef.current = false;
          setIsUacPending(false);
          return;
        }

        try {
          await invoke('enable_website_blocking', { domains: sites });
          const verifiedActive = await invoke<boolean>('check_website_blocking_active');
          if (!verifiedActive) {
            throw new Error('Las reglas de bloqueo no pudieron verificarse en el archivo hosts.');
          }

          // If user reset or cancelled while UAC/IPC was in progress, immediately clean up
          if (operationIdRef.current !== opId) {
            await invoke('disable_website_blocking').catch(() => {});
            isWebsitesBlockedRef.current = false;
            setIsWebsitesBlocked(false);
            isUacPendingRef.current = false;
            setIsUacPending(false);
            return;
          }

          isWebsitesBlockedRef.current = true;
          setIsWebsitesBlocked(true);
          isUacPendingRef.current = false;
          setIsUacPending(false);
          startTimerOnly(targetApps, targetCustomApps);
        } catch (err: any) {
          isUacPendingRef.current = false;
          isWebsitesBlockedRef.current = false;
          setIsUacPending(false);
          setIsWebsitesBlocked(false);
          if (operationIdRef.current !== opId) return;

          const errMsg = String(err);

          const isEnglish = typeof window !== 'undefined' && localStorage.getItem('studia_language') === 'en';

          // Desktop application blocking remains active even if website blocking fails
          if (errMsg.includes('UAC_CANCELLED')) {
            setUacPrompt({
              appsToBlock: targetApps,
              customAppsToBlock: targetCustomApps,
              websitesToBlock: sites,
              isError: false,
              errorMessage: isEnglish
                ? 'You cancelled administrator permissions (UAC). Elevated permissions are required to block websites on Windows.'
                : 'Has cancelado los permisos de administrador (UAC). Para bloquear sitios web en Windows se requieren permisos elevados.'
            });
          } else {
            setWebsiteError(errMsg);
            setUacPrompt({
              appsToBlock: targetApps,
              customAppsToBlock: targetCustomApps,
              websitesToBlock: sites,
              isError: true,
              errorMessage: isEnglish
                ? `Could not enable website blocking: ${errMsg}`
                : `No se pudo activar el bloqueo de sitios web: ${errMsg}`
            });
          }
        }
      });
    } else {
      startTimerOnly(targetApps, targetCustomApps);
    }
  }, [mode, startBackendAppMonitoring, startTimerOnly, enqueueBackendOp]);

  const continueWithoutWebsites = useCallback(() => {
    if (!uacPrompt) return;
    const targetApps = activeAppsRef.current;
    const targetCustomApps = activeCustomAppsRef.current;
    setUacPrompt(null);
    setWebsiteError(null);
    activeWebsitesRef.current = [];
    setActiveWebsites([]);
    isWebsitesBlockedRef.current = false;
    setIsWebsitesBlocked(false);
    // Desktop application blocking remains active; start the timer
    startTimerOnly(targetApps, targetCustomApps);
  }, [uacPrompt, startTimerOnly]);

  const cancelUacPrompt = useCallback(() => {
    const opId = ++operationIdRef.current;
    setUacPrompt(null);
    isWebsitesBlockedRef.current = false;
    setIsWebsitesBlocked(false);
    isUacPendingRef.current = false;
    setIsUacPending(false);
    stopBackendAppMonitoring();
    isRunningRef.current = false;
    isPausedRef.current = false;
    setIsRunning(false);
    clearTimer();
    setTimeLeft(DURATIONS[mode]);
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
    enqueueBackendOp(async () => {
      await stopBackendWebsiteBlocking(opId);
    });
  }, [mode, clearTimer, stopBackendAppMonitoring, stopBackendWebsiteBlocking, enqueueBackendOp]);

  const pause = useCallback(async () => {
    if (!isRunningRef.current) return;
    const opId = ++operationIdRef.current;

    clearTimer();
    isRunningRef.current = false;
    isPausedRef.current = true;
    setIsRunning(false);
    stopBackendAppMonitoring(); // Free apps during pause

    if (targetEndTimeRef.current) {
      const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
    }
    targetEndTimeRef.current = null;

    // Temporarily remove website blocks during pause without killing the elevated helper
    if (isWebsitesBlockedRef.current || activeWebsitesRef.current.length > 0) {
      await enqueueBackendOp(async () => {
        try {
          await invoke('pause_website_blocking');
          if (operationIdRef.current === opId) {
            isWebsitesBlockedRef.current = false;
            setIsWebsitesBlocked(false);
          }
        } catch (e: any) {
          console.error("Tauri pause_website_blocking error on pause:", e);
          if (operationIdRef.current === opId) {
            setWebsiteError(`No se pudo pausar el bloqueo web: ${String(e)}`);
            try {
              const stillActive = await invoke<boolean>('check_website_blocking_active');
              isWebsitesBlockedRef.current = stillActive;
              setIsWebsitesBlocked(stillActive);
            } catch {
              isWebsitesBlockedRef.current = false;
              setIsWebsitesBlocked(false);
            }
          }
        }
      });
    }
  }, [clearTimer, stopBackendAppMonitoring, enqueueBackendOp]);

  const reset = useCallback(async () => {
    const opId = ++operationIdRef.current;
    clearTimer();
    isRunningRef.current = false;
    isPausedRef.current = false;
    isUacPendingRef.current = false;
    setIsRunning(false);
    setIsUacPending(false);
    stopBackendAppMonitoring();
    // Synchronously reset timer state before awaiting backend cleanup so a subsequent start() is never overwritten
    setUacPrompt(null);
    setWebsiteError(null);
    setTimeLeft(DURATIONS[mode]);
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;

    if (isWebsitesBlockedRef.current || activeWebsitesRef.current.length > 0) {
      await enqueueBackendOp(async () => {
        await stopBackendWebsiteBlocking(opId);
      });
    }
  }, [clearTimer, mode, stopBackendAppMonitoring, stopBackendWebsiteBlocking, enqueueBackendOp]);

  const switchMode = useCallback(async (newMode: FocusMode) => {
    const opId = ++operationIdRef.current;
    clearTimer();
    isRunningRef.current = false;
    isPausedRef.current = false;
    isUacPendingRef.current = false;
    setIsRunning(false);
    setIsUacPending(false);
    stopBackendAppMonitoring();
    setUacPrompt(null);
    setWebsiteError(null);
    setMode(newMode);
    setTimeLeft(DURATIONS[newMode]);
    targetEndTimeRef.current = null;
    sessionStartTimeRef.current = null;

    if (isWebsitesBlockedRef.current || activeWebsitesRef.current.length > 0) {
      await enqueueBackendOp(async () => {
        await stopBackendWebsiteBlocking(opId);
      });
    }
  }, [clearTimer, stopBackendAppMonitoring, stopBackendWebsiteBlocking, enqueueBackendOp]);

  return {
    isLoaded,
    sessions,
    mode,
    timeLeft,
    isRunning,
    start,
    pause,
    reset,
    switchMode,
    consentedApps,
    setConsentedApps,
    isWebsitesBlocked,
    isUacPending,
    websiteError,
    uacPrompt,
    continueWithoutWebsites,
    cancelUacPrompt,
    activeWebsites,
    activeApps: activeAppsRef.current,
    activeCustomApps: activeCustomAppsRef.current,
  };
}
