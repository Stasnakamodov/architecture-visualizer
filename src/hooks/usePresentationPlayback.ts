'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '@/stores/canvasStore';
import { buildNodeTraversalOrder } from '@/lib/presentation/graphTraversal';
import type { Presentation, Step, SubSlide, BranchPoint, AppNode } from '@/types/canvas';
import type { Scenario } from '@/stores/canvasStore';

// Legacy export for backward compatibility (PresenterPanel still uses it)
export interface FlattenedStep {
  scenarioId: string;
  scenarioName: string;
  scenarioColor: string;
  step: Step;
  isFirstInScenario: boolean;
  globalIndex: number;
}

export interface SubSlideEntry {
  subSlide: SubSlide;
  scenarioName: string;
  scenarioColor: string;
  step: Step;                  // parent step (for overview context)
  focusedNodeId: string | null; // node to zoom to (null for overview/title)
}

interface UsePresentationPlaybackResult {
  // New sub-slide based navigation
  subSlides: SubSlideEntry[];
  currentSubSlide: SubSlideEntry | null;
  currentIndex: number;
  totalSubSlides: number;
  currentBranchPoint: BranchPoint | null;

  // Legacy compat
  flatSteps: FlattenedStep[];
  isShowingTitleSlide: boolean;
  titleSlideScenario: Scenario | null;
  currentStep: FlattenedStep | null;
  totalSteps: number;

  // Playback state
  isAutoplayActive: boolean;
  autoplayProgress: number;
  elapsedSeconds: number;

  // Actions
  goNext: () => void;
  goPrev: () => void;
  goToIndex: (index: number) => void;
  toggleAutoplay: () => void;
  selectBranch: (targetNodeId: string) => void;
}

export function usePresentationPlayback(presentation: Presentation | null): UsePresentationPlaybackResult {
  const { scenarios, nodes, edges, setNodes } = useCanvasStore();
  const reactFlow = useReactFlow();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoplayActive, setIsAutoplayActive] = useState(false);
  const [autoplayProgress, setAutoplayProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [activeBranchPoint, setActiveBranchPoint] = useState<BranchPoint | null>(null);

  const startTimeRef = useRef(Date.now());
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Build sub-slide sequence from presentation scenarios
  const subSlides = useMemo(() => {
    if (!presentation) return [];
    const result: SubSlideEntry[] = [];
    const allNodes = useCanvasStore.getState().nodes;
    const allEdges = useCanvasStore.getState().edges;

    for (let sIdx = 0; sIdx < presentation.scenarioIds.length; sIdx++) {
      const scenarioId = presentation.scenarioIds[sIdx];
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario || scenario.steps.length === 0) continue;

      // Title sub-slide for scenario
      result.push({
        subSlide: {
          type: 'title',
          stepId: scenario.steps[0].id,
          scenarioId,
          scenarioName: scenario.name,
          scenarioDescription: '', // Description can be added later
        },
        scenarioName: scenario.name,
        scenarioColor: scenario.color,
        step: scenario.steps[0],
        focusedNodeId: null,
      });

      const sorted = [...scenario.steps].sort((a, b) => a.order - b.order);

      for (const step of sorted) {
        // Overview sub-slide for this step
        result.push({
          subSlide: {
            type: 'overview',
            stepId: step.id,
            scenarioId,
          },
          scenarioName: scenario.name,
          scenarioColor: scenario.color,
          step,
          focusedNodeId: null,
        });

        // Node sub-slides: traverse graph to determine order
        if (step.nodeIds.length > 0) {
          const { orderedNodeIds } = buildNodeTraversalOrder(
            step.nodeIds,
            allEdges,
            step.nodePositions,
          );

          for (const nodeId of orderedNodeIds) {
            result.push({
              subSlide: {
                type: 'node',
                stepId: step.id,
                scenarioId,
                nodeId,
              },
              scenarioName: scenario.name,
              scenarioColor: scenario.color,
              step,
              focusedNodeId: nodeId,
            });
          }
        }
      }
    }

    return result;
  }, [presentation, scenarios]);

  // Compute branch points for all steps (for detecting at runtime)
  const stepBranchPoints = useMemo(() => {
    if (!presentation) return new Map<string, BranchPoint[]>();
    const allEdges = useCanvasStore.getState().edges;
    const allNodes = useCanvasStore.getState().nodes;
    const map = new Map<string, BranchPoint[]>();

    for (const scenarioId of presentation.scenarioIds) {
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario) continue;

      for (const step of scenario.steps) {
        if (step.nodeIds.length > 0) {
          const { branchPoints } = buildNodeTraversalOrder(
            step.nodeIds,
            allEdges,
            step.nodePositions,
          );

          // Resolve labels for branch points
          const resolved = branchPoints.map(bp => ({
            ...bp,
            targetLabels: bp.targetNodeIds.map(id => {
              const node = allNodes.find(n => n.id === id);
              return node?.data?.label || id;
            }),
          }));

          if (resolved.length > 0) {
            map.set(`${scenarioId}:${step.id}`, resolved);
          }
        }
      }
    }

    return map;
  }, [presentation, scenarios]);

  const currentSubSlide = subSlides[currentIndex] || null;
  const totalSubSlides = subSlides.length;

  // Check if current sub-slide is at a branch point
  const currentBranchPoint = useMemo(() => {
    if (!currentSubSlide || currentSubSlide.subSlide.type !== 'node') return activeBranchPoint;
    const key = `${currentSubSlide.subSlide.scenarioId}:${currentSubSlide.step.id}`;
    const bps = stepBranchPoints.get(key) || [];
    const bp = bps.find(b => b.sourceNodeId === currentSubSlide.focusedNodeId);
    return bp || null;
  }, [currentSubSlide, stepBranchPoints, activeBranchPoint]);

  // Legacy compatibility: derive flatSteps from subSlides
  const flatSteps = useMemo(() => {
    if (!presentation) return [];
    const result: FlattenedStep[] = [];
    let globalIndex = 0;
    for (const scenarioId of presentation.scenarioIds) {
      const scenario = scenarios.find(s => s.id === scenarioId);
      if (!scenario || scenario.steps.length === 0) continue;
      const sorted = [...scenario.steps].sort((a, b) => a.order - b.order);
      for (let i = 0; i < sorted.length; i++) {
        result.push({
          scenarioId,
          scenarioName: scenario.name,
          scenarioColor: scenario.color,
          step: sorted[i],
          isFirstInScenario: i === 0,
          globalIndex,
        });
        globalIndex++;
      }
    }
    return result;
  }, [presentation, scenarios]);

  // Derive legacy properties from current sub-slide
  const isShowingTitleSlide = currentSubSlide?.subSlide.type === 'title';
  const titleSlideScenario = isShowingTitleSlide
    ? scenarios.find(s => s.id === currentSubSlide?.subSlide.scenarioId) || null
    : null;
  const currentStep = currentSubSlide
    ? flatSteps.find(f => f.step.id === currentSubSlide.step.id && f.scenarioId === currentSubSlide.subSlide.scenarioId) || null
    : null;
  const totalSteps = flatSteps.length;

  // Apply sub-slide to canvas
  const applySubSlide = useCallback((entry: SubSlideEntry) => {
    const currentNodes = useCanvasStore.getState().nodes;
    const { step, focusedNodeId, subSlide } = entry;

    if (subSlide.type === 'title') {
      // Title slide: no canvas changes needed
      return;
    }

    // Apply node positions if available
    if (step.nodePositions) {
      const positions = step.nodePositions;
      const repositionedNodes = currentNodes.map(node => {
        const saved = positions[node.id];
        if (saved) {
          return { ...node, position: { x: saved.x, y: saved.y } };
        }
        return node;
      });
      setNodes(repositionedNodes);
    }

    if (subSlide.type === 'overview') {
      // Overview: highlight step nodes, dim rest
      const highlightedIds = new Set(step.nodeIds);
      const updatedNodes = useCanvasStore.getState().nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          opacity: highlightedIds.size === 0 || highlightedIds.has(node.id) ? 1 : 0.15,
        },
      }));
      setNodes(updatedNodes);

      // Viewport: saved or fit to highlighted
      if (step.viewport) {
        reactFlow.setViewport(step.viewport, { duration: 600 });
      } else if (step.nodeIds.length > 0) {
        reactFlow.fitView({
          nodes: step.nodeIds.map(id => ({ id })),
          duration: 600,
          padding: 0.3,
        });
      }
    } else if (subSlide.type === 'node' && focusedNodeId) {
      // Node slide: highlight only the focused node, dim rest
      const updatedNodes = useCanvasStore.getState().nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          opacity: node.id === focusedNodeId ? 1 : 0.15,
        },
      }));
      setNodes(updatedNodes);

      // Zoom to focused node
      const targetNode = useCanvasStore.getState().nodes.find(n => n.id === focusedNodeId);
      if (targetNode) {
        const nodeWidth = targetNode.measured?.width || targetNode.width || 200;
        const nodeHeight = targetNode.measured?.height || targetNode.height || 100;
        const centerX = targetNode.position.x + nodeWidth / 2;
        const centerY = targetNode.position.y + nodeHeight / 2;

        // Get container dimensions
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
  }, [reactFlow, setNodes]);

  // Initialize with first sub-slide
  useEffect(() => {
    if (subSlides.length === 0) return;
    startTimeRef.current = Date.now();
    setCurrentIndex(0);

    const first = subSlides[0];
    if (first.subSlide.type === 'title') {
      // Auto-advance title slide after 2s
      const timer = setTimeout(() => {
        if (subSlides.length > 1) {
          setCurrentIndex(1);
        }
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      applySubSlide(first);
    }
  }, [subSlides, applySubSlide]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize autoplay from presentation settings
  useEffect(() => {
    if (presentation?.settings.autoplay) {
      setIsAutoplayActive(true);
    }
  }, [presentation?.settings.autoplay]);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Autoplay timer
  useEffect(() => {
    const isTitleSlide = currentSubSlide?.subSlide.type === 'title';
    const hasBranch = currentBranchPoint !== null;

    if (!isAutoplayActive || isTitleSlide || hasBranch || !presentation) {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      return;
    }

    const interval = presentation.settings.autoplayInterval;
    const tickMs = 50;
    let progress = 0;

    autoplayTimerRef.current = setInterval(() => {
      progress += (tickMs / interval) * 100;
      setAutoplayProgress(Math.min(progress, 100));

      if (progress >= 100) {
        if (currentIndex < totalSubSlides - 1) {
          setCurrentIndex(prev => prev + 1);
          progress = 0;
          setAutoplayProgress(0);
        } else {
          setIsAutoplayActive(false);
          setAutoplayProgress(0);
          if (autoplayTimerRef.current) {
            clearInterval(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
          }
        }
      }
    }, tickMs);

    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, [isAutoplayActive, currentSubSlide, currentBranchPoint, presentation, currentIndex, totalSubSlides, resetKey]);

  // Apply sub-slide when currentIndex changes
  useEffect(() => {
    if (subSlides.length === 0) return;
    const entry = subSlides[currentIndex];
    if (entry) {
      applySubSlide(entry);
      setActiveBranchPoint(null); // Clear active branch when navigating
    }
  }, [currentIndex, subSlides, applySubSlide]);

  const goNext = useCallback(() => {
    if (currentIndex >= totalSubSlides - 1) return;

    const nextIndex = currentIndex + 1;
    const nextEntry = subSlides[nextIndex];

    if (nextEntry?.subSlide.type === 'title') {
      // Show title, then auto-advance after 2s
      setCurrentIndex(nextIndex);
      setTimeout(() => {
        if (nextIndex + 1 < totalSubSlides) {
          setCurrentIndex(nextIndex + 1);
        }
      }, 2000);
    } else {
      setCurrentIndex(nextIndex);
    }

    setAutoplayProgress(0);
    setResetKey(prev => prev + 1);
  }, [currentIndex, totalSubSlides, subSlides]);

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;

    // Skip back over title slides
    let prevIndex = currentIndex - 1;
    if (prevIndex > 0 && subSlides[prevIndex]?.subSlide.type === 'title') {
      prevIndex = Math.max(0, prevIndex - 1);
    }

    setCurrentIndex(prevIndex);
    setAutoplayProgress(0);
    setResetKey(prev => prev + 1);
  }, [currentIndex, subSlides]);

  const goToIndex = useCallback((index: number) => {
    if (index < 0 || index >= totalSubSlides) return;
    setCurrentIndex(index);
    setAutoplayProgress(0);
    setResetKey(prev => prev + 1);
  }, [totalSubSlides]);

  const toggleAutoplay = useCallback(() => {
    setIsAutoplayActive(prev => !prev);
    setAutoplayProgress(0);
    setResetKey(prev => prev + 1);
  }, []);

  const selectBranch = useCallback((targetNodeId: string) => {
    // Find the sub-slide for the selected branch target node
    if (!currentSubSlide) return;
    const { scenarioId, stepId } = currentSubSlide.subSlide;

    const targetIndex = subSlides.findIndex(
      (s, i) =>
        i > currentIndex &&
        s.subSlide.type === 'node' &&
        s.subSlide.nodeId === targetNodeId &&
        s.subSlide.scenarioId === scenarioId &&
        s.subSlide.stepId === stepId,
    );

    if (targetIndex !== -1) {
      setCurrentIndex(targetIndex);
      setActiveBranchPoint(null);
      setAutoplayProgress(0);
      setResetKey(prev => prev + 1);
    }
  }, [currentIndex, currentSubSlide, subSlides]);

  return {
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
  };
}
