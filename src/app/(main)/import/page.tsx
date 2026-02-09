'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasDropzone } from '@/components/canvas/CanvasDropzone';
import { FolderDropzone } from '@/components/canvas/FolderDropzone';
import { AIChatPanel } from '@/components/canvas/AIChatPanel';
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

function CanvasLoading() {
  const { t } = useTranslation();
  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
      <div className="text-gray-400 dark:text-gray-500">{t('import.loading')}</div>
    </div>
  );
}

const CanvasViewer = dynamic(
  () => import('@/components/canvas/CanvasViewer'),
  { ssr: false, loading: () => <CanvasLoading /> }
);

type ImportMode = 'canvas' | 'folder' | 'ai';

interface CanvasData {
  nodes: AppNode[];
  edges: AppEdge[];
  viewport: { x: number; y: number; zoom: number };
  files?: Map<string, any>;
}

const TAB_ICONS: Record<ImportMode, React.ReactNode> = {
  folder: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  canvas: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
};

export default function ImportPage() {
  const [importMode, setImportMode] = useState<ImportMode>('ai');
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
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setVisualGroups,
    setSteps,
    steps: storeSteps,
    scenarios: storeScenarios,
    presentations: storePresentations,
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
    // Sync nodes/edges to store BEFORE setting canvasData to prevent sync loops in CanvasViewer
    setStoreNodes(data.nodes);
    setStoreEdges(data.edges);
    setCanvasData(data);
    setCurrentCanvas(null);
    // Clear visualGroups, steps, scenarios, presentations when importing new data
    setVisualGroups([]);
    setSteps([]);
    useCanvasStore.setState({ scenarios: [], presentations: [] });
    markDirty();
    // Open canvas in store (no saved canvas yet)
    openCanvas(null, null);
  }, [setStoreNodes, setStoreEdges, setVisualGroups, setSteps, markDirty, openCanvas]);

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
    console.log('[handleLoadCanvas] loading steps:', canvas.steps?.length ?? 0, 'scenarios:', canvas.scenarios?.length ?? 0, 'presentations:', canvas.presentations?.length ?? 0);
    setSteps(canvas.steps || []);
    useCanvasStore.setState({
      scenarios: canvas.scenarios || [],
      presentations: canvas.presentations || [],
    });
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
        return;
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
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<SavedCanvas | null>(null);
  const [allCanvases, setAllCanvases] = useState<SavedCanvas[]>([]);

  // Load all canvases
  useEffect(() => {
    setAllCanvases(getAllCanvases());
  }, []);

  // Count total items
  const totalWorks = allCanvases.length + (hasAutoSavedData ? 1 : 0);

  // Tab definitions
  const tabs: { id: ImportMode; label: string }[] = [
    { id: 'folder', label: t('import.folder') },
    { id: 'canvas', label: t('import.canvas') },
    { id: 'ai', label: t('ai.startCreating') },
  ];

  // Import screen - centered dropzone
  if (!canvasData) {
    const hasSidebar = totalWorks > 0 || recentCanvases.length > 0;

    return (
      <div className="h-[calc(100vh-48px)] flex relative overflow-hidden bg-white dark:bg-gray-950">

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs — flat buttons with underline */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="px-6 pt-4 border-b border-gray-200 dark:border-gray-800"
          >
            <div className="flex items-center gap-1">
              {tabs.map((tab) => {
                const isActive = importMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setImportMode(tab.id)}
                    className={`relative flex items-center gap-1.5 py-2.5 px-4 text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                      isActive
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {TAB_ICONS[tab.id]}
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 dark:bg-gray-100 rounded-full"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Content area */}
          <div className="relative flex-1 min-h-0">
            <AnimatePresence mode="popLayout">
              {importMode === 'folder' ? (
                <motion.div
                  key="folder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center p-6"
                >
                  <div className="max-w-md w-full">
                    <FolderDropzone onImport={handleImport} />
                  </div>
                </motion.div>
              ) : importMode === 'canvas' ? (
                <motion.div
                  key="canvas"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex items-center justify-center p-6"
                >
                  <div className="max-w-md w-full">
                    <CanvasDropzone onImport={handleImport} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <AIChatPanel displayMode="full" onCanvasGenerated={handleImport} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right sidebar */}
        {hasSidebar && (
          <div className="w-72 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Works Panel - Collapsible */}
              {totalWorks > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <button
                    onClick={() => setPanelExpanded(!panelExpanded)}
                    className="w-full flex items-center justify-between py-2 text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{t('import.myWorks')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('import.saved', { count: totalWorks })}</p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0 ${panelExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {panelExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                          {hasAutoSavedData && (
                            <div
                              className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 cursor-pointer flex items-center gap-2.5 transition-colors"
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
                              <div className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-md flex items-center justify-center flex-shrink-0">
                                <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{t('import.currentSession')}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('import.nodesAndDocs', { nodes: storeNodes.length, docs: storeDocuments.length })}</p>
                              </div>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded font-medium">{t('import.auto')}</span>
                            </div>
                          )}

                          {allCanvases.map((canvas) => (
                            <div
                              key={canvas.id}
                              className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => setPreviewCanvas(canvas)}
                            >
                              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center flex-shrink-0">
                                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <p className="p-3 text-xs text-gray-400 dark:text-gray-500 text-center">{t('import.noSavedWorks')}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Recent Canvases - Collapsible */}
              {recentCanvases.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <button
                    onClick={() => setRecentExpanded(!recentExpanded)}
                    className="w-full flex items-center justify-between py-2 text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{t('import.recent')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('import.saved', { count: recentCanvases.length })}</p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0 ${recentExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {recentExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                          {recentCanvases.map((canvas) => (
                            <div
                              key={canvas.id}
                              className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 cursor-pointer flex items-center gap-2.5 transition-colors"
                              onClick={() => handleLoadCanvas(canvas)}
                            >
                              <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center flex-shrink-0">
                                <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{canvas.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{canvas.nodes.length} {t('import.nodes')}</p>
                              </div>
                            </div>
                          ))}

                          <div
                            className="p-2 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800 transition-colors"
                            onClick={() => setShowSavedCanvases(true)}
                          >
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">{t('import.viewAll')}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Preview Modal */}
        <AnimatePresence>
          {previewCanvas && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setPreviewCanvas(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', duration: 0.3 }}
                className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950 w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{previewCanvas.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(previewCanvas.updatedAt)}</p>
                  </div>
                  <button onClick={() => setPreviewCanvas(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
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
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex gap-2">
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
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
            scenarios={storeScenarios}
            presentations={storePresentations}
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
