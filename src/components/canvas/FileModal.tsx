'use client';

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AppNode } from '@/types/canvas';

interface FileModalProps {
  node: AppNode | null;
  onClose: () => void;
  onLinkClick?: (linkName: string) => void;
}

export function FileModal({ node, onClose, onLinkClick }: FileModalProps) {
  const data = node?.data as any;
  const hasContent = data?.fullContent && data.fullContent.length > 0;

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (node) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [node, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleLinkInContent = useCallback((linkName: string) => {
    onLinkClick?.(linkName);
  }, [onLinkClick]);

  if (!node || !hasContent) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-shrink-0 bg-gray-50/50">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`
                  text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0
                  ${node.type === 'tech' ? 'bg-blue-100 text-blue-700' : ''}
                  ${node.type === 'database' ? 'bg-purple-100 text-purple-700' : ''}
                  ${node.type === 'business' ? 'bg-indigo-100 text-indigo-700' : ''}
                  ${node.type === 'group' ? 'bg-gray-100 text-gray-700' : ''}
                  ${!node.type || node.type === 'editable' ? 'bg-gray-100 text-gray-700' : ''}
                `}
              >
                {node.type || 'note'}
              </span>
              <h2 className="font-semibold text-gray-900 text-lg truncate">
                {data.label}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tags */}
          {data.tags && data.tags.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2 bg-gray-50/30">
              {data.tags.map((tag: string) => (
                <span key={tag} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-table:text-sm prose-img:rounded-lg prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:py-1 prose-li:marker:text-gray-400">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Handle [[wikilinks]]
                  p: ({ children }) => {
                    if (typeof children === 'string') {
                      const parts = children.split(/(\[\[[^\]]+\]\])/g);
                      if (parts.length > 1) {
                        return (
                          <p>
                            {parts.map((part, i) => {
                              const match = part.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
                              if (match) {
                                const linkTarget = match[1];
                                const linkText = match[2] || match[1];
                                return (
                                  <button
                                    key={i}
                                    onClick={() => handleLinkInContent(linkTarget)}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  >
                                    {linkText}
                                  </button>
                                );
                              }
                              return part;
                            })}
                          </p>
                        );
                      }
                    }
                    return <p>{children}</p>;
                  },
                  // Better links
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {children}
                    </a>
                  ),
                  // Better tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
                      <table className="min-w-full border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-left font-semibold text-sm">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-gray-100 px-4 py-2.5 text-sm">{children}</td>
                  ),
                  // Better code blocks
                  pre: ({ children }) => (
                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">{children}</pre>
                  ),
                }}
              >
                {data.fullContent}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer with links */}
          {data.links && data.links.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Linked Documents ({data.links.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {data.links.map((link: string) => (
                  <button
                    key={link}
                    onClick={() => handleLinkInContent(link)}
                    className="text-sm px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {link}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
