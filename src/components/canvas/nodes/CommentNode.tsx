'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import type { CommentNodeData } from '@/types/canvas';

type CommentNodeType = Node<CommentNodeData, 'comment'>;

export const CommentNode = memo(({ data, selected, id }: NodeProps<CommentNodeType>) => {
  const [isEditing, setIsEditing] = useState(!data.label || data.label === 'New Comment');
  const [editValue, setEditValue] = useState(data.label || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editValue, isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(data.label || '');
  }, [data.label]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    // Here you would typically save the value to the store
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(data.label || '');
    }
    // Allow Enter for new lines, Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setIsEditing(false);
    }
  }, [data.label]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={80}
        lineClassName="!border-amber-400"
        handleClassName="!w-2 !h-2 !bg-amber-500 !border-white"
      />
      <div
        className={`
          px-3 py-2 rounded-lg border-2 h-full min-w-[150px]
          bg-gradient-to-br from-amber-50 to-yellow-50
          transition-all duration-200
          ${selected
            ? 'shadow-xl ring-2 ring-amber-400 ring-offset-2 border-amber-400'
            : 'shadow-md border-amber-200 hover:border-amber-300'
          }
        `}
        onDoubleClick={handleDoubleClick}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-500 !border-white" />
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-500 !border-white" />

        {/* Header */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-200/50">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">Comment</span>
        </div>

        {/* Content */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Write your comment..."
            className="w-full text-sm text-gray-800 resize-none border-none outline-none bg-white/50 rounded px-2 py-1 min-h-[60px]"
            rows={3}
          />
        ) : (
          <div className="text-sm text-gray-800 whitespace-pre-wrap break-words min-h-[40px]">
            {data.label || (
              <span className="text-gray-400 italic">Double-click to edit...</span>
            )}
          </div>
        )}

        {/* Footer with date */}
        {data.createdAt && (
          <div className="mt-2 pt-2 border-t border-amber-200/50">
            <span className="text-xs text-amber-600/70">
              {new Date(data.createdAt).toLocaleDateString()}
            </span>
          </div>
        )}

        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-500 !border-white" />
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-500 !border-white" />
      </div>
    </>
  );
});

CommentNode.displayName = 'CommentNode';
