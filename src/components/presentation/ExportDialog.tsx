'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/context';
import { useCanvasStore } from '@/stores/canvasStore';
import type { Presentation } from '@/types/canvas';

interface ExportDialogProps {
  presentation: Presentation;
  onClose: () => void;
}

export function ExportDialog({ presentation, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const [includeCaptions, setIncludeCaptions] = useState(true);
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(false);
  const [includeNodeSlides, setIncludeNodeSlides] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | null>(null);

  const handleExport = useCallback(async (format: 'png' | 'pdf') => {
    setIsExporting(true);
    setExportFormat(format);

    try {
      const { exportPresentationPNG, exportPresentationPDF } = await import('@/lib/export/presentationExport');
      const { scenarios, nodes } = useCanvasStore.getState();

      // Apply step callback: highlights nodes and sets viewport before capture
      const applyStepForExport = (step: { nodeIds: string[]; viewport?: { x: number; y: number; zoom: number } | null }, _scenarioId: string) => {
        const highlightedIds = new Set(step.nodeIds);
        const updatedNodes = nodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            opacity: highlightedIds.size === 0 || highlightedIds.has(node.id) ? 1 : 0.15,
          },
        }));
        useCanvasStore.setState({ nodes: updatedNodes });
      };

      let blob: Blob;
      if (format === 'png') {
        blob = await exportPresentationPNG(presentation, scenarios, applyStepForExport, { includeNodeSlides });
      } else {
        blob = await exportPresentationPDF(presentation, scenarios, {
          includeCaptions,
          includeSpeakerNotes,
          includeNodeSlides,
        }, applyStepForExport);
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${presentation.name}.${format === 'png' ? 'zip' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, [presentation, includeCaptions, includeSpeakerNotes, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-[400px] max-w-[90vw]"
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t('presentation.exportTitle')}
          </h2>

          {/* Format selection */}
          <div className="space-y-2 mb-4">
            <button
              onClick={() => handleExport('png')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('presentation.exportPNG')}
                </p>
                <p className="text-xs text-gray-400">
                  {isExporting && exportFormat === 'png' ? t('presentation.exporting') : 'ZIP archive with slides'}
                </p>
              </div>
              {isExporting && exportFormat === 'png' && (
                <svg className="w-4 h-4 animate-spin ml-auto text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('presentation.exportPDF')}
                </p>
                <p className="text-xs text-gray-400">
                  {isExporting && exportFormat === 'pdf' ? t('presentation.exporting') : 'PDF document'}
                </p>
              </div>
              {isExporting && exportFormat === 'pdf' && (
                <svg className="w-4 h-4 animate-spin ml-auto text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </button>
          </div>

          {/* Options */}
          <div className="space-y-2 mb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCaptions}
                onChange={e => setIncludeCaptions(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">{t('presentation.includeCaption')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSpeakerNotes}
                onChange={e => setIncludeSpeakerNotes(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">{t('presentation.includeSpeakerNotes')} (PDF)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNodeSlides}
                onChange={e => setIncludeNodeSlides(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Include node slides</span>
            </label>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={isExporting}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {t('presentation.cancel')}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
