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
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20"
    >
      <div className="flex items-center gap-2.5 px-3 py-2 bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-xl rounded-xl shadow-lg shadow-black/10 dark:shadow-black/30 border border-gray-200/60 dark:border-white/[0.08]">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {t('stepEditor.editingStep')}
          </span>
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/[0.08]" />

        {/* Step name input */}
        <input
          ref={inputRef}
          type="text"
          value={step.name}
          onChange={(e) => updateStep(editingStepId, { name: e.target.value })}
          className="w-36 px-2 py-1 text-xs bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          placeholder={t('stepEditor.stepName')}
        />

        {/* Node counter */}
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">
          {step.nodeIds.length}
          <span className="text-gray-300 dark:text-gray-600">/{step.canvasNodeIds?.length ?? nodes.length}</span>
        </span>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/[0.08]" />

        {/* Hint */}
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          {t('stepEditor.clickToToggle')}
        </span>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/[0.08]" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={cancelStepEditing}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            {t('stepEditor.cancelEditing')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            {t('stepEditor.doneEditing')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
