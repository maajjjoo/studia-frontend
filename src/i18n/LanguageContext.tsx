import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { SupportedLanguage, TranslationParams, DateFormatOptions, DayFormatOptions } from './types.ts';
import { es, TranslationSchema } from './es.ts';
import { en } from './en.ts';
import {
  interpolate,
  getNestedValue,
  formatLocalizedDate,
  formatLocalizedDay,
  formatLocalizedMonth,
} from './formatters.ts';

const DICTIONARIES: Record<SupportedLanguage, TranslationSchema> = {
  es,
  en,
};

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: TranslationParams) => string;
  formatDate: (date: Date | string, options?: DateFormatOptions) => string;
  formatDay: (dayOfWeek: number, options?: DayFormatOptions) => string;
  formatMonth: (monthIndex: number, options?: Intl.DateTimeFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem('studia_language');
      return saved === 'en' ? 'en' : 'es';
    } catch {
      return 'es';
    }
  });

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem('studia_language', newLang);
      document.documentElement.setAttribute('lang', newLang);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const dict = DICTIONARIES[language] || es;

  const t = useCallback((key: string, params?: TranslationParams): string => {
    let raw = getNestedValue(dict, key);
    if (!raw && language !== 'es') {
      raw = getNestedValue(es, key);
    }
    if (!raw) {
      return key;
    }
    return interpolate(raw, params);
  }, [dict, language]);

  const formatDate = useCallback((dateInput: Date | string, options?: DateFormatOptions): string => {
    return formatLocalizedDate(dateInput, language, options);
  }, [language]);

  const formatDay = useCallback((dayOfWeek: number, options?: DayFormatOptions): string => {
    return formatLocalizedDay(dayOfWeek, language, options);
  }, [language]);

  const formatMonth = useCallback((monthIndex: number, options?: Intl.DateTimeFormatOptions): string => {
    return formatLocalizedMonth(monthIndex, language, options);
  }, [language]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    formatDate,
    formatDay,
    formatMonth,
  }), [language, setLanguage, t, formatDate, formatDay, formatMonth]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
