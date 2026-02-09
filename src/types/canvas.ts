import { Node, Edge } from '@xyflow/react';

// Shape types
export type ShapeType = 'rectangle' | 'rounded' | 'diamond' | 'text';

export type BorderStyle = 'solid' | 'dashed' | 'none';

export type LineStyle = 'solid' | 'dashed' | 'dotted';

// Base data for all nodes
export type BaseNodeData = {
  label: string;
  description?: string;
  color?: string;
  technicalView?: boolean;
};

// Tech node (API, services)
export type TechNodeData = BaseNodeData & {
  apiEndpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
};

// Database node
export type DatabaseNodeData = BaseNodeData & {
  tableName?: string;
  columns?: string[];
};

// Business node (for executive view)
export type BusinessNodeData = BaseNodeData & {
  metric?: string;
  status?: 'active' | 'planned' | 'deprecated';
};

// Group node
export type GroupNodeData = BaseNodeData & {
  collapsed?: boolean;
};

// Comment/Note node
export type CommentNodeData = BaseNodeData & {
  content?: string;
  fullContent?: string;
  author?: string;
  createdAt?: string;
};

// Shape node (custom shapes: rectangle, rounded, diamond, text)
export type ShapeNodeData = BaseNodeData & {
  shapeType: ShapeType;
  fillColor: string;
  borderColor: string;
  borderStyle: BorderStyle;
  width?: number;
  height?: number;
};

// Union type for all app nodes
export type AppNode =
  | Node<TechNodeData, 'tech'>
  | Node<DatabaseNodeData, 'database'>
  | Node<BusinessNodeData, 'business'>
  | Node<GroupNodeData, 'group'>
  | Node<CommentNodeData, 'comment'>
  | Node<ShapeNodeData, 'shape'>
  | Node<BaseNodeData, 'editable'>
  | Node<BaseNodeData, 'default'>;

// Edge data with line style support
export type AppEdgeData = {
  label?: string;
  edgeType?: 'default' | 'arrow' | 'bidirectional' | 'none';
  lineStyle?: LineStyle;
  sourceColor?: string;
  targetColor?: string;
  showGradient?: boolean;
};

export type AppEdge = Edge<AppEdgeData>;

// Step types
export type StepMode = 'cumulative' | 'independent';

export interface Step {
  id: string;
  name: string;
  description: string;
  order: number;
  mode: StepMode;
  nodeIds: string[];           // highlighted nodes (full brightness)
  canvasNodeIds: string[];     // all nodes existing on this step's canvas
  nodePositions?: Record<string, { x: number; y: number }> | null;
  viewport?: { x: number; y: number; zoom: number } | null;
  createdAt: string;
}

// Presentation types
export interface PresentationStepNotes {
  caption: string;
  speakerNotes: string;
}

// Sub-slide: unit of navigation in presentation
export interface SubSlide {
  type: 'overview' | 'node' | 'title';
  stepId: string;
  scenarioId: string;
  nodeId?: string;              // For type === 'node': node to zoom into
  scenarioName?: string;        // For type === 'title'
  scenarioDescription?: string; // For type === 'title'
}

// Branch point: node with multiple outgoing edges
export interface BranchPoint {
  sourceNodeId: string;
  targetNodeIds: string[];
  targetLabels: string[];
}

// Recorded path for public version (linear playback)
export interface RecordedPath {
  subSlideSequence: SubSlide[];
  recordedAt: string;
}

export interface Presentation {
  id: string;
  name: string;
  scenarioIds: string[];
  settings: { autoplay: boolean; autoplayInterval: 5000 | 10000 | 15000 };
  notes: Record<string, PresentationStepNotes>; // key: "scenarioId:stepId" or "scenarioId:stepId:nodeId"
  recordedPath?: RecordedPath | null;
  publicSlug: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// View modes
export type ViewMode = 'technical' | 'executive';

// Project type
export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

// Canvas type
export type Canvas = {
  id: string;
  project_id: string;
  name: string;
  canvas_data: {
    nodes: AppNode[];
    edges: AppEdge[];
    viewport: { x: number; y: number; zoom: number };
  };
  original_canvas: JSONCanvasData | null;
  view_mode: ViewMode;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

// JSON Canvas format (Obsidian)
export type JSONCanvasData = {
  nodes: JSONCanvasNode[];
  edges: JSONCanvasEdge[];
};

export type JSONCanvasNode = {
  id: string;
  type: 'text' | 'file' | 'link' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  file?: string;
  url?: string;
  label?: string;
  color?: string;
};

export type JSONCanvasEdge = {
  id: string;
  fromNode: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  fromEnd?: 'none' | 'arrow';
  toNode: string;
  toSide: 'top' | 'right' | 'bottom' | 'left';
  toEnd?: 'none' | 'arrow';
  color?: string;
  label?: string;
};
