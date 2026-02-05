import dagre from 'dagre';
import * as d3Force from 'd3-force';
import type { AppNode, AppEdge } from '@/types/canvas';
import { setLayoutMeta, type SectionInfo, type PresentationLayoutMeta } from './edgeRouting';

export type LayoutType = 'hierarchical' | 'force' | 'circular' | 'grid' | 'presentation';

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface LayoutOptions {
  direction?: LayoutDirection; // For hierarchical layout
  nodeSpacing?: number;
  rankSpacing?: number;
  iterations?: number; // For force-directed
}

interface NodeDimensions {
  width: number;
  height: number;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;

function getNodeDimensions(node: AppNode): NodeDimensions {
  const measured = node.measured;
  const style = node.style as { width?: number; height?: number } | undefined;

  return {
    width: measured?.width || style?.width || DEFAULT_NODE_WIDTH,
    height: measured?.height || style?.height || DEFAULT_NODE_HEIGHT,
  };
}

/**
 * Hierarchical/Tree layout using dagre
 */
export function hierarchicalLayout(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions = {}
): AppNode[] {
  const {
    direction = 'TB',
    nodeSpacing = 80,
    rankSpacing = 120,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR' || direction === 'RL';

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply new positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = getNodeDimensions(node);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });
}

/**
 * Force-directed layout using d3-force
 */
export function forceDirectedLayout(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions = {}
): AppNode[] {
  const {
    nodeSpacing = 250,
    iterations = 300,
  } = options;

  // Create simulation nodes
  const simNodes = nodes.map((node) => ({
    id: node.id,
    x: node.position.x || Math.random() * 500,
    y: node.position.y || Math.random() * 500,
    ...getNodeDimensions(node),
  }));

  // Create simulation links
  const simLinks = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  // Create simulation with better spacing
  const simulation = d3Force.forceSimulation(simNodes)
    .force('link', d3Force.forceLink(simLinks)
      .id((d: any) => d.id)
      .distance(nodeSpacing)
      .strength(0.3))
    .force('charge', d3Force.forceManyBody()
      .strength(-800)
      .distanceMax(500))
    .force('center', d3Force.forceCenter(0, 0))
    .force('collision', d3Force.forceCollide()
      .radius((d: any) => Math.max(d.width, d.height) / 2 + 40)
      .strength(1))
    .stop();

  // Run simulation
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Create a map of final positions
  const positionMap = new Map(
    simNodes.map((n) => [n.id, { x: n.x || 0, y: n.y || 0 }])
  );

  // Apply new positions to nodes
  return nodes.map((node) => {
    const pos = positionMap.get(node.id);
    const { width, height } = getNodeDimensions(node);

    return {
      ...node,
      position: {
        x: (pos?.x || 0) - width / 2,
        y: (pos?.y || 0) - height / 2,
      },
    };
  });
}

/**
 * Circular layout
 */
export function circularLayout(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions = {}
): AppNode[] {
  const { nodeSpacing = 120 } = options;

  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) {
    const { width, height } = getNodeDimensions(nodes[0]);
    return nodes.map((node) => ({
      ...node,
      position: { x: -width / 2, y: -height / 2 },
    }));
  }

  // Find max node size for spacing calculation
  let maxSize = DEFAULT_NODE_WIDTH;
  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    maxSize = Math.max(maxSize, width, height);
  });

  // Calculate radius based on number of nodes and their sizes
  const circumference = nodes.length * (maxSize + nodeSpacing);
  const radius = Math.max(circumference / (2 * Math.PI), 200); // Minimum radius

  const angleStep = (2 * Math.PI) / nodes.length;

  return nodes.map((node, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    const { width, height } = getNodeDimensions(node);

    return {
      ...node,
      position: {
        x: Math.cos(angle) * radius - width / 2,
        y: Math.sin(angle) * radius - height / 2,
      },
    };
  });
}

/**
 * Grid layout
 */
export function gridLayout(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions = {}
): AppNode[] {
  const { nodeSpacing = 80 } = options;

  if (nodes.length === 0) return nodes;

  // Find max node dimensions for consistent spacing
  let maxWidth = DEFAULT_NODE_WIDTH;
  let maxHeight = DEFAULT_NODE_HEIGHT;

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, height);
  });

  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellWidth = maxWidth + nodeSpacing;
  const cellHeight = maxHeight + nodeSpacing;

  // Center the grid
  const totalWidth = cols * cellWidth;
  const rows = Math.ceil(nodes.length / cols);
  const totalHeight = rows * cellHeight;
  const offsetX = -totalWidth / 2 + cellWidth / 2;
  const offsetY = -totalHeight / 2 + cellHeight / 2;

  return nodes.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const { width, height } = getNodeDimensions(node);

    return {
      ...node,
      position: {
        x: offsetX + col * cellWidth - width / 2,
        y: offsetY + row * cellHeight - height / 2,
      },
    };
  });
}

/**
 * Presentation layout - groups nodes by type into vertical sections
 * Optimized for clear edge routing with more spacing
 */
export function presentationLayout(
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions = {}
): AppNode[] {
  const { nodeSpacing = 80, rankSpacing = 120 } = options; // Increased spacing

  if (nodes.length === 0) {
    setLayoutMeta(null);
    return nodes;
  }

  // Group nodes by type
  const typeOrder = ['tech', 'database', 'business', 'editable', 'comment', 'shape', 'group', 'default'];

  // Group nodes by their type
  const nodesByType: Record<string, AppNode[]> = {};
  nodes.forEach((node) => {
    const type = node.type || 'default';
    if (!nodesByType[type]) {
      nodesByType[type] = [];
    }
    nodesByType[type].push(node);
  });

  // Get types that have nodes, in order
  const activeTypes = typeOrder.filter((type) => nodesByType[type]?.length > 0);

  // Also add any types not in typeOrder
  Object.keys(nodesByType).forEach((type) => {
    if (!activeTypes.includes(type)) {
      activeTypes.push(type);
    }
  });

  if (activeTypes.length === 0) {
    setLayoutMeta(null);
    return nodes;
  }

  // Calculate section width (based on max 3 cards per row) with more spacing
  const CARDS_PER_ROW = 3;
  const CARD_WIDTH = 220;  // Slightly wider
  const CARD_HEIGHT = 140; // Slightly taller
  const SECTION_PADDING = 60;
  const SECTION_GAP = rankSpacing;
  const SECTION_WIDTH = CARDS_PER_ROW * CARD_WIDTH + (CARDS_PER_ROW - 1) * nodeSpacing + SECTION_PADDING * 2;

  const positionedNodes: AppNode[] = [];
  const sections: SectionInfo[] = [];
  let currentY = 0;

  activeTypes.forEach((type) => {
    const typeNodes = nodesByType[type];
    if (!typeNodes || typeNodes.length === 0) return;

    // Calculate rows needed for this section
    const rows = Math.ceil(typeNodes.length / CARDS_PER_ROW);
    const sectionHeight = rows * CARD_HEIGHT + (rows - 1) * nodeSpacing + SECTION_PADDING * 2;

    // Store section info (before offset adjustment)
    sections.push({
      type,
      yStart: currentY,
      yEnd: currentY + sectionHeight,
      xStart: 0,
      xEnd: SECTION_WIDTH,
    });

    // Position nodes within this section
    typeNodes.forEach((node, index) => {
      const row = Math.floor(index / CARDS_PER_ROW);
      const col = index % CARDS_PER_ROW;

      // Calculate how many nodes in this row (for centering last row)
      const nodesInThisRow = Math.min(CARDS_PER_ROW, typeNodes.length - row * CARDS_PER_ROW);
      const rowWidth = nodesInThisRow * CARD_WIDTH + (nodesInThisRow - 1) * nodeSpacing;
      const rowOffsetX = (SECTION_WIDTH - SECTION_PADDING * 2 - rowWidth) / 2;

      const { width, height } = getNodeDimensions(node);

      positionedNodes.push({
        ...node,
        position: {
          x: SECTION_PADDING + rowOffsetX + col * (CARD_WIDTH + nodeSpacing) + (CARD_WIDTH - width) / 2,
          y: currentY + SECTION_PADDING + row * (CARD_HEIGHT + nodeSpacing) + (CARD_HEIGHT - height) / 2,
        },
      });
    });

    currentY += sectionHeight + SECTION_GAP;
  });

  // Center horizontally and vertically
  const offsetX = -SECTION_WIDTH / 2;
  const totalHeight = currentY - SECTION_GAP;
  const offsetY = -totalHeight / 2;

  // Apply offset to all nodes
  const finalNodes = positionedNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));

  // Calculate bounds of all positioned nodes
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  finalNodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node);
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x + width);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y + height);
  });

  // Adjust section coordinates with offset
  const adjustedSections = sections.map((section) => ({
    ...section,
    yStart: section.yStart + offsetY,
    yEnd: section.yEnd + offsetY,
    xStart: section.xStart + offsetX,
    xEnd: section.xEnd + offsetX,
  }));

  // Store layout metadata for edge routing
  const layoutMeta: PresentationLayoutMeta = {
    sections: adjustedSections,
    sectionWidth: SECTION_WIDTH,
    totalHeight,
    bounds: { minX, maxX, minY, maxY },
    nodePositions: new Map(),
    edgePorts: new Map(),
  };
  setLayoutMeta(layoutMeta);

  return finalNodes;
}

/**
 * Apply layout algorithm to nodes
 */
export function applyLayout(
  type: LayoutType,
  nodes: AppNode[],
  edges: AppEdge[],
  options: LayoutOptions = {}
): AppNode[] {
  // Filter out group nodes and their children - layout only top-level nodes
  const topLevelNodes = nodes.filter(
    (node) => !node.parentId && node.type !== 'group'
  );
  const otherNodes = nodes.filter(
    (node) => node.parentId || node.type === 'group'
  );

  let layoutedNodes: AppNode[];

  // Clear layout meta for non-presentation layouts
  if (type !== 'presentation') {
    setLayoutMeta(null);
  }

  switch (type) {
    case 'hierarchical':
      layoutedNodes = hierarchicalLayout(topLevelNodes, edges, options);
      break;
    case 'force':
      layoutedNodes = forceDirectedLayout(topLevelNodes, edges, options);
      break;
    case 'circular':
      layoutedNodes = circularLayout(topLevelNodes, edges, options);
      break;
    case 'grid':
      layoutedNodes = gridLayout(topLevelNodes, edges, options);
      break;
    case 'presentation':
      layoutedNodes = presentationLayout(topLevelNodes, edges, options);
      break;
    default:
      return nodes;
  }

  // Combine with other nodes (groups, children)
  return [...layoutedNodes, ...otherNodes];
}

/**
 * Calculate center offset to keep layout centered
 */
export function calculateCenterOffset(
  nodes: AppNode[]
): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const maxX = Math.max(...nodes.map((n) => n.position.x + (n.measured?.width || DEFAULT_NODE_WIDTH)));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxY = Math.max(...nodes.map((n) => n.position.y + (n.measured?.height || DEFAULT_NODE_HEIGHT)));

  return {
    x: (maxX + minX) / 2,
    y: (maxY + minY) / 2,
  };
}
