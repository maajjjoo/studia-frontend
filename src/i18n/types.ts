export type SupportedLanguage = 'es' | 'en';

export interface TranslationParams {
  [key: string]: string | number;
}

export interface DayFormatOptions {
  weekday?: 'narrow' | 'short' | 'long';
}

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {}
