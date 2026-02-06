'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import { useTheme } from 'next-themes';
import { useCanvasStore } from '@/stores/canvasStore';
import type { ShapeNodeData } from '@/types/canvas';

type ShapeNodeType = Node<ShapeNodeData, 'shape'>;

// Default color palette for shapes
export const SHAPE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#6b7280', // gray
  '#06b6d4', // cyan
  '#ec4899', // pink
];

// Default fill colors per theme — used to detect "default" fill and adapt to theme
const LIGHT_DEFAULT_FILL = '#ffffff';
const DARK_DEFAULT_FILL = '#1f2937'; // gray-800

export const ShapeNode = memo(({ data, selected, id }: NodeProps<ShapeNodeType>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const updateShapeProperties = useCanvasStore((state) => state.updateShapeProperties);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { shapeType, fillColor: rawFillColor, borderColor, borderStyle, width, height } = data;

  // Adapt default white fill to dark theme
  const fillColor = (rawFillColor === LIGHT_DEFAULT_FILL && isDark) ? DARK_DEFAULT_FILL
    : (rawFillColor === DARK_DEFAULT_FILL && !isDark) ? LIGHT_DEFAULT_FILL
    : rawFillColor;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync local state when data changes from outside
  useEffect(() => {
    if (!isEditing) {
      setEditValue(data.label);
    }
  }, [data.label, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(data.label);
  }, [data.label]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    // Save to store if changed
    if (editValue !== data.label) {
      updateShapeProperties(id, { label: editValue });
    }
  }, [editValue, data.label, id, updateShapeProperties]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      // Save to store if changed
      if (editValue !== data.label) {
        updateShapeProperties(id, { label: editValue });
      }
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.label);
    }
  }, [data.label, editValue, id, updateShapeProperties]);

  // Get border style CSS
  const getBorderStyleCSS = () => {
    if (borderStyle === 'none') return 'none';
    if (borderStyle === 'dashed') return '2px dashed';
    return '2px solid';
  };

  // Common handle styles
  const handleClass = `!w-2 !h-2 !border-white dark:!border-gray-900`;
  const handleStyle = { backgroundColor: borderColor };

  // Render content (label + editing)
  const renderContent = () => {
    if (isEditing) {
      return (
        <textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full text-sm font-medium resize-none border-none outline-none bg-transparent text-center text-gray-900 dark:text-gray-100"
          style={{ minHeight: '20px' }}
        />
      );
    }

    if (shapeType === 'text') {
      return (
        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 text-center break-words">
          {data.label || 'Double-click to edit'}
        </span>
      );
    }

    return data.label ? (
      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 text-center break-words px-2">
        {data.label}
      </span>
    ) : null;
  };

  // Common wrapper for all shapes
  const wrapperClass = `
    flex items-center justify-center h-full w-full
    transition-all duration-200
    ${selected ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900' : ''}
  `;

  // Render shape based on type
  const renderShape = () => {
    switch (shapeType) {
      case 'rectangle':
        return (
          <div
            className={wrapperClass}
            style={{
              backgroundColor: fillColor,
              border: getBorderStyleCSS(),
              borderColor: borderStyle !== 'none' ? borderColor : undefined,
            }}
            onDoubleClick={handleDoubleClick}
          >
            {renderContent()}
          </div>
        );

      case 'rounded':
        return (
          <div
            className={`${wrapperClass} rounded-xl`}
            style={{
              backgroundColor: fillColor,
              border: getBorderStyleCSS(),
              borderColor: borderStyle !== 'none' ? borderColor : undefined,
            }}
            onDoubleClick={handleDoubleClick}
          >
            {renderContent()}
          </div>
        );

      case 'diamond':
        return (
          <div className="relative w-full h-full" onDoubleClick={handleDoubleClick}>
            {/* Diamond shape using CSS transform */}
            <div
              className={`absolute inset-[15%] transform rotate-45 ${selected ? 'ring-2 ring-blue-400 dark:ring-offset-gray-900' : ''}`}
              style={{
                backgroundColor: fillColor,
                border: getBorderStyleCSS(),
                borderColor: borderStyle !== 'none' ? borderColor : undefined,
              }}
            />
            {/* Content overlay (not rotated) */}
            <div className="absolute inset-0 flex items-center justify-center">
              {renderContent()}
            </div>
          </div>
        );

      case 'text':
        return (
          <div
            className={`${wrapperClass} bg-transparent`}
            onDoubleClick={handleDoubleClick}
          >
            {renderContent()}
          </div>
        );

      default:
        return (
          <div
            className={wrapperClass}
            style={{
              backgroundColor: fillColor,
              border: getBorderStyleCSS(),
              borderColor: borderStyle !== 'none' ? borderColor : undefined,
            }}
            onDoubleClick={handleDoubleClick}
          >
            {renderContent()}
          </div>
        );
    }
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={shapeType === 'text' ? 50 : 60}
        minHeight={shapeType === 'text' ? 20 : 40}
        lineClassName="!border-blue-400"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border-white"
      />

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        className={handleClass}
        style={handleStyle}
      />
      <Handle
        type="target"
        position={Position.Left}
        className={handleClass}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className={handleClass}
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={handleClass}
        style={handleStyle}
      />

      {/* Shape content */}
      <div
        className="w-full h-full"
        style={{
          minWidth: width || 100,
          minHeight: height || 60,
        }}
      >
        {renderShape()}
      </div>
    </>
  );
});

ShapeNode.displayName = 'ShapeNode';
