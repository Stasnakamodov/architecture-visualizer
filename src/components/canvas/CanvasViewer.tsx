'use client';

import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeParams,
  type Connection,
  ConnectionMode,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TechNode, DatabaseNode, BusinessNode, GroupNode, EditableNode, CommentNode, ShapeNode } from './nodes';
import { CustomEdge } from './edges/CustomEdge';
import { FileModal } from './FileModal';
import { NodeDetailModal } from './NodeDetailModal';
import { ShapeToolbar } from './ShapeToolbar';
import { LayoutToolbar } from './LayoutToolbar';
import { HistoryControls } from './HistoryControls';
import { PropertyPanel } from './PropertyPanel';
import { StepEditToolbar } from './StepEditToolbar';
import { useTemporalStore } from './useTemporalStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useHydration } from '@/hooks/useHydration';
import { applyLayout, type LayoutType, type LayoutDirection, shouldUsePresentationRouting } from '@/lib/layout';
import type { AppNode, AppEdge, ShapeNodeData } from '@/types/canvas';
import { useTranslation } from '@/i18n/context';
import { useTheme } from 'next-themes';

interface CanvasViewerProps {
  initialNodes: AppNode[];
  initialEdges: AppEdge[];
  className?: string;
  onSave?: () => void;
  onShowSaved?: () => void;
  onClose?: () => void;
}

const nodeTypes: NodeTypes = {
  tech: TechNode,
  database: DatabaseNode,
  business: BusinessNode,
  group: GroupNode,
  editable: EditableNode,
  comment: CommentNode,
  shape: ShapeNode,
  default: TechNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
  default: CustomEdge,
};

const nodeColor = (node: AppNode) => {
  switch (node.type) {
    case 'tech':
      return '#3b82f6';
    case 'database':
      return '#8b5cf6';
    case 'business':
      return '#6366f1';
    case 'group':
      return '#6b7280';
    case 'comment':
      return '#f59e0b';
    case 'shape':
      return (node.data as ShapeNodeData).borderColor || '#3b82f6';
    default:
      return '#9ca3af';
  }
};

// Inner component that can use useReactFlow
function CanvasViewerInner({
  initialNodes,
  initialEdges,
  className = '',
  onSave,
  onShowSaved,
  onClose,
}: CanvasViewerProps) {
  const hasHydrated = useHydration();
  const {
    viewMode,
    selectNode,
    selectedNodeId,
    selectedNodeIds,
    toggleNodeSelection,
    clearSelection,
    createGroup,
    createComment,
    createShape,
    activeTool,
    pendingShapeType,
    setActiveTool,
    setPendingShapeType,
    nodes: storeNodes,
    edges: storeEdges,
    visualGroups,
    activeVisualGroupId,
    isSelectingForGroup,
    selectedForGroup,
    toggleNodeForGroup,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    savePreLayoutPositions,
    setCurrentLayoutType,
    currentLayoutType,
    markDirty,
    steps,
    activeStepId,
    isStepperActive,
    getVisibleNodeIdsForStep,
    editingStepId,
    toggleNodeInStep,
    cancelStepEditing,
  } = useCanvasStore();

  const reactFlow = useReactFlow();
  const { setCenter, setViewport: rfSetViewport, getNode, screenToFlowPosition, fitView: rfFitView } = reactFlow;
  const { undo, redo } = useTemporalStore();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();

  // Use persisted data if available after hydration, otherwise use props
  const effectiveInitialNodes = hasHydrated && storeNodes.length > 0 ? storeNodes : initialNodes;
  const effectiveInitialEdges = hasHydrated && storeNodes.length > 0 ? storeEdges : initialEdges;

  const [nodes, setNodes, onNodesChange] = useNodesState(effectiveInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(effectiveInitialEdges);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [modalNode, setModalNode] = useState<AppNode | null>(null);
  const [detailModalNode, setDetailModalNode] = useState<AppNode | null>(null);
  const prevSelectedNodeId = useRef<string | null>(null);
  const prevStoreNodesLength = useRef(storeNodes.length);
  const hasRestoredFromStore = useRef(false);
  const isInitialLoad = useRef(true);
  const isApplyingStepPositions = useRef(false);

  // Restore from persisted store after hydration
  useEffect(() => {
    if (hasHydrated && !hasRestoredFromStore.current && storeNodes.length > 0) {
      setNodes(storeNodes);
      setEdges(storeEdges);
      hasRestoredFromStore.current = true;
      prevStoreNodesLength.current = storeNodes.length;
    }
  }, [hasHydrated, storeNodes, storeEdges, setNodes, setEdges]);

  // Блокируем markDirty во время начальной загрузки (fitView генерирует position changes)
  useEffect(() => {
    isInitialLoad.current = true;
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Center on selected node when it changes (from FileTree click)
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== prevSelectedNodeId.current) {
      // Use setTimeout to ensure ReactFlow has processed the nodes
      const timeoutId = setTimeout(() => {
        // Try ReactFlow's internal state first (has measured dimensions)
        let node = getNode(selectedNodeId);

        // Fallback to local nodes if not found in ReactFlow's state
        if (!node) {
          node = nodes.find(n => n.id === selectedNodeId) as typeof node;
        }

        if (node) {
          const x = node.position.x + (node.measured?.width || 150) / 2;
          const y = node.position.y + (node.measured?.height || 60) / 2;
          setCenter(x, y, { duration: 500, zoom: 1 });
        }
      }, 50);

      prevSelectedNodeId.current = selectedNodeId;
      return () => clearTimeout(timeoutId);
    } else if (!selectedNodeId) {
      prevSelectedNodeId.current = null;
    }
  }, [selectedNodeId, setCenter, getNode, nodes]);

  // Sync local nodes TO store (guarded to prevent loops during step position apply)
  useEffect(() => {
    if (isApplyingStepPositions.current) return;
    setStoreNodes(nodes);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    setStoreEdges(edges);
  }, [edges, setStoreEdges]);

  // Sync store node POSITIONS to React Flow local nodes (for step navigation)
  const prevStoreNodePositionsRef = useRef<string>('');
  useEffect(() => {
    if (!isStepperActive) return;
    // Build a position fingerprint to detect position-only changes from the store
    const posFingerprint = storeNodes.map(n => `${n.id}:${n.position.x},${n.position.y}`).join('|');
    if (posFingerprint === prevStoreNodePositionsRef.current) return;
    prevStoreNodePositionsRef.current = posFingerprint;

    // Check if any local node positions differ from store
    let hasDiff = false;
    for (const storeNode of storeNodes) {
      const localNode = nodes.find(n => n.id === storeNode.id);
      if (localNode && (localNode.position.x !== storeNode.position.x || localNode.position.y !== storeNode.position.y)) {
        hasDiff = true;
        break;
      }
    }
    if (!hasDiff) return;

    isApplyingStepPositions.current = true;
    setNodes(currentNodes =>
      currentNodes.map(node => {
        const storeNode = storeNodes.find(n => n.id === node.id);
        if (storeNode) {
          return { ...node, position: { x: storeNode.position.x, y: storeNode.position.y } };
        }
        return node;
      })
    );
    // Reset flag after React processes the update
    requestAnimationFrame(() => {
      isApplyingStepPositions.current = false;
    });
  }, [storeNodes, isStepperActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync node DATA changes FROM store (when edited via PropertyPanel/Modal)
  useEffect(() => {
    // Check if any node data has changed (not position, just data)
    let hasDataChanges = false;
    const updatedNodes = nodes.map(localNode => {
      const storeNode = storeNodes.find(n => n.id === localNode.id);
      if (storeNode && JSON.stringify(localNode.data) !== JSON.stringify(storeNode.data)) {
        hasDataChanges = true;
        return { ...localNode, data: storeNode.data };
      }
      return localNode;
    }) as AppNode[];

    if (hasDataChanges) {
      setNodes(updatedNodes);
    }
  }, [storeNodes]); // Only trigger when store changes

  // Sync new nodes FROM store (when document is added to canvas)
  useEffect(() => {
    if (storeNodes.length > prevStoreNodesLength.current) {
      const localIds = new Set(nodes.map(n => n.id));
      const newNodes = storeNodes.filter(n => !localIds.has(n.id));

      if (newNodes.length > 0) {
        setNodes(nds => [...nds, ...newNodes]);

        // Center on the new node
        const newNode = newNodes[0];
        setTimeout(() => {
          const x = newNode.position.x + 100;
          const y = newNode.position.y + 60;
          setCenter(x, y, { duration: 300, zoom: 1 });
        }, 50);
      }
    }
    prevStoreNodesLength.current = storeNodes.length;
  }, [storeNodes, nodes, setNodes, setCenter]);

  // Get active visual group's node IDs
  const activeGroupNodeIds = useMemo(() => {
    if (!activeVisualGroupId) return null;
    const group = visualGroups.find(g => g.id === activeVisualGroupId);
    return group ? new Set(group.nodeIds) : null;
  }, [activeVisualGroupId, visualGroups]);

  // Set of nodes selected for new group
  const selectedForGroupSet = useMemo(() => new Set(selectedForGroup), [selectedForGroup]);

  // Stepper: get visible node IDs for current step
  const stepVisibleNodeIds = useMemo(() => {
    return getVisibleNodeIdsForStep();
  }, [getVisibleNodeIdsForStep, steps, activeStepId, isStepperActive]);

  // Inline step editing: compute which nodes are in the editing step
  const editingStepNodeIds = useMemo(() => {
    if (!editingStepId) return null;
    const step = steps.find(s => s.id === editingStepId);
    return step ? new Set(step.nodeIds) : new Set<string>();
  }, [editingStepId, steps]);

  // Stepper: animate viewport on step change
  const prevActiveStepId = useRef<string | null>(null);
  useEffect(() => {
    if (!isStepperActive || !activeStepId || activeStepId === prevActiveStepId.current) {
      prevActiveStepId.current = activeStepId;
      return;
    }
    prevActiveStepId.current = activeStepId;

    const sorted = [...steps].sort((a, b) => a.order - b.order);
    const activeStep = sorted.find(s => s.id === activeStepId);
    if (!activeStep) return;

    // Small delay to allow React Flow to process node changes
    const timer = setTimeout(() => {
      if (activeStep.viewport) {
        // Restore exact viewport transform (pan + zoom) saved by getViewport()
        rfSetViewport(
          { x: activeStep.viewport.x, y: activeStep.viewport.y, zoom: activeStep.viewport.zoom },
          { duration: 500 },
        );
      } else if (activeStep.nodeIds.length > 0) {
        // No saved viewport — fit to visible nodes
        const visibleNodeIds = stepVisibleNodeIds;
        if (visibleNodeIds) {
          const visibleNodes = nodes.filter(n => visibleNodeIds.has(n.id));
          if (visibleNodes.length > 0) {
            rfFitView({
              nodes: visibleNodes,
              padding: 0.2,
              duration: 500,
            });
          }
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeStepId, isStepperActive, steps, rfSetViewport, rfFitView, nodes, stepVisibleNodeIds]);

  // Filter nodes by view mode and mark selected, apply dimming for visual groups and stepper
  const filteredNodes = useMemo(() => {
    // Layer 1: ViewMode — hard filter (removes nodes)
    let result = nodes;
    if (viewMode === 'executive') {
      result = nodes.filter((n) => ['business', 'group'].includes(n.type || ''));
    }

    // Inline step editing mode: override all dimming
    if (editingStepNodeIds !== null) {
      return result.map((node) => {
        const isInEditingStep = editingStepNodeIds.has(node.id);
        return {
          ...node,
          selected: false, // suppress React Flow selection ring
          className: isInEditingStep ? 'ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : '',
          style: {
            ...node.style,
            opacity: isInEditingStep ? 1 : 0.3,
            transition: 'opacity 0.3s ease, box-shadow 0.2s ease',
            cursor: 'pointer',
            boxShadow: isInEditingStep
              ? '0 0 0 4px rgba(59, 130, 246, 0.5)'
              : undefined,
          },
        };
      });
    }

    // Layer 2 & 3: Stepper + Collection — soft dimming
    return result.map((node) => {
      const isInActiveGroup = activeGroupNodeIds ? activeGroupNodeIds.has(node.id) : true;
      const isInActiveStep = stepVisibleNodeIds ? stepVisibleNodeIds.has(node.id) : true;
      const isSelectedForGroup = selectedForGroupSet.has(node.id);

      // Combine opacity: min of step and collection
      const stepOpacity = isInActiveStep ? 1 : 0.15;
      const collectionOpacity = isInActiveGroup ? 1 : 0.25;
      const combinedOpacity = Math.min(stepOpacity, collectionOpacity);

      return {
        ...node,
        selected: node.id === selectedNodeId,
        className: isSelectingForGroup && isSelectedForGroup ? 'ring-4 ring-green-500 ring-offset-2' : '',
        style: {
          ...node.style,
          opacity: combinedOpacity,
          transition: 'opacity 0.3s ease, box-shadow 0.2s ease',
          boxShadow: isSelectingForGroup && isSelectedForGroup
            ? '0 0 0 4px rgba(34, 197, 94, 0.5)'
            : undefined,
        },
      };
    });
  }, [nodes, viewMode, selectedNodeId, activeGroupNodeIds, stepVisibleNodeIds, isSelectingForGroup, selectedForGroupSet, editingStepNodeIds]);

  // Node type to color mapping (matches node border colors)
  const typeColors: Record<string, string> = {
    tech: '#3b82f6',      // blue
    database: '#8b5cf6',  // purple
    business: '#6366f1',  // indigo (matches BusinessNode)
    group: '#6b7280',     // gray
    comment: '#f59e0b',   // amber
    editable: '#3b82f6',  // blue
    text: '#6b7280',      // gray
  };

  // Check if presentation routing is active (for edge routing)
  const usePresentationRouting = shouldUsePresentationRouting();

  // Filter edges - only show connections between visible nodes, highlight connected edges
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const nodeMap = new Map(filteredNodes.map((n) => [n.id, n]));

    return edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        const isSelected = selectedNodeId
          ? edge.source === selectedNodeId || edge.target === selectedNodeId
          : false;

        // Resolve edge colors based on node data.color (custom color)
        const srcDataColor = (sourceNode?.data as Record<string, unknown>)?.color as string | undefined;
        const tgtDataColor = (targetNode?.data as Record<string, unknown>)?.color as string | undefined;
        const hasNodeColors = !!srcDataColor || !!tgtDataColor;


        let edgeSourceColor: string;
        let edgeTargetColor: string;
        if (srcDataColor && tgtDataColor) {
          // Both colored → gradient between the two
          edgeSourceColor = srcDataColor;
          edgeTargetColor = tgtDataColor;
        } else if (srcDataColor) {
          // Only source colored → solid source color
          edgeSourceColor = srcDataColor;
          edgeTargetColor = srcDataColor;
        } else if (tgtDataColor) {
          // Only target colored → solid target color
          edgeSourceColor = tgtDataColor;
          edgeTargetColor = tgtDataColor;
        } else {
          // Neither colored → fallback to type colors
          edgeSourceColor = typeColors[sourceNode?.type || ''] || '#6366f1';
          edgeTargetColor = typeColors[targetNode?.type || ''] || '#6366f1';
        }

        // Inline step editing mode: override edge dimming
        if (editingStepNodeIds !== null) {
          const bothInStep = editingStepNodeIds.has(edge.source) && editingStepNodeIds.has(edge.target);
          return {
            ...edge,
            type: 'custom',
            selected: false,
            style: {
              opacity: bothInStep ? 1 : 0.15,
              transition: 'opacity 0.3s ease',
            },
            data: {
              ...edge.data,
              sourceColor: edgeSourceColor,
              targetColor: edgeTargetColor,
              showGradient: bothInStep && hasNodeColors,
              usePresentationRouting,
            },
          };
        }

        // Check if edge connects nodes in active group
        const isInActiveGroup = activeGroupNodeIds
          ? activeGroupNodeIds.has(edge.source) && activeGroupNodeIds.has(edge.target)
          : true;

        // Check if edge connects nodes in active step
        const isInActiveStep = stepVisibleNodeIds
          ? stepVisibleNodeIds.has(edge.source) && stepVisibleNodeIds.has(edge.target)
          : true;

        // Combine opacity: min of step and collection
        const stepOpacity = isInActiveStep ? 1 : 0.15;
        const collectionOpacity = isInActiveGroup ? 1 : 0.15;
        const combinedOpacity = activeGroupNodeIds || stepVisibleNodeIds
          ? Math.min(stepOpacity, collectionOpacity)
          : 1;

        // Determine if this edge should show gradient/color
        const showGradient = hasNodeColors || isSelected || (activeGroupNodeIds !== null && isInActiveGroup);

        return {
          ...edge,
          type: 'custom',
          selected: isSelected,
          style: {
            opacity: combinedOpacity,
            transition: 'opacity 0.3s ease',
          },
          data: {
            ...edge.data,
            sourceColor: edgeSourceColor,
            targetColor: edgeTargetColor,
            showGradient: showGradient || false,
            usePresentationRouting,
          },
        };
      });
  }, [edges, filteredNodes, selectedNodeId, activeGroupNodeIds, stepVisibleNodeIds, usePresentationRouting, editingStepNodeIds]);

  const handleNodesChange: OnNodesChange<AppNode> = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Не помечать dirty во время начальной загрузки (fitView двигает ноды)
      if (isInitialLoad.current) return;
      // Mark as dirty only for real user changes (position, add, remove, replace)
      // Skip 'dimensions' (React Flow measuring) and 'select' (selection state)
      const hasUserChanges = changes.some(
        (c) => c.type !== 'dimensions' && c.type !== 'select'
      );
      if (hasUserChanges) {
        markDirty();
      }
    },
    [onNodesChange, markDirty]
  );

  const handleEdgesChange: OnEdgesChange<AppEdge> = useCallback(
    (changes) => {
      onEdgesChange(changes);
      // Не помечать dirty во время начальной загрузки
      if (isInitialLoad.current) return;
      const hasRealChanges = changes.some((c) => c.type !== 'select');
      if (hasRealChanges) {
        markDirty();
      }
    },
    [onEdgesChange, markDirty]
  );

  // Handle new edge connections
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'custom',
            data: { edgeType: 'arrow', lineStyle: 'solid' },
          },
          eds
        )
      );
      markDirty();
    },
    [setEdges, markDirty]
  );

  // Handle node deletion - also remove connected edges
  const onNodesDelete = useCallback(
    (deleted: AppNode[]) => {
      const deletedIds = new Set(deleted.map((n) => n.id));
      setEdges((eds) =>
        eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target))
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      if (editingStepId) {
        toggleNodeInStep(node.id);
      } else if (isSelectingForGroup) {
        toggleNodeForGroup(node.id);
      } else {
        selectNode(node.id);
      }
    },
    [selectNode, isSelectingForGroup, toggleNodeForGroup, editingStepId, toggleNodeInStep]
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: AppNode) => {
      // For comments and shapes, open the detail modal for editing
      if (node.type === 'comment' || node.type === 'shape') {
        setDetailModalNode(node);
        return;
      }
      // For other nodes, check if they have full content to show
      const data = node.data as any;
      if (data?.fullContent) {
        setModalNode(node);
      }
    },
    []
  );

  const handleModalLinkClick = useCallback((linkName: string) => {
    // Find and open the linked node
    const targetNode = nodes.find(
      (n) => n.id === linkName || n.data.label.includes(linkName) || n.id.includes(linkName)
    );
    if (targetNode) {
      const data = targetNode.data as any;
      if (data?.fullContent) {
        setModalNode(targetNode);
      }
      selectNode(targetNode.id);
    }
  }, [nodes, selectNode]);

  // Open detail modal for editing
  const handleExpandNode = useCallback((node: AppNode) => {
    setDetailModalNode(node);
  }, []);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    // Handle shape creation mode
    if (activeTool === 'shape' && pendingShapeType) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Create shape in store and get ID
      const shapeId = createShape(position, pendingShapeType);

      // Also add to local nodes state immediately for instant feedback
      const defaultSizes: Record<string, { width: number; height: number }> = {
        rectangle: { width: 150, height: 80 },
        rounded: { width: 150, height: 80 },
        diamond: { width: 100, height: 100 },
        text: { width: 200, height: 40 },
      };
      const size = defaultSizes[pendingShapeType];

      const newShape: AppNode = {
        id: shapeId,
        type: 'shape',
        position,
        style: { width: size.width, height: size.height },
        data: {
          label: pendingShapeType === 'text' ? 'Text' : '',
          shapeType: pendingShapeType,
          fillColor: '#ffffff',
          borderColor: '#3b82f6',
          borderStyle: 'solid',
          ...size,
        },
      };

      setNodes((nds) => [...nds, newShape]);
      markDirty();
      return;
    }

    // During inline step editing, skip deselection
    if (editingStepId) return;

    selectNode(null);
    clearSelection();
  }, [selectNode, clearSelection, activeTool, pendingShapeType, screenToFlowPosition, createShape, setNodes, markDirty, editingStepId]);

  // Double click on pane to create a comment
  const onPaneDoubleClick = useCallback((event: React.MouseEvent) => {
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Create comment in store
    const commentId = createComment(position);

    // Also add to local nodes state
    const newComment: AppNode = {
      id: commentId,
      type: 'comment',
      position,
      data: {
        label: '',
        description: 'User comment',
        createdAt: new Date().toISOString(),
      },
      style: { width: 200, height: 120 },
    };

    setNodes((nds) => [...nds, newComment]);
    markDirty();
  }, [screenToFlowPosition, createComment, setNodes, markDirty]);

  // Add comment via button (centered in view)
  const handleAddComment = useCallback(() => {
    // Get center of current view
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const commentId = createComment(position);

    const newComment: AppNode = {
      id: commentId,
      type: 'comment',
      position,
      data: {
        label: '',
        description: 'User comment',
        createdAt: new Date().toISOString(),
      },
      style: { width: 200, height: 120 },
    };

    setNodes((nds) => [...nds, newComment]);
    markDirty();
  }, [screenToFlowPosition, createComment, setNodes, markDirty]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    if (selectedNodes.length > 1) {
      // Multi-selection via selection box
      const ids = selectedNodes.map(n => n.id);
      ids.forEach(id => {
        if (!selectedNodeIds.includes(id)) {
          toggleNodeSelection(id);
        }
      });
    }
  }, [selectedNodeIds, toggleNodeSelection]);

  const handleCreateGroup = useCallback(() => {
    if (groupName.trim() && selectedNodeIds.length >= 2) {
      createGroup(groupName.trim());
      setGroupName('');
      setShowGroupDialog(false);
    }
  }, [groupName, selectedNodeIds.length, createGroup]);

  // Show group button when multiple nodes selected
  const canGroup = selectedNodeIds.length >= 2;

  // Keyboard shortcuts for shape creation and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focused on input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      // Undo/Redo shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Redo with Ctrl+Y (Windows style)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'r':
          setActiveTool('shape');
          setPendingShapeType('rectangle');
          break;
        case 'u':
          setActiveTool('shape');
          setPendingShapeType('rounded');
          break;
        case 'd':
          setActiveTool('shape');
          setPendingShapeType('diamond');
          break;
        case 't':
          setActiveTool('shape');
          setPendingShapeType('text');
          break;
        case 'v':
        case 'escape':
          setActiveTool('select');
          setPendingShapeType(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, setPendingShapeType, undo, redo]);

  // Cursor style based on active tool
  const cursorClass = activeTool === 'shape' ? 'cursor-crosshair' : '';

  // Apply layout with animation
  const handleApplyLayout = useCallback((type: LayoutType, direction?: LayoutDirection) => {
    // Save current positions before applying layout
    savePreLayoutPositions();

    // Store current layout type for edge routing
    setCurrentLayoutType(type);

    const options = direction ? { direction } : {};
    const layoutedNodes = applyLayout(type, nodes, edges, options);

    // Animate transition
    const startPositions = new Map(nodes.map(n => [n.id, { ...n.position }]));
    const endPositions = new Map(layoutedNodes.map(n => [n.id, { ...n.position }]));

    const duration = 500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      setNodes(currentNodes =>
        currentNodes.map(node => {
          const start = startPositions.get(node.id);
          const end = endPositions.get(node.id);

          if (!start || !end) return node;

          return {
            ...node,
            position: {
              x: start.x + (end.x - start.x) * eased,
              y: start.y + (end.y - start.y) * eased,
            },
          };
        })
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [nodes, edges, setNodes, savePreLayoutPositions, setCurrentLayoutType]);

  return (
    <div className={`w-full h-full flex ${className}`}>
      {/* Canvas Area */}
      <div className={`flex-1 relative ${cursorClass}`}>
        <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onDoubleClick={onPaneDoubleClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionMode={ConnectionMode.Loose}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        panOnDrag
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
        <Controls showInteractive={false} className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={2}
          zoomable
          pannable
          className="!bg-white/90 dark:!bg-gray-800/90 !border !border-gray-200 dark:!border-gray-700 !rounded-lg !bottom-4 !right-4"
          style={{ width: 120, height: 80 }}
        />
      </ReactFlow>

      {/* Step Edit Toolbar */}
      <AnimatePresence>
        {editingStepId && <StepEditToolbar />}
      </AnimatePresence>

      {/* Collection Selection Mode Indicator */}
      {isSelectingForGroup && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {t('canvas.selectForCollection', { count: selectedForGroup.length })}
          </div>
        </div>
      )}

      {/* Add Comment Button */}
      <div className="absolute bottom-4 left-16 z-10">
        <button
          onClick={handleAddComment}
          className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg transition-colors"
          title={t('canvas.addComment')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Group Button */}
      {canGroup && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => setShowGroupDialog(true)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {t('canvas.groupNodes', { count: selectedNodeIds.length })}
          </button>
        </div>
      )}

      {/* Group Dialog */}
      {showGroupDialog && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl dark:shadow-gray-950 p-6 w-80">
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">{t('canvas.createGroup')}</h3>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('canvas.groupName')}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateGroup();
                if (e.key === 'Escape') setShowGroupDialog(false);
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowGroupDialog(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {t('canvas.cancel')}
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {t('canvas.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shape Toolbar */}
      <ShapeToolbar className="absolute left-4 top-1/2 -translate-y-1/2 z-10" />

      {/* Layout & History Controls - bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl px-2 py-1.5 shadow-lg dark:shadow-gray-950 border border-gray-200 dark:border-gray-700">
        <LayoutToolbar onApplyLayout={handleApplyLayout} />
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
        <HistoryControls />
      </div>

      {/* Shape Creation Mode Indicator */}
      {activeTool === 'shape' && pendingShapeType && (
        <div className="absolute top-4 right-4 z-10">
          <div className="px-3 py-2 bg-blue-600 text-white rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {t('canvas.clickToPlace', { shape: pendingShapeType })}
            <span className="text-xs opacity-75">{t('canvas.escToCancel')}</span>
          </div>
        </div>
      )}

      {/* File Content Modal */}
      <FileModal
        node={modalNode}
        onClose={() => setModalNode(null)}
        onLinkClick={handleModalLinkClick}
      />
      </div>

      {/* Property Panel */}
      <PropertyPanel
        className="h-full hidden lg:block"
        onShowSaved={onShowSaved}
        onClose={onClose}
        onExpandNode={handleExpandNode}
      />

      {/* Node Detail Modal */}
      <AnimatePresence>
        {detailModalNode && (
          <NodeDetailModal
            node={detailModalNode}
            onClose={() => setDetailModalNode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Wrapper component with ReactFlowProvider
export default function CanvasViewer(props: CanvasViewerProps) {
  return (
    <ReactFlowProvider>
      <CanvasViewerInner {...props} />
    </ReactFlowProvider>
  );
}
