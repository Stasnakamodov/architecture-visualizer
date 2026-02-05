'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import ru from './locales/ru.json';
import en from './locales/en.json';

export type Locale = 'ru' | 'en';

const messages: Record<Locale, Record<string, any>> = { ru, en };

const STORAGE_KEY = 'app-locale';
const DEFAULT_LOCALE: Locale = 'ru';

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ru' || stored === 'en') return stored;
  return DEFAULT_LOCALE;
}

// Resolve nested key like "header.back"
function resolve(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

// Interpolate {var} placeholders
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Load stored locale on mount
  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  // Update html lang attribute
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const value = resolve(messages[locale], key);
    if (!value) return key;
    return interpolate(value, params);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
}
