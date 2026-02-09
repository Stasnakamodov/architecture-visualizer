'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppNode, TechNodeData, DatabaseNodeData, BusinessNodeData, CommentNodeData } from '@/types/canvas';

interface NodeSlideCardProps {
  node: AppNode | null;
  isVisible: boolean;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

const typeColors: Record<string, string> = {
  tech: 'bg-blue-500/20 text-blue-300',
  database: 'bg-purple-500/20 text-purple-300',
  business: 'bg-indigo-500/20 text-indigo-300',
  comment: 'bg-amber-500/20 text-amber-300',
  group: 'bg-gray-500/20 text-gray-300',
  shape: 'bg-cyan-500/20 text-cyan-300',
};

function TechDetails({ data }: { data: TechNodeData }) {
  if (!data.apiEndpoint && !data.method) return null;
  return (
    <div className="space-y-2">
      {data.method && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14">Method</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
            {data.method}
          </span>
        </div>
      )}
      {data.apiEndpoint && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14 pt-0.5">Endpoint</span>
          <span className="text-xs font-mono text-gray-300 break-all">{data.apiEndpoint}</span>
        </div>
      )}
    </div>
  );
}

function DatabaseDetails({ data }: { data: DatabaseNodeData }) {
  if (!data.tableName && (!data.columns || data.columns.length === 0)) return null;
  return (
    <div className="space-y-2">
      {data.tableName && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14">Table</span>
          <span className="text-xs font-mono text-purple-300">{data.tableName}</span>
        </div>
      )}
      {data.columns && data.columns.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14 pt-0.5">Columns</span>
          <div className="flex flex-wrap gap-1">
            {data.columns.map((col, i) => (
              <span key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessDetails({ data }: { data: BusinessNodeData }) {
  if (!data.metric && !data.status) return null;
  const statusColors: Record<string, string> = {
    active: 'text-green-400',
    planned: 'text-yellow-400',
    deprecated: 'text-red-400',
  };
  return (
    <div className="space-y-2">
      {data.status && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14">Status</span>
          <span className={`text-xs capitalize ${statusColors[data.status] || 'text-gray-300'}`}>
            {data.status}
          </span>
        </div>
      )}
      {data.metric && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14 pt-0.5">Metric</span>
          <span className="text-xs text-gray-300">{data.metric}</span>
        </div>
      )}
    </div>
  );
}

function CommentDetails({ data }: { data: CommentNodeData }) {
  if (!data.content && !data.fullContent) return null;
  const text = data.fullContent || data.content || '';
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
        {text}
      </div>
      {data.author && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase w-14">Author</span>
          <span className="text-xs text-gray-400">{data.author}</span>
        </div>
      )}
    </div>
  );
}

function hasDetails(node: AppNode): boolean {
  const d = node.data;
  if (!d) return false;
  switch (node.type) {
    case 'tech': return !!(d as TechNodeData).apiEndpoint || !!(d as TechNodeData).method;
    case 'database': return !!(d as DatabaseNodeData).tableName || ((d as DatabaseNodeData).columns?.length ?? 0) > 0;
    case 'business': return !!(d as BusinessNodeData).metric || !!(d as BusinessNodeData).status;
    case 'comment': return !!(d as CommentNodeData).content || !!(d as CommentNodeData).fullContent;
    default: return false;
  }
}

export function NodeSlideCard({ node, isVisible, isExpanded: externalExpanded, onExpandChange }: NodeSlideCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = externalExpanded ?? internalExpanded;
  const setIsExpanded = onExpandChange ?? setInternalExpanded;
  const nodeId = node?.id ?? null;

  // Reset expanded state when node changes
  useEffect(() => {
    setIsExpanded(false);
  }, [nodeId]);

  // Close expanded card on Escape (stop propagation so overlay doesn't exit)
  useEffect(() => {
    if (!isExpanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setIsExpanded(false);
      }
    };
    // Capture phase to intercept before PresentationOverlay's handler
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isExpanded]);

  if (!node) return null;

  const label = node.data?.label || '';
  const description = node.data?.description || '';
  const badgeColor = typeColors[node.type || ''] || 'bg-white/10 text-gray-400';
  const canExpand = hasDetails(node);

  return (
    <AnimatePresence mode="wait">
      {isVisible && !isExpanded && (
        <motion.div
          key="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-6 right-6 z-40 max-w-sm"
        >
          <div
            className={`bg-gray-900/80 backdrop-blur-md rounded-xl border border-white/10 p-5 shadow-2xl ${canExpand ? 'cursor-pointer hover:border-white/20 transition-colors' : ''}`}
            onClick={canExpand ? () => setIsExpanded(true) : undefined}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
                {node.type || 'node'}
              </span>
              {canExpand && (
                <span className="text-[10px] text-gray-500 ml-auto">
                  нажмите чтобы открыть
                </span>
              )}
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">{label}</h3>

            {description && (
              <p className="text-sm text-gray-300 leading-relaxed">{description}</p>
            )}
          </div>
        </motion.div>
      )}

      {isVisible && isExpanded && canExpand && (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-40 flex items-center justify-center p-12"
          onClick={() => setIsExpanded(false)}
        >
          <motion.div
            className="bg-gray-900/90 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            layoutId="node-card"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
                    {node.type || 'node'}
                  </span>
                  {node.data?.color && (
                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: node.data.color }} />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white">{label}</h2>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-gray-300 leading-relaxed mb-5">{description}</p>
            )}

            {/* Divider */}
            <div className="border-t border-white/10 mb-5" />

            {/* Type-specific details */}
            {node.type === 'tech' && <TechDetails data={node.data as TechNodeData} />}
            {node.type === 'database' && <DatabaseDetails data={node.data as DatabaseNodeData} />}
            {node.type === 'business' && <BusinessDetails data={node.data as BusinessNodeData} />}
            {node.type === 'comment' && <CommentDetails data={node.data as CommentNodeData} />}

            {/* Close hint */}
            <div className="mt-6 text-center">
              <span className="text-[10px] text-gray-500">нажмите за пределами карточки или Esc чтобы закрыть</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
