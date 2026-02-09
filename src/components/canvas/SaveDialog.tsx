'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { saveCanvas, updateCanvas, type SavedCanvas, type VisualGroup } from '@/lib/storage/localStorage';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';
import type { AppNode, AppEdge, Step, Presentation } from '@/types/canvas';
import type { Scenario } from '@/stores/canvasStore';

interface SaveDialogProps {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
  visualGroups?: VisualGroup[];
  steps?: Step[];
  scenarios?: Scenario[];
  presentations?: Presentation[];
  existingCanvas?: SavedCanvas | null;
  onSave: (canvas: SavedCanvas) => void;
  onClose: () => void;
}

export function SaveDialog({
  nodes,
  edges,
  viewport,
  visualGroups = [],
  steps = [],
  scenarios = [],
  presentations = [],
  existingCanvas,
  onSave,
  onClose,
}: SaveDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(existingCanvas?.name || '');
  const [saveAsNew, setSaveAsNew] = useState(false);
  const markClean = useCanvasStore((state) => state.markClean);

  const handleSave = () => {
    const trimmedName = name.trim() || 'Untitled Canvas';

    const stepsToSave = steps.length > 0 ? steps : undefined;
    const scenariosToSave = scenarios.length > 0 ? scenarios : undefined;
    const presentationsToSave = presentations.length > 0 ? presentations : undefined;
    console.log('[SaveDialog] saving steps:', stepsToSave?.length ?? 0, 'scenarios:', scenariosToSave?.length ?? 0, 'presentations:', presentationsToSave?.length ?? 0);

    let saved: SavedCanvas | null;

    if (existingCanvas && !saveAsNew) {
      // Update existing
      saved = updateCanvas(existingCanvas.id, {
        name: trimmedName,
        nodes,
        edges,
        viewport,
        visualGroups,
        steps: stepsToSave,
        scenarios: scenariosToSave,
        presentations: presentationsToSave,
      });
    } else {
      // Save as new
      saved = saveCanvas({
        name: trimmedName,
        nodes,
        edges,
        viewport,
        visualGroups,
        steps: stepsToSave,
        scenarios: scenariosToSave,
        presentations: presentationsToSave,
      });
    }

    if (saved) {
      console.log('[SaveDialog] saved canvas steps:', saved.steps?.length ?? 0);
      // Mark as clean (no unsaved changes)
      markClean();
      onSave(saved);
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {existingCanvas && !saveAsNew ? t('dialogs.saveCanvas') : t('dialogs.saveAs')}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('dialogs.canvasName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dialogs.enterName')}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') onClose();
              }}
            />
          </div>

          {existingCanvas && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsNew}
                onChange={(e) => setSaveAsNew(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('dialogs.saveAsNew')}</span>
            </label>
          )}

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('dialogs.nodesLabel')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{nodes.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500 dark:text-gray-400">{t('dialogs.edgesLabel')}</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{edges.length}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            {t('dialogs.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
          >
            {existingCanvas && !saveAsNew ? t('dialogs.save') : t('dialogs.saveAsNewBtn')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
