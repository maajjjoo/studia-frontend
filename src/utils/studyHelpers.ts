import type { FocusSession } from "../types";

export const formatTime = (secs: number): string => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const getWeeklyFocusData = (sessions: FocusSession[]): number[] => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const weeklyData = [0, 0, 0, 0, 0, 0, 0];

  sessions.forEach(s => {
    if (!s.completed || s.mode !== 'focus') return;
    const sDate = new Date(s.startTime);
    // Exclude future dates just in case, and only count from Monday of this week
    if (sDate >= monday && sDate.getTime() <= now.getTime()) {
      const d = sDate.getDay();
      const idx = d === 0 ? 6 : d - 1;
      weeklyData[idx] += s.duration; // in seconds
    }
  });

  return weeklyData;
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};
