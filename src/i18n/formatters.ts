import type { SupportedLanguage, TranslationParams, DateFormatOptions, DayFormatOptions } from './types.ts';

export function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    return key in params ? String(params[key]) : `{${key}}`;
  });
}

export function getNestedValue(obj: any, path: string): string | undefined {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function formatLocalizedDate(
  dateInput: Date | string,
  language: SupportedLanguage,
  options?: DateFormatOptions
): string {
  try {
    const date = typeof dateInput === 'string'
      ? (dateInput.includes('T') ? new Date(dateInput) : new Date(dateInput + 'T00:00:00'))
      : dateInput;

    const locale = language === 'en' ? 'en-US' : 'es-ES';
    const defaultOptions: DateFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    const formatted = new Intl.DateTimeFormat(locale, options || defaultOptions).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return String(dateInput);
  }
}

export function formatLocalizedDay(
  dayOfWeek: number,
  language: SupportedLanguage,
  options?: DayFormatOptions
): string {
  try {
    const refDate = new Date(2026, 0, 4 + dayOfWeek); // Jan 5, 2026 was a Monday
    const locale = language === 'en' ? 'en-US' : 'es-ES';
    const weekdayOpt = options?.weekday || 'long';
    const formatted = new Intl.DateTimeFormat(locale, { weekday: weekdayOpt }).format(refDate);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return `Day ${dayOfWeek}`;
  }
}

export function formatLocalizedMonth(
  monthIndex: number,
  language: SupportedLanguage,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const refDate = new Date(2026, monthIndex, 1);
    const locale = language === 'en' ? 'en-US' : 'es-ES';
    const defaultOptions: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    const formatted = new Intl.DateTimeFormat(locale, options || defaultOptions).format(refDate);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return `Month ${monthIndex + 1}`;
  }
}
