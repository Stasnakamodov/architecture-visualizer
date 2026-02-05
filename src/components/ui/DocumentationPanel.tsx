'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCanvasStore } from '@/stores/canvasStore';

interface NodeDoc {
  title: string;
  content: string;
  fullContent?: string;
  tags?: string[];
  links?: string[];
}

interface DocumentationPanelProps {
  canvasId?: string;
  onLinkClick?: (linkName: string) => void;
}

export function DocumentationPanel({
  canvasId,
  onLinkClick,
}: DocumentationPanelProps) {
  const { selectedNodeId, nodes, selectNode } = useCanvasStore();
  const [doc, setDoc] = useState<NodeDoc | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Get node data when selected
  useEffect(() => {
    if (!selectedNodeId) {
      setDoc(null);
      setIsExpanded(false);
      return;
    }

    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node) {
      setDoc({
        title: node.data.label,
        content: node.data.description || 'No description available.',
        fullContent: (node.data as any).fullContent,
        tags: (node.data as any).tags,
        links: (node.data as any).links,
      });
    }
  }, [selectedNodeId, nodes]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const hasFullContent = doc?.fullContent && doc.fullContent.length > 0;

  // Handle clicking on [[wikilinks]] in markdown
  const handleLinkInContent = (linkName: string) => {
    // Find node by name
    const targetNode = nodes.find(
      (n) =>
        n.id === linkName ||
        n.data.label.includes(linkName) ||
        n.id.includes(linkName)
    );
    if (targetNode) {
      selectNode(targetNode.id);
    }
    onLinkClick?.(linkName);
  };

  return (
    <AnimatePresence>
      {selectedNodeId && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`
            bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-gray-950 overflow-hidden flex flex-col
            ${isExpanded ? 'w-[500px]' : 'w-96'}
            transition-all duration-300
          `}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-shrink-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 text-lg">
              {doc?.title || 'Node Details'}
            </h3>
            <div className="flex items-center gap-1">
              {hasFullContent && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={() => selectNode(null)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <svg
                  className="w-4 h-4 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {/* Node Type Badge */}
              {selectedNode && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                  <span
                    className={`
                      text-xs px-2 py-1 rounded-full font-medium
                      ${selectedNode.type === 'tech' ? 'bg-blue-100 text-blue-700' : ''}
                      ${selectedNode.type === 'database' ? 'bg-purple-100 text-purple-700' : ''}
                      ${selectedNode.type === 'business' ? 'bg-indigo-100 text-indigo-700' : ''}
                      ${selectedNode.type === 'group' ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' : ''}
                    `}
                  >
                    {selectedNode.type || 'default'}
                  </span>

                  {/* Tags */}
                  {doc?.tags &&
                    doc.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
              )}

              {/* Full Markdown Content or Description */}
              {hasFullContent ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-a:text-blue-600 prose-code:text-purple-600 prose-code:bg-purple-50 dark:prose-code:bg-purple-900/30 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-table:text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Custom link handler for [[wikilinks]]
                      a: ({ href, children }) => {
                        // Check if it's an internal link
                        const text = String(children);
                        if (
                          href?.startsWith('[[') ||
                          text.match(/^\[\[.*\]\]$/)
                        ) {
                          const linkName = text
                            .replace(/^\[\[/, '')
                            .replace(/\]\]$/, '');
                          return (
                            <button
                              onClick={() => handleLinkInContent(linkName)}
                              className="text-blue-600 hover:underline"
                            >
                              {linkName}
                            </button>
                          );
                        }
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {children}
                          </a>
                        );
                      },
                      // Better table styling
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {doc.fullContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-gray-600 dark:text-gray-400">{doc?.content}</p>
                </div>
              )}

              {/* Connected Links */}
              {doc?.links && doc.links.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Linked Documents ({doc.links.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {doc.links.map((link) => (
                      <button
                        key={link}
                        onClick={() => handleLinkInContent(link)}
                        className="text-sm px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        {link}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Node Properties (collapsed by default) */}
              {selectedNode && !hasFullContent && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Properties
                  </h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">ID</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                        {selectedNode.id}
                      </span>
                    </div>

                    {selectedNode.data.color && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-gray-400">Color</span>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: selectedNode.data.color }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
