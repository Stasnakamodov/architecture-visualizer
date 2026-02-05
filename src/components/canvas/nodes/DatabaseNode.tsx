'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { DatabaseNodeData } from '@/types/canvas';

type DatabaseNodeType = Node<DatabaseNodeData & { fullContent?: string }, 'database'>;

export const DatabaseNode = memo(({ data, selected }: NodeProps<DatabaseNodeType>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const borderColor = data.color || (selected ? '#8b5cf6' : '#ddd6fe');

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // If node has full content, let the modal handle it
    if (data.fullContent) return;
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(data.label);
  }, [data.label, data.fullContent]);

  const handleBlur = useCallback(() => setIsEditing(false), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setIsEditing(false); }
    if (e.key === 'Escape') { setIsEditing(false); setEditValue(data.label); }
  }, [data.label]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineClassName="!border-purple-400"
        handleClassName="!w-2 !h-2 !bg-purple-500 !border-white"
      />
      <div
        className={`px-3 py-2 rounded-lg border-2 bg-white h-full transition-all duration-200 ${selected ? 'shadow-xl ring-2 ring-purple-400 ring-offset-2' : 'shadow-sm'}`}
        style={{ borderColor }}
        onDoubleClick={handleDoubleClick}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-purple-500 !border-white" />
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-purple-500 !border-white" />

        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
              <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
              <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
            </svg>
            {data.fullContent && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-white" />
            )}
          </div>
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-medium resize-none border-none outline-none bg-purple-50 rounded px-1"
              rows={1}
            />
          ) : (
            <span className="font-medium text-sm text-gray-900 break-words">{data.label}</span>
          )}
        </div>

        {data.columns && data.columns.length > 0 && !isEditing && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.columns.slice(0, 3).map((col) => (
              <span key={col} className="text-xs px-1.5 py-0.5 bg-purple-50 rounded text-purple-700">{col}</span>
            ))}
            {data.columns.length > 3 && <span className="text-xs text-gray-400">+{data.columns.length - 3}</span>}
          </div>
        )}

        {data.description && !isEditing && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{data.description}</p>
        )}

        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-purple-500 !border-white" />
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-purple-500 !border-white" />
      </div>
    </>
  );
});

DatabaseNode.displayName = 'DatabaseNode';
