import type { Position } from '@xyflow/react';

export interface SectionInfo {
  type: string;
  yStart: number;
  yEnd: number;
  xStart: number;
  xEnd: number;
}

export interface NodePortInfo {
  nodeId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export interface EdgePortInfo {
  sourcePort: { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' };
  targetPort: { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' };
}

export interface PresentationLayoutMeta {
  sections: SectionInfo[];
  sectionWidth: number;
  totalHeight: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  // Node positions for port calculation
  nodePositions: Map<string, NodePortInfo>;
  // Pre-calculated port assignments for edges
  edgePorts: Map<string, EdgePortInfo>;
}

// Store for current presentation layout metadata
let currentLayoutMeta: PresentationLayoutMeta | null = null;

export function setLayoutMeta(meta: PresentationLayoutMeta | null): void {
  currentLayoutMeta = meta;
}

export function getLayoutMeta(): PresentationLayoutMeta | null {
  return currentLayoutMeta;
}

/**
 * Calculate port assignments for all edges based on node positions
 */
export function calculateEdgePorts(
  nodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>,
  edges: Array<{ id: string; source: string; target: string }>
): void {
  if (!currentLayoutMeta) return;

  // Build node position map
  const nodePositions = new Map<string, NodePortInfo>();
  nodes.forEach(node => {
    nodePositions.set(node.id, {
      nodeId: node.id,
      position: node.position,
      width: node.measured?.width || 180,
      height: node.measured?.height || 80,
    });
  });
  currentLayoutMeta.nodePositions = nodePositions;

  // Count edges per node per side for distribution
  const nodeEdgeCounts: Map<string, { top: string[]; bottom: string[]; left: string[]; right: string[] }> = new Map();

  // Initialize counts
  nodes.forEach(node => {
    nodeEdgeCounts.set(node.id, { top: [], bottom: [], left: [], right: [] });
  });

  // First pass: determine optimal side for each edge
  const edgeSides: Map<string, { sourceSide: 'top' | 'bottom' | 'left' | 'right'; targetSide: 'top' | 'bottom' | 'left' | 'right' }> = new Map();

  edges.forEach(edge => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target) return;

    const sourceCenterX = source.position.x + source.width / 2;
    const sourceCenterY = source.position.y + source.height / 2;
    const targetCenterX = target.position.x + target.width / 2;
    const targetCenterY = target.position.y + target.height / 2;

    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    // Determine best sides based on relative position
    let sourceSide: 'top' | 'bottom' | 'left' | 'right';
    let targetSide: 'top' | 'bottom' | 'left' | 'right';

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      if (dx > 0) {
        sourceSide = 'right';
        targetSide = 'left';
      } else {
        sourceSide = 'left';
        targetSide = 'right';
      }
    } else {
      // Vertical dominant
      if (dy > 0) {
        sourceSide = 'bottom';
        targetSide = 'top';
      } else {
        sourceSide = 'top';
        targetSide = 'bottom';
      }
    }

    edgeSides.set(edge.id, { sourceSide, targetSide });

    // Register edge on both nodes
    const sourceCount = nodeEdgeCounts.get(edge.source);
    const targetCount = nodeEdgeCounts.get(edge.target);
    if (sourceCount) sourceCount[sourceSide].push(edge.id);
    if (targetCount) targetCount[targetSide].push(edge.id);
  });

  // Second pass: calculate actual port positions
  const edgePorts = new Map<string, EdgePortInfo>();

  edges.forEach(edge => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    const sides = edgeSides.get(edge.id);
    if (!source || !target || !sides) return;

    const sourceCount = nodeEdgeCounts.get(edge.source);
    const targetCount = nodeEdgeCounts.get(edge.target);
    if (!sourceCount || !targetCount) return;

    // Calculate source port
    const sourceEdgesOnSide = sourceCount[sides.sourceSide];
    const sourceIndex = sourceEdgesOnSide.indexOf(edge.id);
    const sourcePort = calculatePortPosition(source, sides.sourceSide, sourceIndex, sourceEdgesOnSide.length);

    // Calculate target port
    const targetEdgesOnSide = targetCount[sides.targetSide];
    const targetIndex = targetEdgesOnSide.indexOf(edge.id);
    const targetPort = calculatePortPosition(target, sides.targetSide, targetIndex, targetEdgesOnSide.length);

    edgePorts.set(edge.id, {
      sourcePort: { ...sourcePort, side: sides.sourceSide },
      targetPort: { ...targetPort, side: sides.targetSide },
    });
  });

  currentLayoutMeta.edgePorts = edgePorts;
}

/**
 * Calculate port position on a specific side of a node
 */
function calculatePortPosition(
  node: NodePortInfo,
  side: 'top' | 'bottom' | 'left' | 'right',
  index: number,
  total: number
): { x: number; y: number } {
  const padding = 15; // Padding from corners
  const { position, width, height } = node;

  // Distribute ports evenly along the side
  const ratio = total > 1 ? (index + 1) / (total + 1) : 0.5;

  switch (side) {
    case 'top':
      return {
        x: position.x + padding + (width - 2 * padding) * ratio,
        y: position.y,
      };
    case 'bottom':
      return {
        x: position.x + padding + (width - 2 * padding) * ratio,
        y: position.y + height,
      };
    case 'left':
      return {
        x: position.x,
        y: position.y + padding + (height - 2 * padding) * ratio,
      };
    case 'right':
      return {
        x: position.x + width,
        y: position.y + padding + (height - 2 * padding) * ratio,
      };
  }
}

/**
 * Get pre-calculated port info for an edge
 */
export function getEdgePortInfo(edgeId: string): EdgePortInfo | null {
  if (!currentLayoutMeta?.edgePorts) return null;
  return currentLayoutMeta.edgePorts.get(edgeId) || null;
}

/**
 * Calculate edge path with port-based routing
 * Uses pre-calculated port positions for clean edge distribution
 */
export function calculatePresentationEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  edgeId?: string
): { path: string; labelX: number; labelY: number } {
  // Try to get pre-calculated port info
  const portInfo = edgeId ? getEdgePortInfo(edgeId) : null;

  if (portInfo) {
    return calculatePortBasedPath(portInfo);
  }

  // Fallback to simple bezier if no port info
  return calculateSimpleBezier(sourceX, sourceY, targetX, targetY);
}

/**
 * Calculate path using pre-calculated port positions
 */
function calculatePortBasedPath(portInfo: EdgePortInfo): { path: string; labelX: number; labelY: number } {
  const { sourcePort, targetPort } = portInfo;

  // Determine if we need intermediate points based on port sides
  const needsRouting = shouldAddRoutingPoints(sourcePort.side, targetPort.side);

  if (!needsRouting) {
    // Direct smooth curve between ports
    return calculateSmoothCurve(
      sourcePort.x, sourcePort.y, sourcePort.side,
      targetPort.x, targetPort.y, targetPort.side
    );
  }

  // Add intermediate routing points
  return calculateRoutedPortPath(sourcePort, targetPort);
}

/**
 * Check if routing points are needed between two sides
 */
function shouldAddRoutingPoints(
  sourceSide: 'top' | 'bottom' | 'left' | 'right',
  targetSide: 'top' | 'bottom' | 'left' | 'right'
): boolean {
  // Opposite sides can connect directly
  const opposites: Record<string, string> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };
  return opposites[sourceSide] !== targetSide;
}

/**
 * Calculate smooth curve between two ports (for opposite sides)
 */
function calculateSmoothCurve(
  sx: number, sy: number, sourceSide: string,
  tx: number, ty: number, targetSide: string
): { path: string; labelX: number; labelY: number } {
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const controlDistance = Math.min(distance * 0.4, 80);

  // Control points extend perpendicular to the port side
  let c1x = sx, c1y = sy, c2x = tx, c2y = ty;

  switch (sourceSide) {
    case 'top': c1y = sy - controlDistance; break;
    case 'bottom': c1y = sy + controlDistance; break;
    case 'left': c1x = sx - controlDistance; break;
    case 'right': c1x = sx + controlDistance; break;
  }

  switch (targetSide) {
    case 'top': c2y = ty - controlDistance; break;
    case 'bottom': c2y = ty + controlDistance; break;
    case 'left': c2x = tx - controlDistance; break;
    case 'right': c2x = tx + controlDistance; break;
  }

  const path = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;

  return {
    path,
    labelX: (sx + tx) / 2,
    labelY: (sy + ty) / 2,
  };
}

/**
 * Calculate routed path for non-opposite port sides
 */
function calculateRoutedPortPath(
  sourcePort: { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' },
  targetPort: { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' }
): { path: string; labelX: number; labelY: number } {
  const offset = 30; // Offset from ports for routing

  const points: { x: number; y: number }[] = [{ x: sourcePort.x, y: sourcePort.y }];

  // Add first waypoint (exit from source)
  switch (sourcePort.side) {
    case 'top': points.push({ x: sourcePort.x, y: sourcePort.y - offset }); break;
    case 'bottom': points.push({ x: sourcePort.x, y: sourcePort.y + offset }); break;
    case 'left': points.push({ x: sourcePort.x - offset, y: sourcePort.y }); break;
    case 'right': points.push({ x: sourcePort.x + offset, y: sourcePort.y }); break;
  }

  // Add intermediate waypoint(s) to connect
  const lastExit = points[points.length - 1];
  let entryPoint: { x: number; y: number };

  switch (targetPort.side) {
    case 'top': entryPoint = { x: targetPort.x, y: targetPort.y - offset }; break;
    case 'bottom': entryPoint = { x: targetPort.x, y: targetPort.y + offset }; break;
    case 'left': entryPoint = { x: targetPort.x - offset, y: targetPort.y }; break;
    case 'right': entryPoint = { x: targetPort.x + offset, y: targetPort.y }; break;
  }

  // Connect exit to entry with L-shaped or S-shaped path
  const isHorizontalExit = sourcePort.side === 'left' || sourcePort.side === 'right';
  const isHorizontalEntry = targetPort.side === 'left' || targetPort.side === 'right';

  if (isHorizontalExit && isHorizontalEntry) {
    // Both horizontal: add vertical middle segment
    const midX = (lastExit.x + entryPoint.x) / 2;
    points.push({ x: midX, y: lastExit.y });
    points.push({ x: midX, y: entryPoint.y });
  } else if (!isHorizontalExit && !isHorizontalEntry) {
    // Both vertical: add horizontal middle segment
    const midY = (lastExit.y + entryPoint.y) / 2;
    points.push({ x: lastExit.x, y: midY });
    points.push({ x: entryPoint.x, y: midY });
  } else {
    // Mixed: single corner
    if (isHorizontalExit) {
      points.push({ x: entryPoint.x, y: lastExit.y });
    } else {
      points.push({ x: lastExit.x, y: entryPoint.y });
    }
  }

  points.push(entryPoint);
  points.push({ x: targetPort.x, y: targetPort.y });

  const path = pointsToSmoothPath(points);

  return {
    path,
    labelX: (sourcePort.x + targetPort.x) / 2,
    labelY: (sourcePort.y + targetPort.y) / 2,
  };
}

/**
 * Simple bezier curve for nearby nodes
 */
function calculateSimpleBezier(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): { path: string; labelX: number; labelY: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  // Horizontal-ish connection
  if (Math.abs(dx) > Math.abs(dy)) {
    const midX = (sourceX + targetX) / 2;
    const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
    return {
      path,
      labelX: midX,
      labelY: (sourceY + targetY) / 2,
    };
  }

  // Vertical-ish connection
  const midY = (sourceY + targetY) / 2;
  const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
  return {
    path,
    labelX: (sourceX + targetX) / 2,
    labelY: midY,
  };
}

/**
 * Calculate orthogonal path that routes around layout bounds
 */
function calculateOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  edgeIndex: number,
  totalEdges: number
): { path: string; labelX: number; labelY: number } {
  // Margin from layout bounds
  const baseMargin = 50;
  // Spread multiple edges to avoid overlap
  const edgeSpread = 15;
  const spreadOffset = (edgeIndex - (totalEdges - 1) / 2) * edgeSpread;

  // Determine routing direction based on node positions
  const sourceIsLeft = sourceX < (bounds.minX + bounds.maxX) / 2;
  const sourceIsTop = sourceY < (bounds.minY + bounds.maxY) / 2;
  const targetIsLeft = targetX < (bounds.minX + bounds.maxX) / 2;
  const targetIsTop = targetY < (bounds.minY + bounds.maxY) / 2;

  // Choose routing side (left, right, top, or bottom)
  let routeX: number;
  let routeY: number;
  let routeType: 'left' | 'right' | 'top' | 'bottom';

  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);

  // If nodes are more vertically separated, route left or right
  if (dy > dx) {
    // Route on the side closer to both nodes
    if (sourceIsLeft && targetIsLeft) {
      routeType = 'left';
      routeX = bounds.minX - baseMargin - spreadOffset;
    } else if (!sourceIsLeft && !targetIsLeft) {
      routeType = 'right';
      routeX = bounds.maxX + baseMargin + spreadOffset;
    } else {
      // Nodes on opposite sides - pick the side with less horizontal travel
      const leftDist = Math.abs(sourceX - bounds.minX) + Math.abs(targetX - bounds.minX);
      const rightDist = Math.abs(sourceX - bounds.maxX) + Math.abs(targetX - bounds.maxX);
      if (leftDist < rightDist) {
        routeType = 'left';
        routeX = bounds.minX - baseMargin - spreadOffset;
      } else {
        routeType = 'right';
        routeX = bounds.maxX + baseMargin + spreadOffset;
      }
    }
  } else {
    // Route on top or bottom
    if (sourceIsTop && targetIsTop) {
      routeType = 'top';
      routeY = bounds.minY - baseMargin - spreadOffset;
    } else if (!sourceIsTop && !targetIsTop) {
      routeType = 'bottom';
      routeY = bounds.maxY + baseMargin + spreadOffset;
    } else {
      const topDist = Math.abs(sourceY - bounds.minY) + Math.abs(targetY - bounds.minY);
      const bottomDist = Math.abs(sourceY - bounds.maxY) + Math.abs(targetY - bounds.maxY);
      if (topDist < bottomDist) {
        routeType = 'top';
        routeY = bounds.minY - baseMargin - spreadOffset;
      } else {
        routeType = 'bottom';
        routeY = bounds.maxY + baseMargin + spreadOffset;
      }
    }
  }

  // Build path based on route type
  let path: string;
  let labelX: number;
  let labelY: number;

  if (routeType === 'left' || routeType === 'right') {
    // Vertical routing (left or right side)
    const points = [
      { x: sourceX, y: sourceY },
      { x: routeX!, y: sourceY },
      { x: routeX!, y: targetY },
      { x: targetX, y: targetY },
    ];
    path = pointsToSmoothPath(points);
    labelX = routeX!;
    labelY = (sourceY + targetY) / 2;
  } else {
    // Horizontal routing (top or bottom)
    const points = [
      { x: sourceX, y: sourceY },
      { x: sourceX, y: routeY! },
      { x: targetX, y: routeY! },
      { x: targetX, y: targetY },
    ];
    path = pointsToSmoothPath(points);
    labelX = (sourceX + targetX) / 2;
    labelY = routeY!;
  }

  return { path, labelX, labelY };
}

/**
 * Convert array of points to smooth SVG path using quadratic curves
 */
function pointsToSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const cornerRadius = 16;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Direction vectors
    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    // Lengths
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    // Skip if segment too short
    if (len1 < 1 || len2 < 1) {
      path += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    // Normalized direction vectors
    const n1x = d1x / len1;
    const n1y = d1y / len1;
    const n2x = d2x / len2;
    const n2y = d2y / len2;

    // Adjust radius if needed
    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

    // Points before and after corner
    const beforeX = curr.x - n1x * r;
    const beforeY = curr.y - n1y * r;
    const afterX = curr.x + n2x * r;
    const afterY = curr.y + n2y * r;

    // Line to start of curve, then quadratic curve to end
    path += ` L ${beforeX} ${beforeY}`;
    path += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
  }

  // Final line to last point
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

/**
 * Check if we should use presentation routing
 */
export function shouldUsePresentationRouting(): boolean {
  return currentLayoutMeta !== null;
}
