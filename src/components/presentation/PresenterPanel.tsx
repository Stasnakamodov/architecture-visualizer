'use client';

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/context';
import { useCanvasStore } from '@/stores/canvasStore';
import type { FlattenedStep, SubSlideEntry } from '@/hooks/usePresentationPlayback';
import type { PresentationStepNotes, AppNode, TechNodeData, DatabaseNodeData, BusinessNodeData, CommentNodeData } from '@/types/canvas';

interface PresenterPanelProps {
  currentStep: FlattenedStep | null;
  nextStep: FlattenedStep | null;
  currentNotes: PresentationStepNotes;
  timerStr: string;
  currentIndex: number;
  totalSteps: number;
  currentSubSlide?: SubSlideEntry | null;
  nextSubSlide?: SubSlideEntry | null;
}

function NodeDetails({ nodeId }: { nodeId: string }) {
  const nodes = useCanvasStore(s => s.nodes);
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;

  const data = node.data;
  const type = node.type;

  return (
    <div className="space-y-2">
      {/* Common fields */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500">Label</span>
        <p className="text-sm text-white">{data.label || '—'}</p>
      </div>
      {data.description && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Description</span>
          <p className="text-xs text-gray-300">{data.description}</p>
        </div>
      )}

      {/* Type-specific fields */}
      {type === 'tech' && (
        <>
          {(data as TechNodeData).apiEndpoint && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">API Endpoint</span>
              <p className="text-xs text-blue-300 font-mono">{(data as TechNodeData).apiEndpoint}</p>
            </div>
          )}
          {(data as TechNodeData).method && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Method</span>
              <span className="text-xs text-emerald-400 font-mono ml-1">{(data as TechNodeData).method}</span>
            </div>
          )}
        </>
      )}

      {type === 'database' && (
        <>
          {(data as DatabaseNodeData).tableName && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Table</span>
              <p className="text-xs text-purple-300 font-mono">{(data as DatabaseNodeData).tableName}</p>
            </div>
          )}
          {(data as DatabaseNodeData).columns && (data as DatabaseNodeData).columns!.length > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Columns</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {(data as DatabaseNodeData).columns!.map((col, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">{col}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {type === 'business' && (
        <>
          {(data as BusinessNodeData).metric && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Metric</span>
              <p className="text-xs text-amber-300">{(data as BusinessNodeData).metric}</p>
            </div>
          )}
          {(data as BusinessNodeData).status && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">Status</span>
              <span className={`text-xs ml-1 ${
                (data as BusinessNodeData).status === 'active' ? 'text-emerald-400' :
                (data as BusinessNodeData).status === 'planned' ? 'text-blue-400' :
                'text-red-400'
              }`}>{(data as BusinessNodeData).status}</span>
            </div>
          )}
        </>
      )}

      {type === 'comment' && (data as CommentNodeData).content && (
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-500">Content</span>
          <p className="text-xs text-gray-300 whitespace-pre-wrap">{(data as CommentNodeData).content}</p>
        </div>
      )}
    </div>
  );
}

export function PresenterPanel({
  currentStep,
  nextStep,
  currentNotes,
  timerStr,
  currentIndex,
  totalSteps,
  currentSubSlide,
  nextSubSlide,
}: PresenterPanelProps) {
  const { t } = useTranslation();

  const isNodeSlide = currentSubSlide?.subSlide.type === 'node';
  const focusedNodeId = currentSubSlide?.focusedNodeId;

  return (
    <div className="w-[30%] bg-gray-950 border-l border-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{t('presentation.presenterView')}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-mono">{timerStr}</span>
          <span className="text-xs text-gray-500">
            {currentIndex + 1} / {totalSteps}
          </span>
        </div>
      </div>

      {/* Current step info */}
      {currentSubSlide && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentSubSlide.scenarioColor }}
            />
            <span className="text-xs text-gray-400">{currentSubSlide.scenarioName}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-600 ml-auto">
              {currentSubSlide.subSlide.type}
            </span>
          </div>
          <h4 className="text-sm font-medium text-white">{currentSubSlide.step.name}</h4>
          {currentSubSlide.step.description && (
            <p className="text-xs text-gray-400 mt-1">{currentSubSlide.step.description}</p>
          )}
        </div>
      )}

      {/* Node details (when on a node slide) */}
      {isNodeSlide && focusedNodeId && (
        <div className="px-4 py-3 border-b border-gray-800">
          <h5 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Node Details</h5>
          <NodeDetails nodeId={focusedNodeId} />
        </div>
      )}

      {/* Caption */}
      {currentNotes.caption && (
        <div className="px-4 py-3 border-b border-gray-800">
          <h5 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">{t('presentation.caption')}</h5>
          <p className="text-sm text-blue-300 leading-relaxed">{currentNotes.caption}</p>
        </div>
      )}

      {/* Speaker notes */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h5 className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t('presentation.speakerNotes')}</h5>
        {currentNotes.speakerNotes ? (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {currentNotes.speakerNotes}
          </p>
        ) : (
          <p className="text-xs text-gray-600 italic">
            No speaker notes. Use &ldquo;Generate AI Notes&rdquo; in the presentation panel.
          </p>
        )}
      </div>

      {/* Next sub-slide preview */}
      {nextSubSlide && (
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
          <h5 className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            Next: {nextSubSlide.subSlide.type}
          </h5>
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: nextSubSlide.scenarioColor }}
            />
            <span className="text-xs text-gray-400">
              {nextSubSlide.subSlide.type === 'title'
                ? nextSubSlide.subSlide.scenarioName
                : nextSubSlide.subSlide.type === 'node'
                ? `Node: ${nextSubSlide.focusedNodeId || ''}`
                : nextSubSlide.step.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
