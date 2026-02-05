'use client';

import { useEffect, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

export function SaveStatus() {
  const { saveStatus, lastSavedAt, saveError, _hasHydrated } = useCanvasStore();
  const [showSaved, setShowSaved] = useState(false);

  // Show "Saved" briefly after save completes
  useEffect(() => {
    if (saveStatus === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus, lastSavedAt]);

  // Don't render during SSR or before hydration
  if (!_hasHydrated) {
    return null;
  }

  // Format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (saveStatus === 'saving') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (saveStatus === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500" title={saveError || 'Save failed'}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{saveError || 'Save failed'}</span>
      </div>
    );
  }

  if (showSaved || (saveStatus === 'saved' && lastSavedAt)) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Saved {lastSavedAt && formatTime(lastSavedAt)}</span>
      </div>
    );
  }

  // Idle - show last saved time if available
  if (lastSavedAt) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        <span>Last saved {formatTime(lastSavedAt)}</span>
      </div>
    );
  }

  return null;
}
