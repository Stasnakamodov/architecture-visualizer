'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { BusinessNodeData } from '@/types/canvas';

type BusinessNodeType = Node<BusinessNodeData & { fullContent?: string }, 'business'>;

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  planned: 'bg-yellow-100 text-yellow-700',
  deprecated: 'bg-red-100 text-red-700',
};

export const BusinessNode = memo(({ data, selected }: NodeProps<BusinessNodeType>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const borderColor = data.color || (selected ? '#6366f1' : '#c7d2fe');

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
        minWidth={160}
        minHeight={80}
        lineClassName="!border-indigo-400"
        handleClassName="!w-2 !h-2 !bg-indigo-500 !border-white"
      />
      <div
        className={`px-4 py-3 rounded-xl border-2 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950 dark:to-gray-900 h-full transition-all duration-200 ${selected ? 'shadow-xl ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900' : 'shadow-sm dark:shadow-gray-950'}`}
        style={{ borderColor }}
        onDoubleClick={handleDoubleClick}
      >
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />

        <div className="flex items-start gap-2">
          {data.fullContent && (
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 font-semibold text-indigo-900 resize-none border-none outline-none bg-indigo-50 rounded px-1"
              rows={1}
            />
          ) : (
            <div className="font-semibold text-indigo-900 dark:text-indigo-200 break-words">{data.label}</div>
          )}
        </div>

        {data.status && !isEditing && (
          <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${statusStyles[data.status] || 'bg-gray-100 text-gray-700'}`}>
            {data.status}
          </span>
        )}

        {data.metric && !isEditing && (
          <div className="mt-2 text-lg font-bold text-indigo-600">{data.metric}</div>
        )}

        {data.description && !isEditing && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{data.description}</p>
        )}

        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white" />
      </div>
    </>
  );
});

BusinessNode.displayName = 'BusinessNode';
