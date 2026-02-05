'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { TechNodeData } from '@/types/canvas';

type TechNodeType = Node<TechNodeData & { fullContent?: string }, 'tech'>;

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
  PATCH: 'bg-purple-100 text-purple-700',
};

export const TechNode = memo(({ data, selected, id }: NodeProps<TechNodeType>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const borderColor = data.color || (selected ? '#3b82f6' : '#bfdbfe');

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

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.label);
    }
  }, [data.label]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineClassName="!border-blue-400"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border-white"
      />
      <div
        className={`
          px-3 py-2 rounded-lg border-2 bg-white dark:bg-gray-900 h-full
          transition-all duration-200
          ${selected ? 'shadow-xl ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900' : 'shadow-sm dark:shadow-gray-950'}
        `}
        style={{ borderColor }}
        onDoubleClick={handleDoubleClick}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-500 !border-white" />
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500 !border-white" />

        <div className="flex items-center gap-2">
          {data.fullContent ? (
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ) : (
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-medium resize-none border-none outline-none bg-blue-50 rounded px-1"
              rows={1}
            />
          ) : (
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 break-words">{data.label}</span>
          )}
        </div>

        {data.method && !isEditing && (
          <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block font-mono ${methodColors[data.method] || 'bg-gray-100 text-gray-700'}`}>
            {data.method}
          </span>
        )}

        {data.description && !isEditing && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{data.description}</p>
        )}

        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-500 !border-white" />
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500 !border-white" />
      </div>
    </>
  );
});

TechNode.displayName = 'TechNode';
