'use client';

import { useCanvasStore } from '@/stores/canvasStore';

interface CanvasTopBarProps {
  canvasName?: string | null;
  onBack: () => void;
  onSave?: () => void;
}

export function CanvasTopBar({ canvasName, onBack, onSave }: CanvasTopBarProps) {
  const { isDirty, lastNamedSaveAt, saveStatus, _hasHydrated } = useCanvasStore();

  // Format time helper
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine save status display
  const renderSaveStatus = () => {
    // Show loading state before hydration
    if (!_hasHydrated) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <div className="w-2 h-2 border border-gray-300 border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      );
    }

    if (saveStatus === 'saving') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-blue-500">
          <div className="w-2 h-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>Auto-saving...</span>
        </div>
      );
    }

    if (isDirty) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span>Unsaved</span>
        </div>
      );
    }

    if (lastNamedSaveAt) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved {formatTime(lastNamedSaveAt)}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <span>Not saved</span>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-3 py-2">
        {/* Left side: Back button */}
        <div className="pointer-events-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* Center: Canvas name + status */}
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-md dark:shadow-gray-950 border border-gray-200 dark:border-gray-700 min-w-[200px]">
          {canvasName ? (
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{canvasName}</span>
          ) : (
            <span className="text-sm text-gray-500 italic">Untitled</span>
          )}
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          {renderSaveStatus()}
        </div>

        {/* Right side: Save button */}
        <div className="pointer-events-auto">
          {onSave && (
            <button
              onClick={onSave}
              disabled={!isDirty}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm transition-colors text-sm font-medium ${
                isDirty
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
