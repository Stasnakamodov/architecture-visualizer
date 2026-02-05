'use client';

import { motion } from 'framer-motion';
import { useTranslation } from '@/i18n/context';

interface UnsavedChangesDialogProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950 w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('dialogs.unsavedTitle')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('dialogs.unsavedSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('dialogs.unsavedMessage')}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-2">
          <button
            onClick={onSave}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium text-sm"
          >
            {t('dialogs.saveExit')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onDiscard}
              className="flex-1 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm"
            >
              {t('dialogs.discard')}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-sm"
            >
              {t('dialogs.cancel')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
