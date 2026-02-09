import type { AppNode, AppEdge, Step } from '@/types/canvas';
import type { Scenario } from '@/stores/canvasStore';

// Types for AI responses
export interface AIGeneratedCanvas {
  nodes: AppNode[];
  edges: AppEdge[];
}

export interface AIGeneratedSteps {
  steps: Array<{
    name: string;
    description: string;
    mode: 'cumulative' | 'independent';
    nodeIds: string[];
  }>;
}

export interface AIGeneratedScenarios {
  scenarios: Array<{
    name: string;
    color: string;
    steps: Array<{
      name: string;
      description: string;
      mode: 'cumulative' | 'independent';
      nodeIds: string[];
    }>;
  }>;
}

export interface AIGeneratedDescriptions {
  descriptions: Record<string, string>;
}

function repairJSON(str: string): string {
  let s = str;
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Fix missing commas between properties: }"  or ]"  -> },  or ],
  s = s.replace(/([}\]])\s*\n\s*"/g, '$1,\n"');
  // Fix unescaped newlines inside string values
  s = s.replace(/:\s*"([^"]*)\n([^"]*?)"/g, (_, a, b) => `: "${a}\\n${b}"`);
  // If JSON is cut off, try to close it
  const opens = (s.match(/[{[]/g) || []).length;
  const closes = (s.match(/[}\]]/g) || []).length;
  for (let i = 0; i < opens - closes; i++) {
    // Guess what to close based on last open bracket
    const lastOpen = s.lastIndexOf('{') > s.lastIndexOf('[') ? '}' : ']';
    s += lastOpen;
  }
  return s;
}

export function extractJSON(raw: string): string {
  // Try to extract JSON from possible markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return repairJSON(fenceMatch[1].trim());
  // Try to find JSON object directly
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) return repairJSON(jsonMatch[0]);
  return repairJSON(raw.trim());
}

export function parseAICanvasResponse(raw: string): AIGeneratedCanvas {
  const json = JSON.parse(extractJSON(raw));

  if (!json.nodes || !Array.isArray(json.nodes)) {
    throw new Error('Invalid AI response: missing nodes array');
  }
  if (!json.edges || !Array.isArray(json.edges)) {
    throw new Error('Invalid AI response: missing edges array');
  }

  // Validate and normalize nodes
  const nodes: AppNode[] = json.nodes.map((n: any, i: number) => ({
    id: n.id || `node-${i + 1}`,
    type: ['tech', 'database', 'business'].includes(n.type) ? n.type : 'tech',
    position: {
      x: typeof n.position?.x === 'number' ? n.position.x : (i % 4) * 380,
      y: typeof n.position?.y === 'number' ? n.position.y : Math.floor(i / 4) * 230,
    },
    data: {
      label: n.data?.label || `Node ${i + 1}`,
      description: n.data?.description || '',
      color: n.data?.color || '#3b82f6',
    },
  }));

  const nodeIds = new Set(nodes.map(n => n.id));

  // Validate and normalize edges
  const edges: AppEdge[] = json.edges
    .filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e: any, i: number) => ({
      id: e.id || `edge-${i + 1}`,
      source: e.source,
      target: e.target,
      type: 'custom',
      data: {
        edgeType: e.data?.edgeType || 'arrow',
        label: e.data?.label || e.label || '',
      },
    }));

  return { nodes, edges };
}

export function parseAIStepsResponse(raw: string, validNodeIds: Set<string>): Step[] {
  const json = JSON.parse(extractJSON(raw));

  if (!json.steps || !Array.isArray(json.steps)) {
    throw new Error('Invalid AI response: missing steps array');
  }

  return json.steps.map((s: any, i: number) => ({
    id: `step-${Date.now()}-${i}`,
    name: s.name || `Step ${i + 1}`,
    description: s.description || '',
    order: i,
    mode: s.mode === 'cumulative' ? 'cumulative' : 'independent',
    nodeIds: (s.nodeIds || []).filter((id: string) => validNodeIds.has(id)),
    canvasNodeIds: Array.from(validNodeIds),
    nodePositions: null,
    viewport: null,
    createdAt: new Date().toISOString(),
  }));
}

export function parseAIScenariosResponse(
  raw: string,
  validNodeIds: Set<string>,
  allNodeIds: string[],
): Scenario[] {
  const json = JSON.parse(extractJSON(raw));

  if (!json.scenarios || !Array.isArray(json.scenarios)) {
    throw new Error('Invalid AI response: missing scenarios array');
  }

  const colorPalette = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

  return json.scenarios.map((sc: any, si: number) => {
    const steps: Step[] = (sc.steps || []).map((s: any, i: number) => ({
      id: `step-${Date.now()}-${si}-${i}`,
      name: s.name || `Step ${i + 1}`,
      description: s.description || '',
      order: i,
      mode: s.mode === 'cumulative' ? 'cumulative' : 'independent',
      nodeIds: (s.nodeIds || []).filter((id: string) => validNodeIds.has(id)),
      canvasNodeIds: allNodeIds,
      nodePositions: null,
      viewport: null,
      createdAt: new Date().toISOString(),
    }));

    return {
      id: `scenario-${Date.now()}-${si}`,
      name: sc.name || `Scenario ${si + 1}`,
      color: sc.color || colorPalette[si % colorPalette.length],
      steps,
      createdAt: new Date().toISOString(),
    };
  });
}

export function parseAIDescriptionsResponse(raw: string): Record<string, string> {
  const json = JSON.parse(extractJSON(raw));

  if (!json.descriptions || typeof json.descriptions !== 'object') {
    throw new Error('Invalid AI response: missing descriptions object');
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(json.descriptions)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}
