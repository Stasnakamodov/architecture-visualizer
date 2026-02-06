'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

export function StepEditToolbar() {
  const { t } = useTranslation();
  const {
    editingStepId,
    steps,
    nodes,
    updateStep,
    cancelStepEditing,
    confirmStepEditing,
    saveStepViewport,
  } = useCanvasStore();
  const { getViewport } = useReactFlow();

  const inputRef = useRef<HTMLInputElement>(null);

  const step = steps.find(s => s.id === editingStepId);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't cancel if focused on an input (let normal Escape behavior happen first)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          target.blur();
          return;
        }
        cancelStepEditing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelStepEditing]);

  const handleConfirm = useCallback(() => {
    if (editingStepId) {
      const vp = getViewport();
      saveStepViewport(editingStepId, { x: vp.x, y: vp.y, zoom: vp.zoom });
    }
    confirmStepEditing();
  }, [editingStepId, getViewport, saveStepViewport, confirmStepEditing]);

  if (!step || !editingStepId) return null;

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
    >
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {/* Blue indicator dot */}
        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />

        {/* Label */}
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex-shrink-0">
          {t('stepEditor.editingStep')}
        </span>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Inline name input */}
        <input
          ref={inputRef}
          type="text"
          value={step.name}
          onChange={(e) => updateStep(editingStepId, { name: e.target.value })}
          className="w-32 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
          placeholder={t('stepEditor.stepName')}
        />

        {/* Node count */}
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
          {step.nodeIds.length}/{nodes.length}
        </span>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Cancel button */}
        <button
          onClick={cancelStepEditing}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          {t('stepEditor.cancelEditing')}
        </button>

        {/* Done button */}
        <button
          onClick={handleConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          {t('stepEditor.doneEditing')}
        </button>
      </div>
    </motion.div>
  );
}
