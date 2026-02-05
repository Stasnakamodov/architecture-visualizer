'use client';

import { memo, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { ShapeType } from '@/types/canvas';

interface ShapeToolbarProps {
  className?: string;
}

interface ShapeButton {
  type: ShapeType;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const shapeButtons: ShapeButton[] = [
  {
    type: 'rectangle',
    label: 'Rectangle',
    shortcut: 'R',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="0" />
      </svg>
    ),
  },
  {
    type: 'rounded',
    label: 'Rounded',
    shortcut: 'U',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="4" />
      </svg>
    ),
  },
  {
    type: 'diamond',
    label: 'Diamond',
    shortcut: 'D',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12,2 22,12 12,22 2,12" />
      </svg>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    shortcut: 'T',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <text x="6" y="17" fontSize="14" fontWeight="bold" fill="currentColor" stroke="none">T</text>
      </svg>
    ),
  },
];

export const ShapeToolbar = memo(({ className = '' }: ShapeToolbarProps) => {
  const { activeTool, pendingShapeType, setActiveTool, setPendingShapeType } = useCanvasStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleShapeClick = (shapeType: ShapeType) => {
    if (activeTool === 'shape' && pendingShapeType === shapeType) {
      setActiveTool('select');
      setPendingShapeType(null);
    } else {
      setActiveTool('shape');
      setPendingShapeType(shapeType);
    }
  };

  const isShapeActive = (shapeType: ShapeType) => {
    return activeTool === 'shape' && pendingShapeType === shapeType;
  };

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className={`p-1.5 bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-gray-950 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${className}`}
        title="Show tools"
      >
        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col gap-0.5 p-1.5 bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-gray-950 border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {/* Collapse button */}
      <button
        onClick={() => setIsCollapsed(true)}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors self-end"
        title="Hide tools"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Select tool */}
      <button
        onClick={() => {
          setActiveTool('select');
          setPendingShapeType(null);
        }}
        className={`p-1.5 rounded transition-colors relative group ${
          activeTool === 'select'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
        title="Select (V)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          Select (V)
        </span>
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-0.5" />

      {/* Shape buttons */}
      {shapeButtons.map((shape) => (
        <button
          key={shape.type}
          onClick={() => handleShapeClick(shape.type)}
          className={`p-1.5 rounded transition-colors relative group ${
            isShapeActive(shape.type)
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 ring-1 ring-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title={`${shape.label} (${shape.shortcut})`}
        >
          {shape.icon}
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {shape.label} ({shape.shortcut})
          </span>
        </button>
      ))}
    </div>
  );
});

ShapeToolbar.displayName = 'ShapeToolbar';
