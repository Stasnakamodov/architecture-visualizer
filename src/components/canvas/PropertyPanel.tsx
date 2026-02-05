'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { AppNode, ShapeNodeData, CommentNodeData, BorderStyle } from '@/types/canvas';

interface PropertyPanelProps {
  className?: string;
  onShowSaved?: () => void;
  onClose?: () => void;
  onExpandNode?: (node: AppNode) => void;
}

const MIN_WIDTH = 60;  // Icon-only mode
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;
const STORAGE_KEY = 'property-panel-width';

// Width breakpoints
const ICON_ONLY_WIDTH = 80;
const COMPACT_WIDTH = 160;

const getStoredWidth = (): number => {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
      return parsed;
    }
  }
  return DEFAULT_WIDTH;
};

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#6b7280', // gray
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#ffffff', // white
  '#000000', // black
];

const BORDER_STYLES: { value: BorderStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'none', label: 'None' },
];

export function PropertyPanel({ className = '', onShowSaved, onClose, onExpandNode }: PropertyPanelProps) {
  // Save button is now in TopBar, not here
  const hasActions = onShowSaved || onClose;
  const {
    nodes,
    selectedNodeId,
    updateShapeProperties,
    setNodes,
    markDirty,
  } = useCanvasStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const isShape = selectedNode?.type === 'shape';
  const isComment = selectedNode?.type === 'comment';
  const shapeData = isShape ? (selectedNode.data as ShapeNodeData) : null;
  const commentData = isComment ? (selectedNode.data as CommentNodeData) : null;

  // Panel resize state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Display mode based on width
  const displayMode = useMemo(() => {
    if (width <= ICON_ONLY_WIDTH) return 'icon';
    if (width <= COMPACT_WIDTH) return 'compact';
    return 'full';
  }, [width]);

  const isIconMode = displayMode === 'icon';
  const isCompactMode = displayMode === 'compact';

  // Load saved width on mount
  useEffect(() => {
    setWidth(getStoredWidth());
  }, []);

  // Save width to localStorage when it changes (debounced)
  useEffect(() => {
    if (isResizing) return; // Don't save while dragging
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, String(width));
    }, 100);
    return () => clearTimeout(timer);
  }, [width, isResizing]);

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setIsResizing(true);
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    // Prevent text selection and set cursor globally
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta from start position (dragging left = positive delta = wider panel)
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Local state for inputs
  const [label, setLabel] = useState('');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [borderColor, setBorderColor] = useState('#3b82f6');
  const [borderStyle, setBorderStyle] = useState<BorderStyle>('solid');

  // Comment-specific state
  const [commentLabel, setCommentLabel] = useState('');
  const [commentContent, setCommentContent] = useState('');

  // Sync local state with selected node
  useEffect(() => {
    if (shapeData) {
      setLabel(shapeData.label || '');
      setFillColor(shapeData.fillColor || '#ffffff');
      setBorderColor(shapeData.borderColor || '#3b82f6');
      setBorderStyle(shapeData.borderStyle || 'solid');
    }
    if (commentData) {
      setCommentLabel(commentData.label || '');
      setCommentContent(commentData.content || commentData.fullContent || '');
    }
  }, [shapeData, commentData, selectedNodeId]);

  // Update handlers
  const handleLabelChange = (value: string) => {
    setLabel(value);
    if (selectedNodeId && isShape) {
      updateShapeProperties(selectedNodeId, { label: value });
    }
  };

  const handleFillColorChange = (value: string) => {
    setFillColor(value);
    if (selectedNodeId && isShape) {
      updateShapeProperties(selectedNodeId, { fillColor: value });
    }
  };

  const handleBorderColorChange = (value: string) => {
    setBorderColor(value);
    if (selectedNodeId && isShape) {
      updateShapeProperties(selectedNodeId, { borderColor: value });
    }
  };

  const handleBorderStyleChange = (value: BorderStyle) => {
    setBorderStyle(value);
    if (selectedNodeId && isShape) {
      updateShapeProperties(selectedNodeId, { borderStyle: value });
    }
  };

  // Comment update handlers
  const handleCommentLabelChange = (value: string) => {
    setCommentLabel(value);
    if (selectedNodeId && isComment) {
      const updatedNodes = nodes.map(n => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: { ...n.data, label: value },
          };
        }
        return n;
      });
      setNodes(updatedNodes as AppNode[]);
      markDirty();
    }
  };

  const handleCommentContentChange = (value: string) => {
    setCommentContent(value);
    if (selectedNodeId && isComment) {
      const updatedNodes = nodes.map(n => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: { ...n.data, content: value, fullContent: value },
          };
        }
        return n;
      });
      setNodes(updatedNodes as AppNode[]);
      markDirty();
    }
  };

  // Action buttons header (Save button is now in TopBar, not here)
  const ActionButtons = hasActions && (
    <div className={`border-b border-gray-200 dark:border-gray-700 flex items-center ${isIconMode ? 'flex-col p-2 gap-2' : 'p-2 gap-2 justify-end'}`}>
      {onShowSaved && (
        <button
          onClick={onShowSaved}
          className={`bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors ${
            isIconMode ? 'w-10 h-10 rounded-xl flex items-center justify-center' : 'p-1.5 rounded-lg'
          }`}
          title="Saved canvases"
        >
          <svg className={isIconMode ? 'w-5 h-5' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className={`bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-500 transition-colors ${
            isIconMode ? 'w-10 h-10 rounded-xl flex items-center justify-center' : 'p-1.5 rounded-lg'
          }`}
          title="Close"
        >
          <svg className={isIconMode ? 'w-5 h-5' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  // Resize handle with wider hit area
  const ResizeHandle = (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize group z-10"
      style={{ marginLeft: '-6px' }}
    >
      {/* Visual indicator line */}
      <div
        className={`absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 transition-all duration-150 ${
          isResizing
            ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
            : isHovering
            ? 'bg-blue-400'
            : 'bg-gray-300 dark:bg-gray-600'
        }`}
      />
      {/* Grip handle - always visible */}
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 p-1 rounded transition-all ${
        isResizing
          ? 'bg-blue-500'
          : isHovering
          ? 'bg-blue-400'
          : 'bg-gray-300 dark:bg-gray-600'
      }`}>
        <div className="w-0.5 h-3 rounded-full bg-white" />
        <div className="w-0.5 h-3 rounded-full bg-white" />
      </div>
    </div>
  );

  if (!selectedNode) {
    return (
      <div
        ref={panelRef}
        style={{ width }}
        className={`relative bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col ${className}`}
      >
        {ResizeHandle}
        {ActionButtons}
        <div className={`flex-1 flex items-center justify-center text-gray-400 ${isIconMode ? 'p-2' : 'p-4'}`}>
          <div className="text-center">
            <svg className={`mx-auto mb-2 text-gray-300 ${isIconMode ? 'w-6 h-6' : 'w-10 h-10'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            {!isIconMode && <p className={`${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Select a node</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!isShape) {
    return (
      <div
        ref={panelRef}
        style={{ width }}
        className={`relative bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col ${className}`}
      >
        {ResizeHandle}
        {ActionButtons}
        <div className={isIconMode ? 'p-2' : 'p-3 flex-1 overflow-y-auto'}>
        {isIconMode ? (
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 ${isComment ? 'bg-amber-50' : 'bg-blue-50'} rounded-xl flex items-center justify-center`} title={selectedNode.data.label || selectedNode.type}>
              {isComment ? (
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              )}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize font-medium">{selectedNode.type?.slice(0, 4)}</span>
            {/* Expand button in icon mode */}
            {onExpandNode && (
              <button
                onClick={() => onExpandNode(selectedNode)}
                className="w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 rounded-xl flex items-center justify-center transition-colors"
                title="Expand"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header with expand button */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className={`font-semibold text-gray-700 dark:text-gray-300 mb-0.5 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
                  {isComment ? 'Comment' : 'Selected'}
                </h3>
                <p className={`text-gray-500 dark:text-gray-400 capitalize ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>{selectedNode.type}</p>
              </div>
              {onExpandNode && !isCompactMode && (
                <button
                  onClick={() => onExpandNode(selectedNode)}
                  className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                  title="Open in modal"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              )}
            </div>

            {/* Comment editing */}
            {isComment ? (
              <div className="space-y-3">
                <div>
                  <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Title</label>
                  <input
                    type="text"
                    value={commentLabel}
                    onChange={(e) => handleCommentLabelChange(e.target.value)}
                    placeholder="Comment title..."
                    className={`w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}
                  />
                </div>

                {!isCompactMode && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Content</label>
                    <textarea
                      value={commentContent}
                      onChange={(e) => handleCommentContentChange(e.target.value)}
                      placeholder="Write your comment..."
                      rows={4}
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                    <p className="mt-1 text-[10px] text-gray-400">Supports markdown</p>
                  </div>
                )}

                {/* Expand button for full editing */}
                {onExpandNode && (
                  <button
                    onClick={() => onExpandNode(selectedNode)}
                    className="w-full px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Open Full Editor
                  </button>
                )}

                {/* Created date */}
                {commentData?.createdAt && !isCompactMode && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] text-gray-400">
                      Created: {new Date(commentData.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Non-comment, non-shape nodes */
              <div className="space-y-2">
                <div>
                  <label className={`block font-medium text-gray-500 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Label</label>
                  <div className={`px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300 truncate ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
                    {selectedNode.data.label || '(no label)'}
                  </div>
                </div>

                {/* Expand button */}
                {onExpandNode && !isCompactMode && (
                  <button
                    onClick={() => onExpandNode(selectedNode)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Edit Details
                  </button>
                )}

                {!isCompactMode && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Position</label>
                    <div className="flex gap-1">
                      <div className="flex-1 px-2 py-1.5 bg-gray-50 rounded text-xs text-gray-700">
                        X: {Math.round(selectedNode.position.x)}
                      </div>
                      <div className="flex-1 px-2 py-1.5 bg-gray-50 rounded text-xs text-gray-700">
                        Y: {Math.round(selectedNode.position.y)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    );
  }

  // Icon-only mode: show minimal controls
  if (isIconMode) {
    return (
      <div
        ref={panelRef}
        style={{ width }}
        className={`relative bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col ${className}`}
      >
        {ResizeHandle}
        {ActionButtons}
        <div className="p-3 flex flex-col items-center gap-3">
          {/* Shape type icon */}
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center" title={shapeData?.shapeType}>
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
            </svg>
          </div>

          {/* Fill color picker */}
          <div className="relative group">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => handleFillColorChange(e.target.value)}
              className="w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-blue-300 transition-colors"
              title="Fill color"
            />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Fill</span>
          </div>

          {/* Border color picker */}
          <div className="relative group">
            <input
              type="color"
              value={borderColor}
              onChange={(e) => handleBorderColorChange(e.target.value)}
              className="w-10 h-10 rounded-xl border-2 border-gray-300 cursor-pointer hover:border-blue-300 transition-colors"
              title="Border color"
            />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Border</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{ width }}
      className={`relative bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col ${className}`}
    >
      {ResizeHandle}
      {ActionButtons}
      {/* Header */}
      <div className={`border-b border-gray-100 dark:border-gray-800 ${isCompactMode ? 'p-2' : 'p-3'} flex items-center justify-between`}>
        <div>
          <h3 className={`font-semibold text-gray-700 dark:text-gray-300 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Properties</h3>
          <p className={`text-gray-500 dark:text-gray-400 capitalize ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>{shapeData?.shapeType}</p>
        </div>
        {onExpandNode && !isCompactMode && (
          <button
            onClick={() => onExpandNode(selectedNode)}
            className="p-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
            title="Open in modal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        )}
      </div>

      <div className={`space-y-3 ${isCompactMode ? 'p-2' : 'p-3 space-y-4'}`}>
        {/* Label */}
        <div>
          <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Label..."
            className={`w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}
          />
        </div>

        {/* Fill Color */}
        <div>
          <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Fill</label>
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => handleFillColorChange(e.target.value)}
              className={`rounded border border-gray-200 cursor-pointer ${isCompactMode ? 'w-6 h-6' : 'w-7 h-7'}`}
            />
            {!isCompactMode && (
              <input
                type="text"
                value={fillColor}
                onChange={(e) => handleFillColorChange(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
          <div className={`flex flex-wrap gap-1 mt-1 ${isCompactMode ? 'gap-0.5' : ''}`}>
            {PRESET_COLORS.slice(0, isCompactMode ? 5 : 10).map((color) => (
              <button
                key={`fill-${color}`}
                onClick={() => handleFillColorChange(color)}
                className={`rounded border transition-transform hover:scale-110 ${
                  fillColor === color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'
                } ${isCompactMode ? 'w-4 h-4' : 'w-5 h-5'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Border Color */}
        <div>
          <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Border</label>
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={borderColor}
              onChange={(e) => handleBorderColorChange(e.target.value)}
              className={`rounded border border-gray-200 cursor-pointer ${isCompactMode ? 'w-6 h-6' : 'w-7 h-7'}`}
            />
            {!isCompactMode && (
              <input
                type="text"
                value={borderColor}
                onChange={(e) => handleBorderColorChange(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            )}
          </div>
          <div className={`flex flex-wrap gap-1 mt-1 ${isCompactMode ? 'gap-0.5' : ''}`}>
            {PRESET_COLORS.slice(0, isCompactMode ? 5 : 10).map((color) => (
              <button
                key={`border-${color}`}
                onClick={() => handleBorderColorChange(color)}
                className={`rounded border transition-transform hover:scale-110 ${
                  borderColor === color ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-200'
                } ${isCompactMode ? 'w-4 h-4' : 'w-5 h-5'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Border Style */}
        <div>
          <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>Style</label>
          <div className={`flex ${isCompactMode ? 'flex-col gap-0.5' : 'gap-0.5'}`}>
            {BORDER_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => handleBorderStyleChange(style.value)}
                className={`px-2 py-1 rounded border transition-colors ${
                  borderStyle === style.value
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${isCompactMode ? 'text-[10px]' : 'text-xs flex-1'}`}
              >
                {isCompactMode ? style.label.charAt(0) : style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Position (read-only) - hide in compact */}
        {!isCompactMode && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Position</label>
            <div className="flex gap-1">
              <div className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                X: {Math.round(selectedNode.position.x)}
              </div>
              <div className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                Y: {Math.round(selectedNode.position.y)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
