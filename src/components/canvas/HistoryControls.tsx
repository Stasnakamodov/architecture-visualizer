'use client';

import { useCanvasStore } from '@/stores/canvasStore';
import { useTemporalStore } from './useTemporalStore';

interface HistoryControlsProps {
  className?: string;
}

export function HistoryControls({ className = '' }: HistoryControlsProps) {
  const { undo, redo, pastStates, futureStates } = useTemporalStore();

  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => undo()}
        disabled={!canUndo}
        className={`
          p-2 rounded-lg transition-colors
          ${canUndo
            ? 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10h10a5 5 0 0 1 5 5v2" />
          <path d="M3 10l5-5M3 10l5 5" />
        </svg>
      </button>

      <button
        onClick={() => redo()}
        disabled={!canRedo}
        className={`
          p-2 rounded-lg transition-colors
          ${canRedo
            ? 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10H11a5 5 0 0 0-5 5v2" />
          <path d="M21 10l-5-5M21 10l-5 5" />
        </svg>
      </button>
    </div>
  );
}
