import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { Viewport, XYPosition } from '@xyflow/react';
import type { AppNode, AppEdge, AppEdgeData, ViewMode, ShapeType, ShapeNodeData } from '@/types/canvas';
import type { LayoutType } from '@/lib/layout';

// Save status types
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Named save status (for "unsaved changes" warning)
export type NamedSaveStatus = 'unsaved' | 'saved';

// Folder type
export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = root level
  createdAt: string;
}

// Visual Group (collection for filtering/highlighting)
export interface VisualGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: string[]; // IDs of nodes included in this group
  createdAt: string;
}

// Document type (exists in sidebar, can be added to canvas)
export interface Document {
  id: string;
  title: string;
  content: string;
  folderId: string | null; // null = root level
  createdAt: string;
  updatedAt: string;
}

// Tool types for shape creation
export type ActiveTool = 'select' | 'shape';

interface CanvasState {
  // State
  nodes: AppNode[];
  edges: AppEdge[];
  folders: Folder[];
  documents: Document[];
  visualGroups: VisualGroup[];
  viewport: Viewport;
  viewMode: ViewMode;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedDocumentId: string | null;
  selectedFolderId: string | null;
  activeVisualGroupId: string | null; // Currently active group for filtering
  isSelectingForGroup: boolean; // Mode for selecting nodes to add to a group
  selectedForGroup: string[]; // Node IDs selected for new group
  isEditing: boolean;

  // Shape creation tools
  activeTool: ActiveTool;
  pendingShapeType: ShapeType | null;

  // Persistence status (auto-save)
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  saveError: string | null;
  _hasHydrated: boolean;

  // Named save status (for "unsaved changes" warning)
  isDirty: boolean;
  lastNamedSaveAt: string | null;

  // Canvas UI state (for Header)
  isCanvasOpen: boolean;
  currentCanvasId: string | null;
  currentCanvasName: string | null;
  requestSaveDialog: boolean;

  // Layout reset
  preLayoutPositions: Record<string, { x: number; y: number }> | null;

  // Current layout type for edge routing
  currentLayoutType: LayoutType | null;

  // Actions
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: AppEdge[]) => void;
  setVisualGroups: (groups: VisualGroup[]) => void;
  setViewport: (viewport: Viewport) => void;
  setViewMode: (mode: ViewMode) => void;
  selectNode: (nodeId: string | null) => void;
  toggleNodeSelection: (nodeId: string) => void;
  clearSelection: () => void;
  setEditing: (isEditing: boolean) => void;
  resetCanvas: () => void;
  createGroup: (label: string) => void;
  createComment: (position: { x: number; y: number }) => string;
  // Folder actions
  createFolder: (parentId?: string | null) => string;
  updateFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  selectFolder: (id: string | null) => void;
  // Document actions
  createDocument: (folderId?: string | null) => string;
  updateDocument: (id: string, updates: Partial<Pick<Document, 'title' | 'content' | 'folderId'>>) => void;
  deleteDocument: (id: string) => void;
  selectDocument: (id: string | null) => void;
  moveDocumentToFolder: (docId: string, folderId: string | null) => void;
  addDocumentToCanvas: (docId: string, position: { x: number; y: number }) => void;
  // Visual Group actions
  createVisualGroup: (name: string, nodeIds: string[], color?: string) => string;
  updateVisualGroup: (id: string, updates: Partial<Pick<VisualGroup, 'name' | 'color' | 'nodeIds'>>) => void;
  deleteVisualGroup: (id: string) => void;
  setActiveVisualGroup: (id: string | null) => void;
  addNodesToVisualGroup: (groupId: string, nodeIds: string[]) => void;
  removeNodesFromVisualGroup: (groupId: string, nodeIds: string[]) => void;
  // Group selection mode
  startGroupSelection: () => void;
  cancelGroupSelection: () => void;
  toggleNodeForGroup: (nodeId: string) => void;

  // Shape creation actions
  setActiveTool: (tool: ActiveTool) => void;
  setPendingShapeType: (type: ShapeType | null) => void;
  createShape: (position: XYPosition, shapeType: ShapeType, data?: Partial<ShapeNodeData>) => string;
  updateShapeProperties: (nodeId: string, properties: Partial<ShapeNodeData>) => void;
  updateEdgeProperties: (edgeId: string, properties: Partial<AppEdgeData>) => void;

  // Layout actions
  savePreLayoutPositions: () => void;
  resetToPreLayout: () => void;
  clearPreLayoutPositions: () => void;
  setCurrentLayoutType: (type: LayoutType | null) => void;

  // Persistence actions
  exportData: () => string;
  importData: (json: string) => { success: boolean; error?: string };
  setHasHydrated: (state: boolean) => void;

  // Named save tracking
  markDirty: () => void;
  markClean: () => void;

  // Canvas UI state actions
  openCanvas: (id: string | null, name: string | null) => void;
  closeCanvas: () => void;
  setCurrentCanvasName: (name: string | null) => void;
  setRequestSaveDialog: (request: boolean) => void;

  // Computed
  getFilteredNodes: () => AppNode[];
  getFilteredEdges: () => AppEdge[];
}

const initialState = {
  nodes: [] as AppNode[],
  edges: [] as AppEdge[],
  folders: [] as Folder[],
  documents: [] as Document[],
  visualGroups: [] as VisualGroup[],
  viewport: { x: 0, y: 0, zoom: 1 },
  viewMode: 'technical' as ViewMode,
  selectedNodeId: null as string | null,
  selectedNodeIds: [] as string[],
  selectedDocumentId: null as string | null,
  selectedFolderId: null as string | null,
  activeVisualGroupId: null as string | null,
  isSelectingForGroup: false,
  selectedForGroup: [] as string[],
  isEditing: false,
  // Shape creation tools
  activeTool: 'select' as ActiveTool,
  pendingShapeType: null as ShapeType | null,
  // Persistence status (auto-save)
  saveStatus: 'idle' as SaveStatus,
  lastSavedAt: null as string | null,
  saveError: null as string | null,
  _hasHydrated: false,
  // Named save status
  isDirty: false,
  lastNamedSaveAt: null as string | null,
  // Canvas UI state
  isCanvasOpen: false,
  currentCanvasId: null as string | null,
  currentCanvasName: null as string | null,
  requestSaveDialog: false,
  // Layout reset
  preLayoutPositions: null as Record<string, { x: number; y: number }> | null,
  // Current layout type
  currentLayoutType: null as LayoutType | null,
};

// Temporal store type for undo/redo
type TemporalState = Pick<CanvasState, 'nodes' | 'edges'>;

export const useCanvasStore = create<CanvasState>()(
  devtools(
    temporal(
      persist(
        (set, get) => ({
        // Initial state
        ...initialState,

        // Actions
        setNodes: (nodes) => set({ nodes }),
        setEdges: (edges) => set({ edges }),
        setVisualGroups: (visualGroups) => set({ visualGroups, activeVisualGroupId: null }),
        setViewport: (viewport) => set({ viewport }),
        setViewMode: (viewMode) => set({ viewMode, selectedNodeId: null, selectedNodeIds: [] }),
        selectNode: (selectedNodeId) => set({ selectedNodeId, selectedNodeIds: selectedNodeId ? [selectedNodeId] : [] }),
        toggleNodeSelection: (nodeId) => {
          const { selectedNodeIds } = get();
          if (selectedNodeIds.includes(nodeId)) {
            set({ selectedNodeIds: selectedNodeIds.filter(id => id !== nodeId) });
          } else {
            set({ selectedNodeIds: [...selectedNodeIds, nodeId] });
          }
        },
        clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [] }),
        setEditing: (isEditing) => set({ isEditing }),
        resetCanvas: () => set({
          ...initialState,
          _hasHydrated: true, // НЕ сбрасывать — onRehydrateStorage вызывается только один раз
          isDirty: false,
          lastNamedSaveAt: null,
          isCanvasOpen: false,
          currentCanvasId: null,
          currentCanvasName: null,
          requestSaveDialog: false,
        }),
        createGroup: (label) => {
          const { nodes, selectedNodeIds, edges } = get();
          if (selectedNodeIds.length < 2) return;

          // Calculate bounding box of selected nodes
          const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
          const minX = Math.min(...selectedNodes.map(n => n.position.x)) - 20;
          const minY = Math.min(...selectedNodes.map(n => n.position.y)) - 40;
          const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.measured?.width || 150)));
          const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.measured?.height || 60)));

          const groupId = `group-${Date.now()}`;
          const groupNode: AppNode = {
            id: groupId,
            type: 'group',
            position: { x: minX, y: minY },
            style: { width: maxX - minX + 40, height: maxY - minY + 60 },
            data: { label },
            zIndex: -1,
          };

          // Update child nodes to be relative to group
          const updatedNodes = nodes.map(node => {
            if (selectedNodeIds.includes(node.id)) {
              return {
                ...node,
                parentId: groupId,
                position: {
                  x: node.position.x - minX,
                  y: node.position.y - minY,
                },
                extent: 'parent' as const,
              };
            }
            return node;
          });

          set({
            nodes: [groupNode, ...updatedNodes],
            selectedNodeIds: [],
            selectedNodeId: groupId,
          });
        },

        createComment: (position) => {
          const { nodes } = get();
          const commentId = `comment-${Date.now()}`;
          const commentNode: AppNode = {
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

          set({
            nodes: [...nodes, commentNode],
            selectedNodeId: commentId,
            selectedNodeIds: [commentId],
          });

          return commentId;
        },

        // Folder actions
        createFolder: (parentId = null) => {
          const { folders } = get();
          const folderId = `folder-${Date.now()}`;
          const newFolder: Folder = {
            id: folderId,
            name: 'New Folder',
            parentId,
            createdAt: new Date().toISOString(),
          };

          set({
            folders: [...folders, newFolder],
            selectedFolderId: folderId,
          });

          return folderId;
        },

        updateFolder: (id, name) => {
          const { folders } = get();
          set({
            folders: folders.map(f => f.id === id ? { ...f, name } : f),
          });
        },

        deleteFolder: (id) => {
          const { folders, documents, selectedFolderId } = get();
          // Move documents from deleted folder to root
          set({
            folders: folders.filter(f => f.id !== id),
            documents: documents.map(doc =>
              doc.folderId === id ? { ...doc, folderId: null } : doc
            ),
            selectedFolderId: selectedFolderId === id ? null : selectedFolderId,
          });
        },

        selectFolder: (id) => {
          set({ selectedFolderId: id, selectedDocumentId: null });
        },

        // Document actions
        createDocument: (folderId = null) => {
          const { documents } = get();
          const docId = `doc-${Date.now()}`;
          const now = new Date().toISOString();
          const newDoc: Document = {
            id: docId,
            title: 'Untitled',
            content: '',
            folderId,
            createdAt: now,
            updatedAt: now,
          };

          set({
            documents: [...documents, newDoc],
            selectedDocumentId: docId,
          });

          return docId;
        },

        updateDocument: (id, updates) => {
          const { documents } = get();
          set({
            documents: documents.map(doc =>
              doc.id === id
                ? { ...doc, ...updates, updatedAt: new Date().toISOString() }
                : doc
            ),
          });
        },

        deleteDocument: (id) => {
          const { documents, selectedDocumentId } = get();
          set({
            documents: documents.filter(doc => doc.id !== id),
            selectedDocumentId: selectedDocumentId === id ? null : selectedDocumentId,
          });
        },

        selectDocument: (id) => {
          set({ selectedDocumentId: id, selectedFolderId: null });
        },

        moveDocumentToFolder: (docId, folderId) => {
          const { documents } = get();
          set({
            documents: documents.map(doc =>
              doc.id === docId
                ? { ...doc, folderId, updatedAt: new Date().toISOString() }
                : doc
            ),
          });
        },

        addDocumentToCanvas: (docId, position) => {
          const { documents, nodes } = get();
          const doc = documents.find(d => d.id === docId);
          if (!doc) return;

          const nodeId = `node-from-doc-${docId}-${Date.now()}`;
          const newNode: AppNode = {
            id: nodeId,
            type: 'comment',
            position,
            data: {
              label: doc.title,
              content: doc.content,
              description: doc.content.slice(0, 100),
              fullContent: doc.content,
              createdAt: doc.createdAt,
            },
            style: { width: 200, height: 120 },
          };

          set({
            nodes: [...nodes, newNode],
            selectedNodeId: nodeId,
            selectedNodeIds: [nodeId],
          });
        },

        // Visual Group actions
        createVisualGroup: (name, nodeIds, color = '#3b82f6') => {
          const { visualGroups } = get();
          const groupId = `vgroup-${Date.now()}`;
          const newGroup: VisualGroup = {
            id: groupId,
            name,
            color,
            nodeIds,
            createdAt: new Date().toISOString(),
          };

          set({
            visualGroups: [...visualGroups, newGroup],
            activeVisualGroupId: groupId,
          });

          return groupId;
        },

        updateVisualGroup: (id, updates) => {
          const { visualGroups } = get();
          set({
            visualGroups: visualGroups.map(g =>
              g.id === id ? { ...g, ...updates } : g
            ),
          });
        },

        deleteVisualGroup: (id) => {
          const { visualGroups, activeVisualGroupId } = get();
          set({
            visualGroups: visualGroups.filter(g => g.id !== id),
            activeVisualGroupId: activeVisualGroupId === id ? null : activeVisualGroupId,
          });
        },

        setActiveVisualGroup: (id) => {
          set({ activeVisualGroupId: id });
        },

        addNodesToVisualGroup: (groupId, nodeIds) => {
          const { visualGroups } = get();
          set({
            visualGroups: visualGroups.map(g =>
              g.id === groupId
                ? { ...g, nodeIds: [...new Set([...g.nodeIds, ...nodeIds])] }
                : g
            ),
          });
        },

        removeNodesFromVisualGroup: (groupId, nodeIds) => {
          const { visualGroups } = get();
          const nodeIdSet = new Set(nodeIds);
          set({
            visualGroups: visualGroups.map(g =>
              g.id === groupId
                ? { ...g, nodeIds: g.nodeIds.filter(id => !nodeIdSet.has(id)) }
                : g
            ),
          });
        },

        // Group selection mode
        startGroupSelection: () => {
          set({ isSelectingForGroup: true, selectedForGroup: [] });
        },

        cancelGroupSelection: () => {
          set({ isSelectingForGroup: false, selectedForGroup: [] });
        },

        toggleNodeForGroup: (nodeId) => {
          const { selectedForGroup } = get();
          if (selectedForGroup.includes(nodeId)) {
            set({ selectedForGroup: selectedForGroup.filter(id => id !== nodeId) });
          } else {
            set({ selectedForGroup: [...selectedForGroup, nodeId] });
          }
        },

        // Shape creation actions
        setActiveTool: (tool) => set({ activeTool: tool }),

        setPendingShapeType: (type) => set({ pendingShapeType: type }),

        createShape: (position, shapeType, data = {}) => {
          const defaultSizes: Record<ShapeType, { width: number; height: number }> = {
            rectangle: { width: 150, height: 80 },
            rounded: { width: 150, height: 80 },
            diamond: { width: 100, height: 100 },
            text: { width: 200, height: 40 },
          };

          const size = defaultSizes[shapeType];
          const shapeId = `shape-${Date.now()}`;

          const node: AppNode = {
            id: shapeId,
            type: 'shape',
            position,
            style: { width: size.width, height: size.height },
            data: {
              label: shapeType === 'text' ? 'Text' : '',
              shapeType,
              fillColor: '#ffffff',
              borderColor: '#3b82f6',
              borderStyle: 'solid',
              ...size,
              ...data,
            } as ShapeNodeData,
          };

          set({
            nodes: [...get().nodes, node],
            activeTool: 'select',
            pendingShapeType: null,
          });

          return shapeId;
        },

        updateShapeProperties: (nodeId, properties) => {
          const { nodes, isCanvasOpen } = get();
          set({
            nodes: nodes.map(node => {
              if (node.id === nodeId && node.type === 'shape') {
                return {
                  ...node,
                  data: { ...(node.data as ShapeNodeData), ...properties },
                } as AppNode;
              }
              return node;
            }),
            ...(isCanvasOpen ? { isDirty: true } : {}),
          });
        },

        updateEdgeProperties: (edgeId, properties) => {
          const { edges, isCanvasOpen } = get();
          set({
            edges: edges.map(edge =>
              edge.id === edgeId
                ? { ...edge, data: { ...(edge.data || {}), ...properties } }
                : edge
            ),
            ...(isCanvasOpen ? { isDirty: true } : {}),
          });
        },

        // Layout actions
        savePreLayoutPositions: () => {
          const { nodes } = get();
          const positions: Record<string, { x: number; y: number }> = {};
          nodes.forEach((node) => {
            positions[node.id] = { ...node.position };
          });
          set({ preLayoutPositions: positions });
        },

        resetToPreLayout: () => {
          const { nodes, preLayoutPositions } = get();
          if (!preLayoutPositions) return;

          const restoredNodes = nodes.map((node) => {
            const savedPosition = preLayoutPositions[node.id];
            if (savedPosition) {
              return { ...node, position: savedPosition };
            }
            return node;
          });

          set({ nodes: restoredNodes, preLayoutPositions: null });
        },

        clearPreLayoutPositions: () => {
          set({ preLayoutPositions: null });
        },

        setCurrentLayoutType: (type) => {
          set({ currentLayoutType: type });
        },

        // Persistence actions
        exportData: () => {
          const { nodes, edges, documents, folders, visualGroups, viewport, viewMode } = get();
          const exportObj = {
            version: 1,
            exportedAt: new Date().toISOString(),
            data: { nodes, edges, documents, folders, visualGroups, viewport, viewMode },
          };
          return JSON.stringify(exportObj, null, 2);
        },

        importData: (json: string) => {
          try {
            const parsed = JSON.parse(json);
            const data = parsed.data || parsed; // Support both versioned and raw format

            if (!data.nodes || !Array.isArray(data.nodes)) {
              return { success: false, error: 'Invalid data format: missing nodes array' };
            }

            set({
              nodes: data.nodes || [],
              edges: data.edges || [],
              documents: data.documents || [],
              folders: data.folders || [],
              visualGroups: data.visualGroups || [],
              viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
              viewMode: data.viewMode || 'technical',
              // Reset selection state
              selectedNodeId: null,
              selectedNodeIds: [],
              selectedDocumentId: null,
              selectedFolderId: null,
            });

            return { success: true };
          } catch (error) {
            return { success: false, error: 'Invalid JSON format' };
          }
        },

        setHasHydrated: (state: boolean) => {
          set({ _hasHydrated: state });
        },

        // Named save tracking
        markDirty: () => {
          set({ isDirty: true });
        },

        markClean: () => {
          set({
            isDirty: false,
            lastNamedSaveAt: new Date().toISOString(),
          });
        },

        // Canvas UI state actions
        openCanvas: (id, name) => {
          set({
            isCanvasOpen: true,
            currentCanvasId: id,
            currentCanvasName: name,
          });
        },

        closeCanvas: () => {
          set({
            isCanvasOpen: false,
            currentCanvasId: null,
            currentCanvasName: null,
            requestSaveDialog: false,
          });
        },

        setCurrentCanvasName: (name) => {
          set({ currentCanvasName: name });
        },

        setRequestSaveDialog: (request) => {
          set({ requestSaveDialog: request });
        },

        // Computed - filter nodes by view mode
        getFilteredNodes: () => {
          const { nodes, viewMode } = get();
          if (viewMode === 'executive') {
            return nodes.filter((node) =>
              ['business', 'group'].includes(node.type || '')
            );
          }
          return nodes;
        },

        // Computed - filter edges to only show connections between visible nodes
        getFilteredEdges: () => {
          const { edges } = get();
          const filteredNodes = get().getFilteredNodes();
          const nodeIds = new Set(filteredNodes.map((n) => n.id));
          return edges.filter(
            (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
          );
        },
      }),
      {
        name: 'arch-viz-canvas-state',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => {
          // Не сохраняем в auto-save когда канвас закрыт,
          // чтобы данные одного проекта не перезаписывали другой
          if (!state.isCanvasOpen) {
            return {
              nodes: [] as AppNode[],
              edges: [] as AppEdge[],
              documents: [] as Document[],
              folders: [] as Folder[],
              visualGroups: [] as VisualGroup[],
              viewport: { x: 0, y: 0, zoom: 1 },
              viewMode: state.viewMode,
            };
          }
          return {
            nodes: state.nodes,
            edges: state.edges,
            documents: state.documents,
            folders: state.folders,
            visualGroups: state.visualGroups,
            viewport: state.viewport,
            viewMode: state.viewMode,
          };
        },
        onRehydrateStorage: () => () => {
          useCanvasStore.setState({ _hasHydrated: true });
        },
      }
    ),
    {
      // Only track nodes and edges for undo/redo
      partialize: (state): TemporalState => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
      limit: 50, // Max history entries
      equality: (pastState, currentState) =>
        pastState.nodes === currentState.nodes &&
        pastState.edges === currentState.edges,
    }
    )
  )
);

// Гарантированно установить _hasHydrated
if (typeof window !== 'undefined') {
  const setHydrated = () => {
    if (!useCanvasStore.getState()._hasHydrated) {
      useCanvasStore.setState({ _hasHydrated: true });
    }
  };

  // Попробовать persist API (может не работать через temporal обёртку)
  try {
    if (useCanvasStore.persist?.hasHydrated()) {
      setHydrated();
    }
    useCanvasStore.persist?.onFinishHydration(setHydrated);
  } catch {
    // persist API недоступен — fallback
  }

  // Безусловный fallback: через 100ms гидратация точно завершена
  setTimeout(setHydrated, 100);
}

// Debounced save status tracking (runs after store is created)
let saveStatusTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 500;

// Subscribe to persisted state changes and update save status
if (typeof window !== 'undefined') {
  useCanvasStore.subscribe(
    (state, prevState) => {
      // Only track changes to persisted fields
      const persistedChanged =
        state.nodes !== prevState.nodes ||
        state.edges !== prevState.edges ||
        state.documents !== prevState.documents ||
        state.folders !== prevState.folders ||
        state.visualGroups !== prevState.visualGroups;

      if (persistedChanged && state._hasHydrated) {
        // Set to saving immediately (auto-save status only)
        // NOTE: Do NOT set isDirty here - isDirty tracks "named save" state,
        // not auto-save. isDirty should only be set via markDirty() when
        // user makes changes, not during auto-save persistence.
        if (saveStatusTimeout) clearTimeout(saveStatusTimeout);

        // Use queueMicrotask to avoid setState during render
        queueMicrotask(() => {
          useCanvasStore.setState({ saveStatus: 'saving' });
        });

        // After debounce, mark as saved
        saveStatusTimeout = setTimeout(() => {
          useCanvasStore.setState({
            saveStatus: 'saved',
            lastSavedAt: new Date().toISOString(),
          });
        }, DEBOUNCE_MS);
      }
    }
  );
}
