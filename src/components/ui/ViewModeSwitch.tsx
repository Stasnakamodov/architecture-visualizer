'use client';

import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

export function ViewModeSwitch() {
  const { viewMode, setViewMode } = useCanvasStore();
  const { t } = useTranslation();

  return (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      <button
        onClick={() => setViewMode('technical')}
        className={`
          relative px-4 py-2 text-sm font-medium rounded-md transition-colors
          ${viewMode === 'technical' ? 'text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}
        `}
      >
        {viewMode === 'technical' && (
          <motion.div
            layoutId="viewMode"
            className="absolute inset-0 bg-blue-600 rounded-md"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          {t('viewMode.technical')}
        </span>
      </button>

      <button
        onClick={() => setViewMode('executive')}
        className={`
          relative px-4 py-2 text-sm font-medium rounded-md transition-colors
          ${viewMode === 'executive' ? 'text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}
        `}
      >
        {viewMode === 'executive' && (
          <motion.div
            layoutId="viewMode"
            className="absolute inset-0 bg-indigo-600 rounded-md"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {t('viewMode.executive')}
        </span>
      </button>
    </div>
  );
}
