'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAllCanvases,
  deleteCanvas,
  duplicateCanvas,
  getStorageStats,
  type SavedCanvas,
} from '@/lib/storage/localStorage';

interface SavedCanvasesProps {
  onLoad: (canvas: SavedCanvas) => void;
  onClose: () => void;
}

export function SavedCanvases({ onLoad, onClose }: SavedCanvasesProps) {
  const [canvases, setCanvases] = useState<SavedCanvas[]>([]);
  const [stats, setStats] = useState({ canvasCount: 0, totalSize: '0 B' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setCanvases(getAllCanvases());
    setStats(getStorageStats());
  }, []);

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      deleteCanvas(id);
      setCanvases(getAllCanvases());
      setStats(getStorageStats());
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateCanvas(id);
    setCanvases(getAllCanvases());
    setStats(getStorageStats());
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    });
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Saved Canvases</h2>
            <p className="text-sm text-gray-500">
              {stats.canvasCount} canvases · {stats.totalSize}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas List */}
        <div className="flex-1 overflow-y-auto p-4">
          {canvases.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-gray-500 mb-2">No saved canvases yet</p>
              <p className="text-sm text-gray-400">Import a folder and save it to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {canvases.map((canvas) => (
                <div
                  key={canvas.id}
                  className="group flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  onClick={() => onLoad(canvas)}
                >
                  {/* Icon */}
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{canvas.name}</h3>
                    <p className="text-sm text-gray-500">
                      {canvas.nodes.length} nodes · {canvas.edges.length} edges
                    </p>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-gray-400 flex-shrink-0">
                    {formatDate(canvas.updatedAt)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDuplicate(canvas.id)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(canvas.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        confirmDelete === canvas.id
                          ? 'bg-red-100 hover:bg-red-200'
                          : 'hover:bg-gray-200'
                      }`}
                      title={confirmDelete === canvas.id ? 'Click again to confirm' : 'Delete'}
                    >
                      <svg
                        className={`w-4 h-4 ${confirmDelete === canvas.id ? 'text-red-600' : 'text-gray-500'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
