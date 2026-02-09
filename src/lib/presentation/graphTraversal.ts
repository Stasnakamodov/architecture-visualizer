import type { AppEdge, BranchPoint } from '@/types/canvas';

interface TraversalResult {
  orderedNodeIds: string[];
  branchPoints: BranchPoint[];
}

/**
 * Build node traversal order from a set of node IDs and edges.
 * Uses BFS from root nodes (no incoming edges within the set),
 * tracks branch points (nodes with >1 outgoing targets in the set),
 * and appends isolated nodes (no edges) sorted by position.
 */
export function buildNodeTraversalOrder(
  nodeIds: string[],
  edges: AppEdge[],
  nodePositions?: Record<string, { x: number; y: number }> | null,
): TraversalResult {
  if (nodeIds.length === 0) {
    return { orderedNodeIds: [], branchPoints: [] };
  }

  const nodeSet = new Set(nodeIds);

  // Filter edges to only those connecting nodes within the set
  const relevantEdges = edges.filter(
    (e) => nodeSet.has(e.source) && nodeSet.has(e.target),
  );

  // Build adjacency: source -> targets
  const adjacency = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
    incomingCount.set(nodeId, 0);
  }

  for (const edge of relevantEdges) {
    const targets = adjacency.get(edge.source);
    if (targets && !targets.includes(edge.target)) {
      targets.push(edge.target);
    }
    incomingCount.set(
      edge.target,
      (incomingCount.get(edge.target) || 0) + 1,
    );
  }

  // Find root nodes (no incoming edges within the set)
  const roots: string[] = [];
  const connectedNodes = new Set<string>();

  for (const nodeId of nodeIds) {
    const hasOutgoing = (adjacency.get(nodeId) || []).length > 0;
    const hasIncoming = (incomingCount.get(nodeId) || 0) > 0;

    if (hasOutgoing || hasIncoming) {
      connectedNodes.add(nodeId);
    }

    if (!hasIncoming && (hasOutgoing || hasIncoming)) {
      roots.push(nodeId);
    }
  }

  // If no roots found among connected nodes (cycle-only graph), pick the first connected node
  if (roots.length === 0 && connectedNodes.size > 0) {
    roots.push([...connectedNodes][0]);
  }

  // BFS traversal
  const visited = new Set<string>();
  const orderedNodeIds: string[] = [];
  const branchPoints: BranchPoint[] = [];
  const queue: string[] = [...roots];

  // Build a map of node labels for branch point labels
  // (We pass labels later from the caller; here we just store target IDs)

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    orderedNodeIds.push(current);

    const targets = adjacency.get(current) || [];
    // Filter out already-visited targets (cycle protection)
    const unvisitedTargets = targets.filter((t) => !visited.has(t));

    if (targets.length > 1) {
      // This is a branch point — record it with all targets (not just unvisited)
      branchPoints.push({
        sourceNodeId: current,
        targetNodeIds: targets,
        targetLabels: targets, // Will be resolved to actual labels by the caller
      });
    }

    for (const target of unvisitedTargets) {
      if (!visited.has(target)) {
        queue.push(target);
      }
    }
  }

  // Isolated nodes (not connected by any relevant edges)
  const isolatedNodes = nodeIds.filter((id) => !connectedNodes.has(id));

  // Sort isolated nodes by position (left-to-right, then top-to-bottom)
  if (nodePositions) {
    isolatedNodes.sort((a, b) => {
      const posA = nodePositions[a] || { x: 0, y: 0 };
      const posB = nodePositions[b] || { x: 0, y: 0 };
      if (posA.x !== posB.x) return posA.x - posB.x;
      return posA.y - posB.y;
    });
  }

  orderedNodeIds.push(...isolatedNodes);

  return { orderedNodeIds, branchPoints };
}
