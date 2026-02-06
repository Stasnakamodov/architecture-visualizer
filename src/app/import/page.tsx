'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';
import { CanvasDropzone } from '@/components/canvas/CanvasDropzone';
import { FolderDropzone } from '@/components/canvas/FolderDropzone';
import { ViewModeSwitch } from '@/components/ui/ViewModeSwitch';
import { FileTree } from '@/components/canvas/FileTree';
import { SavedCanvases } from '@/components/canvas/SavedCanvases';
import { SaveDialog } from '@/components/canvas/SaveDialog';
import { UnsavedChangesDialog } from '@/components/canvas/UnsavedChangesDialog';
import { StepEditorModal } from '@/components/canvas/StepEditorModal';
import { getRecentCanvases, getAllCanvases, type SavedCanvas } from '@/lib/storage/localStorage';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';
import type { AppNode, AppEdge } from '@/types/canvas';

const CanvasViewer = dynamic(
  () => import('@/components/canvas/CanvasViewer'),
  {
    ssr: false,
    loading: () => {
      const { t } = useTranslation();
      return (
        <div className="w-full h-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400 dark:text-gray-500">{t('import.loading')}</div>
        </div>
      );
    },
  }
);

type ImportMode = 'canvas' | 'folder';

interface CanvasData {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
  files?: Map<string, any>;
}

export default function ImportPage() {
  const [importMode, setImportMode] = useState<ImportMode>('folder');
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSavedCanvases, setShowSavedCanvases] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [currentCanvas, setCurrentCanvas] = useState<SavedCanvas | null>(null);
  const [recentCanvases, setRecentCanvases] = useState<SavedCanvas[]>([]);

  // Get store state and actions
  const {
    nodes: storeNodes,
    edges: storeEdges,
    documents: storeDocuments,
    folders: storeFolders,
    visualGroups: storeVisualGroups,
    viewport: storeViewport,
    lastSavedAt,
    _hasHydrated,
    isDirty,
    isCanvasOpen,
    requestSaveDialog,
    resetCanvas,
    setVisualGroups,
    setSteps,
    steps: storeSteps,
    markClean,
    markDirty,
    openCanvas,
    closeCanvas,
    setCurrentCanvasName,
    setRequestSaveDialog,
  } = useCanvasStore();

  const { t } = useTranslation();

  const handleReset = useCallback(() => {
    setCanvasData(null);
    setCurrentCanvas(null);
    closeCanvas();
  }, [closeCanvas]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    // Node selection is handled by the store
  }, []);

  const handleImport = useCallback((data: CanvasData) => {
    setCanvasData(data);
    setCurrentCanvas(null);
    // Clear visualGroups and steps, mark as dirty when importing new data
    setVisualGroups([]);
    setSteps([]);
    markDirty();
    // Open canvas in store (no saved canvas yet)
    openCanvas(null, null);
  }, [setVisualGroups, setSteps, markDirty, openCanvas]);

  // Check if there's auto-saved data
  const hasAutoSavedData = _hasHydrated && (
    storeNodes.length > 0 ||
    storeDocuments.length > 0 ||
    storeFolders.length > 0
  );

  // Handle back button with unsaved changes check
  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      handleReset();
    }
  }, [isDirty, handleReset]);

  // Handle discard changes and go back
  const handleDiscardAndBack = useCallback(() => {
    setShowUnsavedDialog(false);
    markClean(); // Reset dirty state
    handleReset();
  }, [markClean, handleReset]);

  // Handle save and then go back (opens save dialog)
  const handleSaveAndBack = useCallback(() => {
    setShowUnsavedDialog(false);
    setShowSaveDialog(true);
  }, []);

  const handleLoadCanvas = useCallback((canvas: SavedCanvas) => {
    setCanvasData({
      nodes: canvas.nodes,
      edges: canvas.edges,
      viewport: canvas.viewport,
    });
    // Load visualGroups from saved canvas (or clear if none)
    setVisualGroups(canvas.visualGroups || []);
    // Load steps from saved canvas (or clear if none)
    console.log('[handleLoadCanvas] loading steps:', canvas.steps?.length ?? 0, canvas.steps?.map(s => ({ id: s.id, name: s.name, nodeIds: s.nodeIds.length })));
    setSteps(canvas.steps || []);
    setCurrentCanvas(canvas);
    setShowSavedCanvases(false);
    // Mark as clean since we just loaded a saved canvas
    markClean();
    // Open canvas in store with name
    openCanvas(canvas.id, canvas.name);
  }, [setVisualGroups, setSteps, markClean, openCanvas]);

  // Load recent canvases on mount and check for canvas to open
  useEffect(() => {
    if (!_hasHydrated) return; // Ждём гидратации Zustand перед загрузкой

    setRecentCanvases(getRecentCanvases(3));

    // Check if we should open a specific canvas (from Projects page)
    const canvasIdToOpen = sessionStorage.getItem('open-canvas-id');
    if (canvasIdToOpen) {
      sessionStorage.removeItem('open-canvas-id');
      const allCanvases = getAllCanvases();
      const canvasToOpen = allCanvases.find(c => c.id === canvasIdToOpen);
      if (canvasToOpen) {
        handleLoadCanvas(canvasToOpen);
      }
    }
  }, [_hasHydrated, handleLoadCanvas]);

  // Listen to requestSaveDialog from Header
  useEffect(() => {
    if (requestSaveDialog && canvasData) {
      setShowSaveDialog(true);
      setRequestSaveDialog(false);
    }
  }, [requestSaveDialog, canvasData, setRequestSaveDialog]);

  // Listen to closeCanvas from Header (when isCanvasOpen becomes false while we have canvasData)
  useEffect(() => {
    if (!isCanvasOpen && canvasData) {
      // Header triggered back, check for unsaved changes
      if (isDirty) {
        setShowUnsavedDialog(true);
        // Re-open canvas in store to keep UI consistent
        openCanvas(currentCanvas?.id || null, currentCanvas?.name || null);
      } else {
        handleReset();
      }
    }
  }, [isCanvasOpen, canvasData, isDirty, currentCanvas, openCanvas, handleReset]);

  const handleSave = (canvas: SavedCanvas) => {
    setCurrentCanvas(canvas);
    setRecentCanvases(getRecentCanvases(3));
    // Update ID and name in store (important for "Save as new" to track the new project)
    openCanvas(canvas.id, canvas.name);
    // Reset dirty state since we just saved
    markClean();
  };

  const handleLoadAutoSaved = useCallback(() => {
    setCanvasData({
      nodes: storeNodes,
      edges: storeEdges,
      viewport: storeViewport,
    });
    setCurrentCanvas(null);
    // Auto-saved data hasn't been named-saved, so mark as dirty
    markDirty();
    // Open canvas in store (no saved canvas)
    openCanvas(null, null);
  }, [storeNodes, storeEdges, storeViewport, markDirty, openCanvas]);

  const handleClearAutoSaved = () => {
    if (confirm(t('import.confirmClear'))) {
      resetCanvas();
    }
  };

  // Format time helper
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const [panelExpanded, setPanelExpanded] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<SavedCanvas | null>(null);
  const [allCanvases, setAllCanvases] = useState<SavedCanvas[]>([]);

  // Load all canvases
  useEffect(() => {
    setAllCanvases(getAllCanvases());
  }, []);

  // Count total items
  const totalWorks = allCanvases.length + (hasAutoSavedData ? 1 : 0);

  // Import screen - centered dropzone
  if (!canvasData) {
    return (
      <div className="h-[calc(100vh-48px)] flex items-center justify-center p-4 relative">
        {/* Works Panel - Top Right Collapsible */}
        {totalWorks > 0 && (
          <div className="absolute top-4 right-4 w-72">
            <button
              onClick={() => setPanelExpanded(!panelExpanded)}
              className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm dark:shadow-gray-950 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="text-left min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 text-xs">{t('import.myWorks')}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('import.saved', { count: totalWorks })}</p>
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${panelExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded list */}
            {panelExpanded && (
              <div className="mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg dark:shadow-gray-950 overflow-hidden max-h-80 overflow-y-auto">
                {/* Auto-saved session */}
                {hasAutoSavedData && (
                  <div
                    className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 cursor-pointer flex items-center gap-2.5"
                    onClick={() => setPreviewCanvas({
                      id: 'auto-save',
                      name: t('import.currentSession'),
                      nodes: storeNodes,
                      edges: storeEdges,
                      viewport: storeViewport,
                      createdAt: lastSavedAt || new Date().toISOString(),
                      updatedAt: lastSavedAt || new Date().toISOString(),
                    })}
                  >
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{t('import.currentSession')}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('import.nodesAndDocs', { nodes: storeNodes.length, docs: storeDocuments.length })}</p>
                    </div>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{t('import.auto')}</span>
                  </div>
                )}

                {/* Saved canvases */}
                {allCanvases.map((canvas) => (
                  <div
                    key={canvas.id}
                    className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer flex items-center gap-2.5"
                    onClick={() => setPreviewCanvas(canvas)}
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{canvas.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{canvas.nodes.length} {t('import.nodes')}</p>
                    </div>
                  </div>
                ))}

                {allCanvases.length === 0 && !hasAutoSavedData && (
                  <p className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">{t('import.noSavedWorks')}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preview Modal */}
        <AnimatePresence>
          {previewCanvas && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewCanvas(null)} />
              <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950 w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{previewCanvas.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(previewCanvas.updatedAt)}</p>
                  </div>
                  <button onClick={() => setPreviewCanvas(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Stats */}
                <div className="p-4 grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{previewCanvas.nodes.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('import.nodes')}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{previewCanvas.edges.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('import.edges')}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {previewCanvas.nodes.filter(n => n.type === 'group').length}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('import.groups')}</p>
                  </div>
                </div>

                {/* Node list preview */}
                <div className="px-4 pb-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">{t('import.contents')}</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {previewCanvas.nodes.slice(0, 10).map((node) => (
                      <div key={node.id} className="flex items-center gap-2 text-xs p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className={`w-2 h-2 rounded-full ${
                          node.type === 'tech' ? 'bg-blue-500' :
                          node.type === 'database' ? 'bg-purple-500' :
                          node.type === 'business' ? 'bg-indigo-500' :
                          node.type === 'group' ? 'bg-gray-500' :
                          node.type === 'comment' ? 'bg-amber-500' : 'bg-gray-400'
                        }`} />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{node.data?.label || node.id}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-auto">{node.type}</span>
                      </div>
                    ))}
                    {previewCanvas.nodes.length > 10 && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center py-1">
                        {t('import.more', { count: previewCanvas.nodes.length - 10 })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t dark:border-gray-800 flex gap-2">
                  <button
                    onClick={() => {
                      if (previewCanvas.id === 'auto-save') {
                        handleLoadAutoSaved();
                      } else {
                        handleLoadCanvas(previewCanvas);
                      }
                      setPreviewCanvas(null);
                    }}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors"
                  >
                    {t('import.open')}
                  </button>
                  {previewCanvas.id === 'auto-save' && (
                    <button
                      onClick={() => {
                        handleClearAutoSaved();
                        setPreviewCanvas(null);
                      }}
                      className="py-2.5 px-4 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-md">
          {/* Recent Canvases */}
          {recentCanvases.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('import.recent')}</h3>
                <button
                  onClick={() => setShowSavedCanvases(true)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {t('import.viewAll')}
                </button>
              </div>
              <div className="space-y-2">
                {recentCanvases.map((canvas) => (
                  <button
                    key={canvas.id}
                    onClick={() => handleLoadCanvas(canvas)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{canvas.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{canvas.nodes.length} {t('import.nodes')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Import Mode Tabs */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setImportMode('folder')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                importMode === 'folder'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t('import.folder')}
            </button>
            <button
              onClick={() => setImportMode('canvas')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                importMode === 'canvas'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t('import.canvas')}
            </button>
            <button
              onClick={() => setShowSavedCanvases(true)}
              className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t('import.savedTab')}
            </button>
          </div>

          {importMode === 'folder' ? (
            <FolderDropzone onImport={handleImport} />
          ) : (
            <CanvasDropzone onImport={handleImport} />
          )}
        </div>

        {/* Saved Canvases Modal */}
        <AnimatePresence>
          {showSavedCanvases && (
            <SavedCanvases
              onLoad={handleLoadCanvas}
              onClose={() => setShowSavedCanvases(false)}
            />
          )}
        </AnimatePresence>

      </div>
    );
  }

  // Canvas view - full screen with sidebar
  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* File Tree Sidebar - left */}
        <FileTree
          onNodeSelect={handleNodeSelect}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Canvas Area */}
        <div className="flex-1 relative">
          {/* Floating toolbar - top left */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <ViewModeSwitch />
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded">
              {canvasData.nodes.length} · {canvasData.edges.length}
            </span>
          </div>

          {/* Canvas */}
          <CanvasViewer
            initialNodes={canvasData.nodes}
            initialEdges={canvasData.edges}
            className="h-full"
            onSave={() => setShowSaveDialog(true)}
            onShowSaved={() => setShowSavedCanvases(true)}
            onClose={handleReset}
          />
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showSavedCanvases && (
          <SavedCanvases
            onLoad={handleLoadCanvas}
            onClose={() => setShowSavedCanvases(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSaveDialog && (
          <SaveDialog
            nodes={storeNodes.length > 0 ? storeNodes : canvasData.nodes}
            edges={storeEdges.length > 0 ? storeEdges : canvasData.edges}
            viewport={canvasData.viewport}
            visualGroups={storeVisualGroups}
            steps={storeSteps}
            existingCanvas={currentCanvas}
            onSave={handleSave}
            onClose={() => setShowSaveDialog(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUnsavedDialog && (
          <UnsavedChangesDialog
            onSave={handleSaveAndBack}
            onDiscard={handleDiscardAndBack}
            onCancel={() => setShowUnsavedDialog(false)}
          />
        )}
      </AnimatePresence>

      {/* Step Editor Modal */}
      <StepEditorModal />
    </div>
  );
}
