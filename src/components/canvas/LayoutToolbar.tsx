'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { LayoutType, LayoutDirection } from '@/lib/layout';

interface LayoutToolbarProps {
  onApplyLayout: (type: LayoutType, direction?: LayoutDirection) => void;
  className?: string;
}

const layouts: { type: LayoutType; icon: React.ReactNode; label: string }[] = [
  {
    type: 'hierarchical',
    label: 'Tree',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="2" width="6" height="4" rx="1" />
        <rect x="3" y="18" width="6" height="4" rx="1" />
        <rect x="15" y="18" width="6" height="4" rx="1" />
        <path d="M12 6v4M6 14v4M18 14v4M6 14h12" />
      </svg>
    ),
  },
  {
    type: 'force',
    label: 'Force',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="2" />
        <circle cx="6" cy="6" r="1.5" />
        <circle cx="18" cy="6" r="1.5" />
        <circle cx="6" cy="18" r="1.5" />
        <circle cx="18" cy="18" r="1.5" />
        <path d="M10 10L7 7M14 10l3-3M10 14l-3 3M14 14l3 3" />
      </svg>
    ),
  },
  {
    type: 'circular',
    label: 'Circle',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
        <circle cx="12" cy="4" r="1.5" />
        <circle cx="4" cy="12" r="1.5" />
        <circle cx="20" cy="12" r="1.5" />
        <circle cx="12" cy="20" r="1.5" />
      </svg>
    ),
  },
  {
    type: 'grid',
    label: 'Grid',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <rect x="15" y="15" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    type: 'presentation',
    label: 'Presentation',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {/* Section 1 */}
        <rect x="3" y="2" width="18" height="5" rx="1" />
        {/* Section 2 */}
        <rect x="3" y="9" width="18" height="5" rx="1" />
        {/* Section 3 */}
        <rect x="3" y="16" width="18" height="5" rx="1" />
        {/* Cards indicators */}
        <line x1="9" y1="4.5" x2="9" y2="4.5" strokeLinecap="round" />
        <line x1="12" y1="4.5" x2="12" y2="4.5" strokeLinecap="round" />
        <line x1="15" y1="4.5" x2="15" y2="4.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const directions: { value: LayoutDirection; icon: string; label: string }[] = [
  { value: 'TB', icon: '↓', label: 'Top to Bottom' },
  { value: 'LR', icon: '→', label: 'Left to Right' },
  { value: 'BT', icon: '↑', label: 'Bottom to Top' },
  { value: 'RL', icon: '←', label: 'Right to Left' },
];

export function LayoutToolbar({ onApplyLayout, className = '' }: LayoutToolbarProps) {
  const [showDirections, setShowDirections] = useState(false);
  const { preLayoutPositions, resetToPreLayout } = useCanvasStore();
  const canReset = preLayoutPositions !== null;

  const handleLayoutClick = (type: LayoutType) => {
    if (type === 'hierarchical') {
      setShowDirections(!showDirections);
    } else {
      onApplyLayout(type);
      setShowDirections(false);
    }
  };

  const handleDirectionClick = (direction: LayoutDirection) => {
    onApplyLayout('hierarchical', direction);
    setShowDirections(false);
  };

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      {/* Layout buttons */}
      {layouts.map((layout) => (
        <button
          key={layout.type}
          onClick={() => handleLayoutClick(layout.type)}
          className={`
            p-2 rounded-lg transition-all group relative
            ${layout.type === 'hierarchical' && showDirections
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }
          `}
          title={layout.label}
        >
          {layout.icon}
          {/* Tooltip */}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {layout.label}
          </span>
        </button>
      ))}

      {/* Reset button */}
      {canReset && (
        <>
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          <button
            onClick={resetToPreLayout}
            className="p-2 rounded-lg transition-all hover:bg-amber-100 text-amber-600 hover:text-amber-700 group relative"
            title="Reset to original"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Reset
            </span>
          </button>
        </>
      )}

      {/* Direction picker for hierarchical */}
      {showDirections && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDirections(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 z-50">
            <div className="text-xs text-gray-500 px-2 py-1 mb-1">Direction</div>
            <div className="flex gap-1">
              {directions.map((dir) => (
                <button
                  key={dir.value}
                  onClick={() => handleDirectionClick(dir.value)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors text-lg"
                  title={dir.label}
                >
                  {dir.icon}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
