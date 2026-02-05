'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import type { AppNode, CommentNodeData, ShapeNodeData, BorderStyle } from '@/types/canvas';

interface NodeDetailModalProps {
  node: AppNode;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#6b7280', '#06b6d4', '#ec4899', '#ffffff', '#000000',
];

export function NodeDetailModal({ node, onClose }: NodeDetailModalProps) {
  const { nodes, setNodes, updateShapeProperties, markDirty } = useCanvasStore();

  const isComment = node.type === 'comment';
  const isShape = node.type === 'shape';
  const commentData = isComment ? (node.data as CommentNodeData) : null;
  const shapeData = isShape ? (node.data as ShapeNodeData) : null;

  // Local state
  const [label, setLabel] = useState(node.data?.label || '');
  const [description, setDescription] = useState(node.data?.description || '');
  const [content, setContent] = useState(commentData?.content || commentData?.fullContent || '');
  const [fillColor, setFillColor] = useState(shapeData?.fillColor || '#ffffff');
  const [borderColor, setBorderColor] = useState(shapeData?.borderColor || '#3b82f6');
  const [borderStyle, setBorderStyle] = useState<BorderStyle>(shapeData?.borderStyle || 'solid');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(200, textareaRef.current.scrollHeight) + 'px';
    }
  }, [label, content]);

  const handleSave = () => {
    if (isShape) {
      updateShapeProperties(node.id, {
        label,
        fillColor,
        borderColor,
        borderStyle,
      });
    } else {
      // Update node data directly
      const updatedNodes = nodes.map(n => {
        if (n.id === node.id) {
          return {
            ...n,
            data: {
              ...n.data,
              label,
              description,
              ...(isComment ? { content, fullContent: content } : {}),
            },
          };
        }
        return n;
      });
      setNodes(updatedNodes as AppNode[]);
    }
    markDirty();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const nodeTypeLabels: Record<string, string> = {
    comment: 'Comment',
    shape: 'Shape',
    tech: 'Tech Component',
    database: 'Database',
    business: 'Business',
    group: 'Group',
    default: 'Node',
  };

  const nodeTypeColors: Record<string, string> = {
    comment: 'bg-amber-500',
    shape: 'bg-cyan-500',
    tech: 'bg-blue-500',
    database: 'bg-purple-500',
    business: 'bg-indigo-500',
    group: 'bg-gray-500',
    default: 'bg-gray-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${nodeTypeColors[node.type || 'default']} rounded-lg flex items-center justify-center`}>
              {isComment ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              ) : isShape ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {nodeTypeLabels[node.type || 'default']}
              </h2>
              <p className="text-xs text-gray-500">ID: {node.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Label / Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isComment ? 'Title' : 'Label'}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={isComment ? 'Comment title...' : 'Label...'}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          {/* Content for Comments */}
          {isComment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your comment content here..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-none min-h-[200px]"
              />
              <p className="mt-1 text-xs text-gray-400">Supports markdown formatting</p>
            </div>
          )}

          {/* Description for non-comments */}
          {!isComment && !isShape && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-none min-h-[100px]"
                rows={4}
              />
            </div>
          )}

          {/* Shape-specific options */}
          {isShape && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fill Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={`fill-${color}`}
                      onClick={() => setFillColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                        fillColor === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Border Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Border Style</label>
                <div className="flex gap-2">
                  {(['solid', 'dashed', 'none'] as BorderStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => setBorderStyle(style)}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 capitalize transition-colors ${
                        borderStyle === style
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Position info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
            <div className="flex gap-4">
              <div className="flex-1">
                <span className="text-xs text-gray-500">X</span>
                <p className="text-lg font-mono text-gray-900">{Math.round(node.position.x)}</p>
              </div>
              <div className="flex-1">
                <span className="text-xs text-gray-500">Y</span>
                <p className="text-lg font-mono text-gray-900">{Math.round(node.position.y)}</p>
              </div>
            </div>
          </div>

          {/* Created date for comments */}
          {isComment && commentData?.createdAt && (
            <div className="text-sm text-gray-500">
              Created: {new Date(commentData.createdAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Cmd+S</kbd> to save
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
