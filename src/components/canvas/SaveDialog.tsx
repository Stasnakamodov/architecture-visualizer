'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { saveCanvas, updateCanvas, type SavedCanvas, type VisualGroup } from '@/lib/storage/localStorage';
import { useCanvasStore } from '@/stores/canvasStore';
import type { AppNode, AppEdge } from '@/types/canvas';

interface SaveDialogProps {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
  visualGroups?: VisualGroup[];
  existingCanvas?: SavedCanvas | null;
  onSave: (canvas: SavedCanvas) => void;
  onClose: () => void;
}

export function SaveDialog({
  nodes,
  edges,
  viewport,
  visualGroups = [],
  existingCanvas,
  onSave,
  onClose,
}: SaveDialogProps) {
  const [name, setName] = useState(existingCanvas?.name || '');
  const [saveAsNew, setSaveAsNew] = useState(false);
  const markClean = useCanvasStore((state) => state.markClean);

  const handleSave = () => {
    const trimmedName = name.trim() || 'Untitled Canvas';

    let saved: SavedCanvas | null;

    if (existingCanvas && !saveAsNew) {
      // Update existing
      saved = updateCanvas(existingCanvas.id, {
        name: trimmedName,
        nodes,
        edges,
        viewport,
        visualGroups,
      });
    } else {
      // Save as new
      saved = saveCanvas({
        name: trimmedName,
        nodes,
        edges,
        viewport,
        visualGroups,
      });
    }

    if (saved) {
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {existingCanvas && !saveAsNew ? 'Save Canvas' : 'Save As'}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Canvas Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter canvas name..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <span className="text-sm text-gray-600">Save as new canvas</span>
            </label>
          )}

          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Nodes</span>
              <span className="font-medium text-gray-900">{nodes.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Edges</span>
              <span className="font-medium text-gray-900">{edges.length}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
          >
            {existingCanvas && !saveAsNew ? 'Save' : 'Save As New'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
