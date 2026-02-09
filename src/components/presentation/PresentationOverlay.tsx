'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TechNode, DatabaseNode, BusinessNode, GroupNode, EditableNode, CommentNode, ShapeNode } from '../canvas/nodes';
import { CustomEdge } from '../canvas/edges/CustomEdge';
import { PresenterPanel } from './PresenterPanel';
import { NodeSlideCard } from './NodeSlideCard';
import { BranchSelector } from './BranchSelector';
import { useCanvasStore } from '@/stores/canvasStore';
import { usePresentationPlayback } from '@/hooks/usePresentationPlayback';
import { useTranslation } from '@/i18n/context';
import type { ShapeNodeData } from '@/types/canvas';

const nodeTypes: NodeTypes = {
  tech: TechNode,
  database: DatabaseNode,
  business: BusinessNode,
  group: GroupNode,
  editable: EditableNode,
  comment: CommentNode,
  shape: ShapeNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

function getMiniMapNodeColor(node: any): string {
  switch (node.type) {
    case 'tech': return '#3b82f6';
    case 'database': return '#8b5cf6';
    case 'business': return '#6366f1';
    case 'group': return '#9ca3af';
    case 'comment': return '#f59e0b';
    case 'shape': return (node.data as ShapeNodeData)?.borderColor || '#3b82f6';
    default: return '#9ca3af';
  }
}

function PresentationOverlayInner() {
  const {
    nodes,
    edges,
    presentations,
    activePresentationId,
    isPresentationMode,
    presenterViewActive,
    isRecordingPath,
    exitPresentationMode,
    togglePresenterView,
    recordSubSlide,
    saveRecordedPath,
    stopRecording,
    updatePresentation,
    scenarios,
  } = useCanvasStore();
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [isNodeCardExpanded, setIsNodeCardExpanded] = useState(false);
  const presentation = activePresentationId
    ? presentations.find(p => p.id === activePresentationId) || null
    : null;

  const {
    subSlides,
    currentSubSlide,
    currentIndex,
    totalSubSlides,
    currentBranchPoint,
    flatSteps,
    isShowingTitleSlide,
    titleSlideScenario,
    currentStep,
    totalSteps,
    isAutoplayActive,
    autoplayProgress,
    elapsedSeconds,
    goNext,
    goPrev,
    goToIndex,
    toggleAutoplay,
    selectBranch,
  } = usePresentationPlayback(presentation);

  // Current caption and speaker notes
  const currentNotes = useMemo(() => {
    if (!presentation || !currentSubSlide) return { caption: '', speakerNotes: '' };
    const { subSlide } = currentSubSlide;

    // Try node-specific key first, then step-level key
    if (subSlide.type === 'node' && subSlide.nodeId) {
      const nodeKey = `${subSlide.scenarioId}:${subSlide.stepId}:${subSlide.nodeId}`;
      const nodeNotes = presentation.notes[nodeKey];
      if (nodeNotes) return nodeNotes;
    }

    const stepKey = `${subSlide.scenarioId}:${subSlide.stepId}`;
    return presentation.notes[stepKey] || { caption: '', speakerNotes: '' };
  }, [presentation, currentSubSlide]);

  // Next sub-slide info for presenter view
  const nextSubSlide = useMemo(() => {
    if (!subSlides.length || currentIndex >= subSlides.length - 1) return null;
    return subSlides[currentIndex + 1];
  }, [subSlides, currentIndex]);

  // Find the focused node for NodeSlideCard
  const focusedNode = useMemo(() => {
    if (!currentSubSlide || currentSubSlide.subSlide.type !== 'node' || !currentSubSlide.focusedNodeId) return null;
    return nodes.find(n => n.id === currentSubSlide.focusedNodeId) || null;
  }, [currentSubSlide, nodes]);

  // Reset expanded card when slide changes
  useEffect(() => {
    setIsNodeCardExpanded(false);
  }, [currentIndex]);

  // Handle node click on canvas
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: any) => {
    // If this is the currently focused node, expand its card
    if (focusedNode && node.id === focusedNode.id) {
      setIsNodeCardExpanded(true);
      return;
    }
    // Otherwise, navigate to that node's sub-slide if it exists
    const targetIndex = subSlides.findIndex(
      (s) => s.subSlide.type === 'node' && s.focusedNodeId === node.id
    );
    if (targetIndex !== -1) {
      goToIndex(targetIndex);
    }
  }, [focusedNode, subSlides, goToIndex]);

  // Handle pane click for prev/next navigation (replaces invisible click zones)
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    const el = mainContentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < rect.width * 0.25) {
      goPrev();
    } else if (x > rect.width * 0.75) {
      goNext();
    }
  }, [goPrev, goNext]);

  // Format timer
  const timerStr = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // Record sub-slides during recording mode
  useEffect(() => {
    if (isRecordingPath && currentSubSlide) {
      recordSubSlide(currentSubSlide.subSlide);
    }
  }, [isRecordingPath, currentSubSlide, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle recording completion on exit
  const handleExit = useCallback(() => {
    if (isRecordingPath && presentation) {
      saveRecordedPath(presentation.id);
      // Generate slug and publish
      const slug = crypto.randomUUID();
      updatePresentation(presentation.id, { isPublic: true, publicSlug: slug });
    } else if (isRecordingPath) {
      stopRecording();
    }
    exitPresentationMode();
  }, [isRecordingPath, presentation, saveRecordedPath, updatePresentation, stopRecording, exitPresentationMode]);

  // Fullscreen API
  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    el.requestFullscreen?.()?.catch(() => {
      // Fallback: runs as fixed overlay (e.g. no user gesture on reload)
    });

    const handleFSChange = () => {
      if (!document.fullscreenElement) {
        handleExit();
      }
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          handleExit();
          break;
        case 'p':
        case 'P':
          togglePresenterView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, handleExit, togglePresenterView]);

  // Validate scenarios exist
  const missingScenarioIds = presentation
    ? presentation.scenarioIds.filter(id => !scenarios.find(s => s.id === id))
    : [];

  if (missingScenarioIds.length > 0) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <p className="text-xl mb-2 text-red-400">Missing Scenarios</p>
          <p className="text-sm text-gray-400 mb-4">
            {missingScenarioIds.length} scenario(s) referenced by this presentation no longer exist. Please edit the presentation to remove them.
          </p>
          <button
            onClick={handleExit}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            {t('presentation.exitPresentation')}
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (totalSubSlides === 0) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl mb-4">{t('presentation.noValidScenarios')}</p>
          <button
            onClick={handleExit}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            {t('presentation.exitPresentation')}
          </button>
        </div>
      </div>
    );
  }

  const isTitle = currentSubSlide?.subSlide.type === 'title';
  const isNodeSlide = currentSubSlide?.subSlide.type === 'node';

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-gray-900 flex">
      {/* Autoplay progress bar */}
      {isAutoplayActive && !isTitle && (
        <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-gray-800">
          <motion.div
            className="h-full bg-blue-500"
            style={{ width: `${autoplayProgress}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      )}

      {/* Main content area */}
      <div ref={mainContentRef} className={`flex-1 relative ${presenterViewActive ? 'w-[70%]' : 'w-full'}`}>
        {/* Title slide overlay */}
        <AnimatePresence>
          {isTitle && titleSlideScenario && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-40 bg-gray-900 flex items-center justify-center"
            >
              <div className="text-center">
                <div
                  className="w-4 h-4 rounded-full mx-auto mb-4"
                  style={{ backgroundColor: titleSlideScenario.color }}
                />
                <h1 className="text-4xl font-bold text-white mb-2">
                  {titleSlideScenario.name}
                </h1>
                {currentSubSlide?.subSlide.scenarioDescription && (
                  <p className="text-gray-300 text-lg mb-3 max-w-xl mx-auto">
                    {currentSubSlide.subSlide.scenarioDescription}
                  </p>
                )}
                <p className="text-gray-400 text-lg">
                  {titleSlideScenario.steps.length} steps
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* React Flow canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          fitView
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.05)"
          />
          <MiniMap
            nodeColor={getMiniMapNodeColor}
            style={{
              position: 'absolute',
              bottom: 80,
              right: 16,
              width: 120,
              height: 80,
              opacity: 0.6,
            }}
            pannable={false}
            zoomable={false}
          />
        </ReactFlow>

        {/* Node slide card overlay */}
        <NodeSlideCard
          node={focusedNode}
          isVisible={isNodeSlide && !!focusedNode}
          isExpanded={isNodeCardExpanded}
          onExpandChange={setIsNodeCardExpanded}
        />

        {/* Branch selector overlay */}
        {currentBranchPoint && (
          <BranchSelector
            branchPoint={currentBranchPoint}
            onSelect={selectBranch}
          />
        )}

        {/* Navigation: click zones + visible buttons */}
        {!isTitle && !currentBranchPoint && totalSubSlides > 1 && (
          <>
            {/* Prev button */}
            {currentIndex > 0 && (
              <button
                onClick={goPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white backdrop-blur-sm transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Next button */}
            {currentIndex < totalSubSlides - 1 && (
              <button
                onClick={goNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white backdrop-blur-sm transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* Top bar: progress + exit */}
        <div className="absolute top-2 left-4 right-4 z-40 flex items-center justify-between">
          {/* Sub-slide progress dots */}
          <div className="flex items-center gap-0.5 max-w-[60%] overflow-hidden">
            {subSlides.map((entry, i) => (
              <button
                key={i}
                onClick={() => goToIndex(i)}
                className={`rounded-full transition-all flex-shrink-0 ${
                  i === currentIndex
                    ? 'w-6 h-1.5 bg-white'
                    : i < currentIndex
                    ? `h-1.5 bg-white/60 ${entry.subSlide.type === 'overview' ? 'w-3' : 'w-1.5'}`
                    : `h-1.5 bg-white/20 ${entry.subSlide.type === 'overview' ? 'w-3' : 'w-1.5'}`
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Recording indicator */}
            {isRecordingPath && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/20">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-[10px] font-medium">REC</span>
              </div>
            )}
            {/* Timer */}
            <span className="text-white/60 text-xs font-mono">{timerStr}</span>

            {/* Sub-slide counter */}
            <span className="text-white/60 text-xs">
              {currentIndex + 1} / {totalSubSlides}
            </span>

            {/* Autoplay toggle */}
            <button
              onClick={toggleAutoplay}
              className={`p-1.5 rounded-lg transition-colors ${
                isAutoplayActive
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
              title={t('presentation.autoplay')}
            >
              {isAutoplayActive ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Presenter view toggle */}
            <button
              onClick={togglePresenterView}
              className={`p-1.5 rounded-lg transition-colors ${
                presenterViewActive
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-white/10 text-white/60 hover:text-white'
              }`}
              title={t('presentation.presenterView')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </button>

            {/* Exit button */}
            <button
              onClick={handleExit}
              className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              title={isRecordingPath ? 'Finish recording' : t('presentation.exitPresentation')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Caption bar (when NOT in presenter view) */}
        {!presenterViewActive && !isTitle && currentNotes.caption && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={currentIndex}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-xl px-6 py-3">
              <p className="text-white text-sm text-center leading-relaxed">
                {currentNotes.caption}
              </p>
            </div>
          </motion.div>
        )}

        {/* Scenario color indicator */}
        {currentSubSlide && !isTitle && (
          <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: currentSubSlide.scenarioColor }}
            />
            <span className="text-white/40 text-[10px]">{currentSubSlide.scenarioName}</span>
          </div>
        )}
      </div>

      {/* Presenter panel */}
      {presenterViewActive && (
        <PresenterPanel
          currentStep={currentStep}
          nextStep={null}
          currentNotes={currentNotes}
          timerStr={timerStr}
          currentIndex={currentIndex}
          totalSteps={totalSubSlides}
          currentSubSlide={currentSubSlide}
          nextSubSlide={nextSubSlide}
        />
      )}
    </div>
  );
}

export function PresentationOverlay() {
  return (
    <ReactFlowProvider>
      <PresentationOverlayInner />
    </ReactFlowProvider>
  );
}
