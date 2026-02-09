'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { BranchPoint } from '@/types/canvas';

interface BranchSelectorProps {
  branchPoint: BranchPoint;
  onSelect: (targetNodeId: string) => void;
}

export function BranchSelector({ branchPoint, onSelect }: BranchSelectorProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      >
        <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl max-w-lg w-full mx-4">
          <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-4 text-center">
            Choose a path
          </h3>

          <div className="flex flex-col gap-3">
            {branchPoint.targetNodeIds.map((nodeId, i) => (
              <button
                key={nodeId}
                onClick={() => onSelect(nodeId)}
                className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-blue-500/30">
                  {i + 1}
                </div>
                <span className="text-white text-sm font-medium truncate">
                  {branchPoint.targetLabels[i] || nodeId}
                </span>
                <svg
                  className="w-4 h-4 text-gray-500 ml-auto flex-shrink-0 group-hover:text-blue-400 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
