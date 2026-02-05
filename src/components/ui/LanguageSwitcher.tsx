'use client';

import { useTranslation, type Locale } from '@/i18n/context';

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 p-0.5 text-xs font-medium">
      <button
        onClick={() => setLocale('ru')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          locale === 'ru'
            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        RU
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          locale === 'en'
            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        EN
      </button>
    </div>
  );
}
