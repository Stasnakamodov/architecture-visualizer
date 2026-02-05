'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { GroupNodeData } from '@/types/canvas';

type GroupNodeType = Node<GroupNodeData & { fullContent?: string }, 'group'>;

export const GroupNode = memo(({ data, selected }: NodeProps<GroupNodeType>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const borderColor = data.color || (selected ? '#6b7280' : '#d1d5db');

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
        minWidth={200}
        minHeight={100}
        lineClassName="!border-gray-400"
        handleClassName="!w-2 !h-2 !bg-gray-500 !border-white"
      />
      <div
        className={`px-4 py-3 rounded-lg border-2 border-dashed bg-gray-50/50 h-full transition-all duration-200 ${selected ? 'shadow-xl ring-2 ring-gray-400 ring-offset-2 bg-gray-100/50' : ''}`}
        style={{ borderColor }}
        onDoubleClick={handleDoubleClick}
      >
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white" />
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white" />

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="flex-1 font-medium text-sm text-gray-700 resize-none border-none outline-none bg-gray-100 rounded px-1"
              rows={1}
            />
          ) : (
            <span className="font-medium text-sm text-gray-700 break-words">{data.label}</span>
          )}
        </div>

        {data.description && !isEditing && (
          <p className="text-xs text-gray-500 mt-2">{data.description}</p>
        )}

        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white" />
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-gray-500 !border-2 !border-white" />
      </div>
    </>
  );
});

GroupNode.displayName = 'GroupNode';
