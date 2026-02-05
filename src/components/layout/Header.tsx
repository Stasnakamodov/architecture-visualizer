'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCanvasStore } from '@/stores/canvasStore';
import { DataBackup } from '@/components/ui/DataBackup';

export function Header() {
  const pathname = usePathname();
  const {
    isCanvasOpen,
    currentCanvasName,
    isDirty,
    lastNamedSaveAt,
    saveStatus,
    _hasHydrated,
    setRequestSaveDialog,
    closeCanvas,
  } = useCanvasStore();

  // Check if we're on the import page with canvas open
  const showCanvasUI = pathname === '/import' && isCanvasOpen;

  // Format time helper
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render save status
  const renderSaveStatus = () => {
    if (!_hasHydrated && !isCanvasOpen) {
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
          <span>Saving...</span>
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
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  const handleBack = () => {
    // This will trigger the unsaved changes dialog in import/page.tsx
    // by setting a flag or navigating away
    closeCanvas();
  };

  const handleSave = () => {
    setRequestSaveDialog(true);
  };

  return (
    <header className="border-b border-gray-200 bg-white h-12 sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
              />
            </svg>
            <span className="font-semibold text-sm">ArchViz</span>
          </Link>

          {/* Canvas-specific UI */}
          {showCanvasUI && (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {/* Separator */}
              <div className="w-px h-5 bg-gray-200" />

              {/* Canvas name + status */}
              <div className="flex items-center gap-2">
                {currentCanvasName ? (
                  <span className="text-sm font-medium text-gray-800">{currentCanvasName}</span>
                ) : (
                  <span className="text-sm text-gray-500 italic">Untitled</span>
                )}
                <div className="w-px h-4 bg-gray-200" />
                {renderSaveStatus()}
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                  isDirty
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>
            </>
          )}
        </div>

        {/* Right side */}
        <nav className="flex items-center gap-4 text-sm">
          <DataBackup />
          <Link href="/projects" className="text-gray-500 hover:text-gray-900">
            Projects
          </Link>
          <Link href="/import" className="text-blue-600 hover:text-blue-700 font-medium">
            Import
          </Link>
        </nav>
      </div>
    </header>
  );
}
