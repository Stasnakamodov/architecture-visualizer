'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Handle,
  Position,
  type NodeProps,
  type Node,
  NodeResizer,
} from '@xyflow/react';
import type { BaseNodeData } from '@/types/canvas';

type EditableNodeType = Node<BaseNodeData & { fullContent?: string }, 'editable'>;

export const EditableNode = memo(
  ({ data, selected, id }: NodeProps<EditableNodeType>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(data.label);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const borderColor = data.color || (selected ? '#3b82f6' : '#d1d5db');

    // Focus textarea when editing starts
    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, [isEditing]);

    const handleDoubleClick = useCallback(() => {
      // If node has full content, let the modal handle it
      if (data.fullContent) return;
      setIsEditing(true);
      setEditValue(data.label);
    }, [data.label, data.fullContent]);

    const handleBlur = useCallback(() => {
      setIsEditing(false);
      // Here you would update the node data
      // For now, we just close the editor
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          setIsEditing(false);
        }
        if (e.key === 'Escape') {
          setIsEditing(false);
          setEditValue(data.label);
        }
      },
      [data.label]
    );

    return (
      <>
        <NodeResizer
          isVisible={selected}
          minWidth={100}
          minHeight={50}
          lineClassName="!border-blue-400"
          handleClassName="!w-2 !h-2 !bg-blue-500 !border-white"
        />

        <div
          className={`
            px-3 py-2 rounded-lg border-2 bg-white shadow-sm min-w-[100px] min-h-[50px]
            transition-shadow duration-200 h-full
            ${selected ? 'shadow-lg' : ''}
          `}
          style={{ borderColor }}
          onDoubleClick={handleDoubleClick}
        >
          <Handle
            type="target"
            position={Position.Top}
            className="!w-2 !h-2 !bg-gray-400 !border-white"
          />
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2 !h-2 !bg-gray-400 !border-white"
          />

          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full h-full min-h-[40px] resize-none border-none outline-none text-sm bg-transparent"
              placeholder="Enter text..."
            />
          ) : (
            <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
              {data.label}
            </div>
          )}

          {data.description && !isEditing && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {data.description}
            </p>
          )}

          <Handle
            type="source"
            position={Position.Bottom}
            className="!w-2 !h-2 !bg-gray-400 !border-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="!w-2 !h-2 !bg-gray-400 !border-white"
          />
        </div>
      </>
    );
  }
);

EditableNode.displayName = 'EditableNode';
