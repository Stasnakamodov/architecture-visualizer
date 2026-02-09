import type { AppNode, AppEdge, Step, Presentation } from '@/types/canvas';
import type { Scenario } from '@/stores/canvasStore';

export interface VisualGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  createdAt: string;
}

export interface SavedCanvas {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
  visualGroups?: VisualGroup[];
  steps?: Step[];
  scenarios?: Scenario[];
  presentations?: Presentation[];
  thumbnail?: string;
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  canvases: string[]; // canvas IDs
}

const STORAGE_KEYS = {
  CANVASES: 'arch-viz-canvases',
  PROJECTS: 'arch-viz-projects',
  RECENT: 'arch-viz-recent',
} as const;

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============ Canvas Operations ============

export function getAllCanvases(): SavedCanvas[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CANVASES);
    const canvases = data ? JSON.parse(data) : [];
    console.log('[localStorage] getAllCanvases:', canvases.length, 'items');
    return canvases;
  } catch (e) {
    console.error('[localStorage] getAllCanvases error:', e);
    return [];
  }
}

export function getCanvas(id: string): SavedCanvas | null {
  const canvases = getAllCanvases();
  return canvases.find((c) => c.id === id) || null;
}

export function saveCanvas(canvas: Omit<SavedCanvas, 'id' | 'createdAt' | 'updatedAt'>): SavedCanvas {
  const canvases = getAllCanvases();
  const now = new Date().toISOString();

  const newCanvas: SavedCanvas = {
    ...canvas,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  canvases.unshift(newCanvas);
  localStorage.setItem(STORAGE_KEYS.CANVASES, JSON.stringify(canvases));
  addToRecent(newCanvas.id);

  // Debug logging
  console.log('[localStorage] saveCanvas:', newCanvas.name, 'id:', newCanvas.id);
  console.log('[localStorage] Total canvases after save:', canvases.length);

  return newCanvas;
}

export function updateCanvas(id: string, updates: Partial<Omit<SavedCanvas, 'id' | 'createdAt'>>): SavedCanvas | null {
  const canvases = getAllCanvases();
  const index = canvases.findIndex((c) => c.id === id);

  if (index === -1) {
    console.warn('[localStorage] updateCanvas: canvas not found, id:', id);
    return null;
  }

  canvases[index] = {
    ...canvases[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEYS.CANVASES, JSON.stringify(canvases));
  addToRecent(id);

  console.log('[localStorage] updateCanvas:', canvases[index].name, 'id:', id);

  return canvases[index];
}

export function deleteCanvas(id: string): boolean {
  const canvases = getAllCanvases();
  const filtered = canvases.filter((c) => c.id !== id);

  if (filtered.length === canvases.length) return false;

  localStorage.setItem(STORAGE_KEYS.CANVASES, JSON.stringify(filtered));
  removeFromRecent(id);

  return true;
}

export function duplicateCanvas(id: string): SavedCanvas | null {
  const canvas = getCanvas(id);
  if (!canvas) return null;

  return saveCanvas({
    name: `${canvas.name} (copy)`,
    nodes: canvas.nodes,
    edges: canvas.edges,
    viewport: canvas.viewport,
    visualGroups: canvas.visualGroups,
    steps: canvas.steps,
    scenarios: canvas.scenarios,
    presentations: canvas.presentations,
  });
}

// ============ Recent Canvases ============

export function getRecentCanvases(limit = 5): SavedCanvas[] {
  if (typeof window === 'undefined') return [];
  try {
    const recentIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || '[]') as string[];
    const canvases = getAllCanvases();

    return recentIds
      .slice(0, limit)
      .map((id) => canvases.find((c) => c.id === id))
      .filter((c): c is SavedCanvas => c !== undefined);
  } catch {
    return [];
  }
}

function addToRecent(id: string): void {
  try {
    const recentIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || '[]') as string[];
    const filtered = recentIds.filter((rid) => rid !== id);
    filtered.unshift(id);
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(filtered.slice(0, 10)));
  } catch {
    // Ignore
  }
}

function removeFromRecent(id: string): void {
  try {
    const recentIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || '[]') as string[];
    const filtered = recentIds.filter((rid) => rid !== id);
    localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(filtered));
  } catch {
    // Ignore
  }
}

// ============ Export/Import ============

export function exportCanvas(id: string): string | null {
  const canvas = getCanvas(id);
  if (!canvas) return null;
  return JSON.stringify(canvas, null, 2);
}

export function exportAllCanvases(): string {
  const canvases = getAllCanvases();
  return JSON.stringify(canvases, null, 2);
}

export function importCanvas(jsonString: string): SavedCanvas | null {
  try {
    const data = JSON.parse(jsonString);

    // Validate required fields
    if (!data.nodes || !data.edges) {
      throw new Error('Invalid canvas data');
    }

    return saveCanvas({
      name: data.name || 'Imported Canvas',
      nodes: data.nodes,
      edges: data.edges,
      viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
      visualGroups: data.visualGroups,
      steps: data.steps,
      scenarios: data.scenarios,
      presentations: data.presentations,
    });
  } catch {
    return null;
  }
}

// ============ Storage Stats ============

export function getStorageStats(): { canvasCount: number; totalSize: string } {
  const canvases = getAllCanvases();
  const dataStr = localStorage.getItem(STORAGE_KEYS.CANVASES) || '';
  const sizeInBytes = new Blob([dataStr]).size;

  let totalSize: string;
  if (sizeInBytes < 1024) {
    totalSize = `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    totalSize = `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    totalSize = `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    canvasCount: canvases.length,
    totalSize,
  };
}

// ============ Clear Storage ============

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.CANVASES);
  localStorage.removeItem(STORAGE_KEYS.PROJECTS);
  localStorage.removeItem(STORAGE_KEYS.RECENT);
}
