'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TechNode, DatabaseNode, BusinessNode, GroupNode, EditableNode, CommentNode, ShapeNode } from '../canvas/nodes';
import { CustomEdge } from '../canvas/edges/CustomEdge';
import { NodeSlideCard } from './NodeSlideCard';
import type { AppNode, AppEdge, Presentation, Step, SubSlide, ShapeNodeData } from '@/types/canvas';

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

// Inline Scenario type for public view (no store dependency)
interface PublicScenario {
  id: string;
  name: string;
  color: string;
  steps: Step[];
}

interface PublicPresentationProps {
  nodes: AppNode[];
  edges: AppEdge[];
  presentation: Presentation & { scenarios?: PublicScenario[] };
}

function PublicPresentationInner({ nodes: initialNodes, edges, presentation }: PublicPresentationProps) {
  const reactFlow = useReactFlow();
  const [nodes, setNodes] = useState(initialNodes);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isShowingTitle, setIsShowingTitle] = useState(true);
  const [titleScenario, setTitleScenario] = useState<{ name: string; color: string; description?: string } | null>(null);

  // Use recordedPath if available for linear navigation
  const recordedPath = presentation.recordedPath;
  const hasRecordedPath = recordedPath && recordedPath.subSlideSequence.length > 0;

  // Resolve scenarios for step lookup
  const scenarioMap = useMemo(() => {
    const map = new Map<string, PublicScenario>();
    for (const sc of presentation.scenarios || []) {
      map.set(sc.id, sc);
    }
    return map;
  }, [presentation.scenarios]);

  // Build sub-slides from recorded path OR fallback to legacy flat steps
  const subSlides: SubSlide[] = useMemo(() => {
    if (hasRecordedPath) {
      return recordedPath!.subSlideSequence;
    }

    // Fallback: build legacy flat overview-only sequence
    const result: SubSlide[] = [];
    const scenarios = presentation.scenarios || [];
    for (const scenarioId of presentation.scenarioIds) {
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario || scenario.steps.length === 0) continue;

      result.push({
        type: 'title',
        stepId: scenario.steps[0].id,
        scenarioId,
        scenarioName: scenario.name,
      });

      const sorted = [...scenario.steps].sort((a, b) => a.order - b.order);
      for (const step of sorted) {
        result.push({
          type: 'overview',
          stepId: step.id,
          scenarioId,
        });
      }
    }
    return result;
  }, [presentation, hasRecordedPath, recordedPath]);

  const totalSlides = subSlides.length;
  const currentSlide = subSlides[currentIndex] || null;

  // Find step for current sub-slide
  const currentStep = useMemo(() => {
    if (!currentSlide) return null;
    const scenario = scenarioMap.get(currentSlide.scenarioId);
    if (!scenario) return null;
    return scenario.steps.find(s => s.id === currentSlide.stepId) || null;
  }, [currentSlide, scenarioMap]);

  // Current notes
  const currentNotes = useMemo(() => {
    if (!currentSlide) return { caption: '', speakerNotes: '' };

    if (currentSlide.type === 'node' && currentSlide.nodeId) {
      const nodeKey = `${currentSlide.scenarioId}:${currentSlide.stepId}:${currentSlide.nodeId}`;
      const nodeNotes = presentation.notes[nodeKey];
      if (nodeNotes) return nodeNotes;
    }

    const key = `${currentSlide.scenarioId}:${currentSlide.stepId}`;
    return presentation.notes[key] || { caption: '', speakerNotes: '' };
  }, [presentation, currentSlide]);

  // Find focused node for node slides
  const focusedNode = useMemo(() => {
    if (!currentSlide || currentSlide.type !== 'node' || !currentSlide.nodeId) return null;
    return initialNodes.find(n => n.id === currentSlide.nodeId) || null;
  }, [currentSlide, initialNodes]);

  // Apply sub-slide to canvas
  const applySlide = useCallback((slide: SubSlide) => {
    if (slide.type === 'title') return;

    const scenario = scenarioMap.get(slide.scenarioId);
    const step = scenario?.steps.find(s => s.id === slide.stepId);
    if (!step) return;

    if (slide.type === 'overview') {
      const highlightedIds = new Set(step.nodeIds);
      setNodes(initialNodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          opacity: highlightedIds.size === 0 || highlightedIds.has(node.id) ? 1 : 0.15,
        },
      })));

      if (step.viewport) {
        reactFlow.setViewport(step.viewport, { duration: 600 });
      } else if (step.nodeIds.length > 0) {
        reactFlow.fitView({
          nodes: step.nodeIds.map(id => ({ id })),
          duration: 600,
          padding: 0.3,
        });
      }
    } else if (slide.type === 'node' && slide.nodeId) {
      // Node slide: zoom to specific node
      setNodes(initialNodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          opacity: node.id === slide.nodeId ? 1 : 0.15,
        },
      })));

      const targetNode = initialNodes.find(n => n.id === slide.nodeId);
      if (targetNode) {
        const nodeWidth = targetNode.measured?.width || targetNode.width || 200;
        const nodeHeight = targetNode.measured?.height || targetNode.height || 100;
        const centerX = targetNode.position.x + nodeWidth / 2;
        const centerY = targetNode.position.y + nodeHeight / 2;

        const container = document.querySelector('.react-flow');
        const containerWidth = container?.clientWidth || 1920;
        const containerHeight = container?.clientHeight || 1080;

        const zoom = 1.5;
        reactFlow.setViewport(
          {
            x: containerWidth / 2 - centerX * zoom,
            y: containerHeight / 2 - centerY * zoom,
            zoom,
          },
          { duration: 600 },
        );
      }
    }
  }, [initialNodes, reactFlow, scenarioMap]);

  // Navigation
  const goNext = useCallback(() => {
    if (isShowingTitle) {
      setIsShowingTitle(false);
      return;
    }
    if (currentIndex >= totalSlides - 1) return;
    const nextIndex = currentIndex + 1;
    const nextSlide = subSlides[nextIndex];

    if (nextSlide?.type === 'title') {
      setIsShowingTitle(true);
      const sc = scenarioMap.get(nextSlide.scenarioId);
      setTitleScenario(sc ? { name: sc.name, color: sc.color } : null);
      setCurrentIndex(nextIndex);
      setTimeout(() => setIsShowingTitle(false), 2000);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, totalSlides, subSlides, isShowingTitle, scenarioMap]);

  const goPrev = useCallback(() => {
    if (isShowingTitle) {
      setIsShowingTitle(false);
      return;
    }
    if (currentIndex <= 0) return;
    let prevIndex = currentIndex - 1;
    if (prevIndex > 0 && subSlides[prevIndex]?.type === 'title') {
      prevIndex = Math.max(0, prevIndex - 1);
    }
    setCurrentIndex(prevIndex);
  }, [currentIndex, isShowingTitle, subSlides]);

  // Initialize first slide
  useEffect(() => {
    if (subSlides.length === 0) return;
    const first = subSlides[0];
    if (first.type === 'title') {
      setIsShowingTitle(true);
      const sc = scenarioMap.get(first.scenarioId);
      setTitleScenario(sc ? { name: sc.name, color: sc.color } : null);
      const timer = setTimeout(() => {
        setIsShowingTitle(false);
        if (subSlides.length > 1) {
          setCurrentIndex(1);
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setIsShowingTitle(false);
      applySlide(first);
    }
  }, [subSlides, applySlide, scenarioMap]);

  // Apply slide on index change
  useEffect(() => {
    if (isShowingTitle || !subSlides.length) return;
    const slide = subSlides[currentIndex];
    if (slide) applySlide(slide);
  }, [currentIndex, isShowingTitle, subSlides, applySlide]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  // Stale recorded path check
  if (hasRecordedPath) {
    const allNodeIds = new Set(initialNodes.map(n => n.id));
    const hasStaleNode = recordedPath!.subSlideSequence.some(
      s => s.type === 'node' && s.nodeId && !allNodeIds.has(s.nodeId)
    );
    if (hasStaleNode) {
      return (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">{presentation.name}</h1>
            <p className="text-gray-400">This presentation is being updated. Please check back later.</p>
          </div>
        </div>
      );
    }
  }

  // Empty state
  if (totalSlides === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{presentation.name}</h1>
          <p className="text-gray-400">This presentation has no slides.</p>
        </div>
      </div>
    );
  }

  const isTitle = currentSlide?.type === 'title';
  const isNodeSlide = currentSlide?.type === 'node';

  return (
    <div className="fixed inset-0 bg-gray-900">
      {/* Title slide */}
      <AnimatePresence>
        {isShowingTitle && titleScenario && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-gray-900 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="w-4 h-4 rounded-full mx-auto mb-4" style={{ backgroundColor: titleScenario.color }} />
              <h1 className="text-4xl font-bold text-white">{titleScenario.name}</h1>
              {titleScenario.description && (
                <p className="text-gray-300 text-lg mt-2 max-w-xl mx-auto">{titleScenario.description}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
        <MiniMap nodeColor={getMiniMapNodeColor} style={{ bottom: 80, right: 16, width: 120, height: 80, opacity: 0.6 }} pannable={false} zoomable={false} />
      </ReactFlow>

      {/* Node slide card */}
      <NodeSlideCard
        node={focusedNode}
        isVisible={isNodeSlide && !!focusedNode}
      />

      {/* Navigation zones */}
      {totalSlides > 1 && !isTitle && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-1/3 z-30 cursor-pointer" onClick={goPrev} />
          <div className="absolute right-0 top-0 bottom-0 w-1/3 z-30 cursor-pointer" onClick={goNext} />
        </>
      )}

      {/* Progress dots */}
      <div className="absolute top-3 left-4 right-4 z-40 flex items-center gap-0.5 max-w-full overflow-hidden">
        {subSlides.map((slide, i) => (
          <div
            key={i}
            className={`rounded-full transition-all flex-shrink-0 ${
              i === currentIndex
                ? 'w-6 h-1 bg-white'
                : i < currentIndex
                ? `h-1 bg-white/60 ${slide.type === 'overview' ? 'w-3' : 'w-1.5'}`
                : `h-1 bg-white/20 ${slide.type === 'overview' ? 'w-3' : 'w-1.5'}`
            }`}
          />
        ))}
      </div>

      {/* Caption */}
      {!isTitle && currentNotes.caption && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentIndex}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-2xl"
        >
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-6 py-3">
            <p className="text-white text-sm text-center">{currentNotes.caption}</p>
          </div>
        </motion.div>
      )}

      {/* Presentation name */}
      <div className="absolute bottom-3 left-4 z-40">
        <span className="text-white/30 text-[10px]">{presentation.name}</span>
      </div>
    </div>
  );
}

export function PublicPresentation(props: PublicPresentationProps) {
  return (
    <ReactFlowProvider>
      <PublicPresentationInner {...props} />
    </ReactFlowProvider>
  );
}
