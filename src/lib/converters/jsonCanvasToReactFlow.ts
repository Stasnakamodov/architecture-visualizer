import { MarkerType } from '@xyflow/react';
import type { JSONCanvasData, JSONCanvasNode, AppNode, AppEdge } from '@/types/canvas';

// Obsidian color palette mapping
const COLOR_MAP: Record<string, string> = {
  '1': '#fb464c', // red
  '2': '#e9973f', // orange
  '3': '#e0de71', // yellow
  '4': '#44cf6e', // green
  '5': '#53dfdd', // cyan
  '6': '#a882ff', // purple
};

function mapColor(color?: string): string | undefined {
  if (!color) return undefined;
  return COLOR_MAP[color] || color;
}

function detectNodeType(node: JSONCanvasNode): string {
  const text = (node.text || node.label || '').toLowerCase();

  // Database patterns
  if (
    text.includes('database') ||
    text.includes('table') ||
    text.includes('postgresql') ||
    text.includes('mysql') ||
    text.includes('supabase') ||
    text.includes('mongodb')
  ) {
    return 'database';
  }

  // API/Tech patterns
  if (
    text.includes('api') ||
    text.includes('endpoint') ||
    text.includes('service') ||
    text.includes('server') ||
    text.includes('backend') ||
    text.includes('function') ||
    text.includes('hook') ||
    text.includes('component')
  ) {
    return 'tech';
  }

  // Group type
  if (node.type === 'group') {
    return 'group';
  }

  // Default to business for executive-friendly view
  return 'business';
}

function detectMethod(text: string): string | undefined {
  const upper = text.toUpperCase();
  if (upper.includes('GET')) return 'GET';
  if (upper.includes('POST')) return 'POST';
  if (upper.includes('PUT')) return 'PUT';
  if (upper.includes('DELETE')) return 'DELETE';
  if (upper.includes('PATCH')) return 'PATCH';
  return undefined;
}

export function convertJSONCanvasToReactFlow(canvas: JSONCanvasData): {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
} {
  const nodes: AppNode[] = canvas.nodes.map((node) => {
    const nodeType = detectNodeType(node);
    const label = node.text || node.label || node.file || 'Untitled';

    const baseData = {
      label,
      description: node.type === 'link' ? node.url : undefined,
      color: mapColor(node.color),
    };

    // Add type-specific data
    const data =
      nodeType === 'tech'
        ? { ...baseData, method: detectMethod(label) }
        : baseData;

    return {
      id: node.id,
      type: nodeType,
      position: { x: node.x, y: node.y },
      data,
      style: {
        width: node.width,
        height: node.height,
      },
      measured: { width: node.width, height: node.height },
    } as AppNode;
  });

  const edges: AppEdge[] = canvas.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide,
    targetHandle: edge.toSide,
    markerStart:
      edge.fromEnd === 'arrow' ? { type: MarkerType.ArrowClosed } : undefined,
    markerEnd:
      edge.toEnd === 'arrow' ? { type: MarkerType.ArrowClosed } : undefined,
    label: edge.label,
    style: edge.color ? { stroke: mapColor(edge.color) } : undefined,
  }));

  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function parseJSONCanvas(content: string): JSONCanvasData {
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('Invalid JSON Canvas format: missing nodes or edges array');
  }

  return parsed as JSONCanvasData;
}
