'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

// Sidebar width constants
const MIN_SIDEBAR_WIDTH = 56; // Icon-only mode
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 256; // w-64
const SIDEBAR_WIDTH_KEY = 'filetree-sidebar-width';

// Width breakpoints for different display modes
const ICON_ONLY_WIDTH = 72;      // Only icons
const COMPACT_WIDTH = 140;       // Icons + truncated text
// Above COMPACT_WIDTH = full mode

const getStoredSidebarWidth = (): number => {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH;
  const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
      return parsed;
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
};

interface FileTreeProps {
  onNodeSelect?: (nodeId: string) => void;
  onDocumentSelect?: (docId: string) => void;
  onAddToCanvas?: (docId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Color options for visual groups
const GROUP_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
];

export function FileTree({ onNodeSelect, onDocumentSelect, onAddToCanvas, isCollapsed = false, onToggleCollapse }: FileTreeProps) {
  const {
    nodes,
    folders,
    documents,
    visualGroups,
    selectedNodeId,
    selectedDocumentId,
    selectedFolderId,
    activeVisualGroupId,
    selectNode,
    selectDocument,
    selectFolder,
    createDocument,
    createFolder,
    updateFolder,
    deleteDocument,
    deleteFolder,
    moveDocumentToFolder,
    addDocumentToCanvas,
    createVisualGroup,
    updateVisualGroup,
    deleteVisualGroup,
    setActiveVisualGroup,
    isSelectingForGroup,
    selectedForGroup,
    startGroupSelection,
    cancelGroupSelection,
  } = useCanvasStore();

  const { t } = useTranslation();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['documents', 'all']));
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  // Visual group creation
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Modal state for creating groups
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [modalSelectedNodes, setModalSelectedNodes] = useState<Set<string>>(new Set());
  const [modalExpandedFolders, setModalExpandedFolders] = useState<Set<string>>(new Set());

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isHoveringSidebarHandle, setIsHoveringSidebarHandle] = useState(false);
  const sidebarStartX = useRef(0);
  const sidebarStartWidth = useRef(0);

  // Display mode based on width
  const displayMode = useMemo(() => {
    if (sidebarWidth <= ICON_ONLY_WIDTH) return 'icon';
    if (sidebarWidth <= COMPACT_WIDTH) return 'compact';
    return 'full';
  }, [sidebarWidth]);

  const isIconMode = displayMode === 'icon';
  const isCompactMode = displayMode === 'compact';

  // Load saved sidebar width on mount
  useEffect(() => {
    setSidebarWidth(getStoredSidebarWidth());
  }, []);

  // Save sidebar width to localStorage
  useEffect(() => {
    if (isResizingSidebar) return;
    const timer = setTimeout(() => {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    }, 100);
    return () => clearTimeout(timer);
  }, [sidebarWidth, isResizingSidebar]);

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sidebarStartX.current = e.clientX;
    sidebarStartWidth.current = sidebarWidth;
    setIsResizingSidebar(true);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - sidebarStartX.current;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, sidebarStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  // Resizable collections section
  const [collectionsHeight, setCollectionsHeight] = useState(160); // Default ~max-h-40
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const MIN_COLLECTIONS_HEIGHT = 100;
  const MAX_COLLECTIONS_RATIO = 0.6; // 60% of panel height

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = collectionsHeight;
  }, [collectionsHeight]);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const maxHeight = containerRect.height * MAX_COLLECTIONS_RATIO;

      // Moving up increases collections height, moving down decreases it
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.min(
        maxHeight,
        Math.max(MIN_COLLECTIONS_HEIGHT, dragStartHeight.current + deltaY)
      );

      setCollectionsHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  const selectedForGroupSet = useMemo(() => new Set(selectedForGroup), [selectedForGroup]);

  const handleCreateDocument = (folderId: string | null = null) => {
    const docId = createDocument(folderId);
    setEditingDocId(docId);
    setEditingTitle('Untitled');
    // Expand documents group
    setExpandedGroups(prev => new Set([...prev, 'documents']));
  };

  const handleDocumentClick = (docId: string) => {
    selectDocument(docId);
    selectNode(null);
    onDocumentSelect?.(docId);
  };

  const handleStartEditTitle = (docId: string, currentTitle: string) => {
    setEditingDocId(docId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = () => {
    if (editingDocId && editingTitle.trim()) {
      useCanvasStore.getState().updateDocument(editingDocId, { title: editingTitle.trim() });
    }
    if (editingFolderId && editingTitle.trim()) {
      updateFolder(editingFolderId, editingTitle.trim());
    }
    setEditingDocId(null);
    setEditingFolderId(null);
    setEditingTitle('');
  };

  const handleCreateFolder = () => {
    const folderId = createFolder();
    setEditingFolderId(folderId);
    setEditingTitle('New Folder');
    setExpandedGroups(prev => new Set([...prev, 'documents']));
  };

  const handleFolderClick = (folderId: string) => {
    selectFolder(folderId);
    selectNode(null);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleDragStart = (docId: string) => {
    setDraggedDocId(docId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnFolder = (folderId: string | null) => {
    if (draggedDocId) {
      moveDocumentToFolder(draggedDocId, folderId);
      setDraggedDocId(null);
    }
  };

  // Get documents for a specific folder (or root)
  const getDocsInFolder = (folderId: string | null) => {
    return documents.filter(doc => doc.folderId === folderId);
  };

  // Visual group functions
  const handleOpenGroupModal = () => {
    setIsGroupModalOpen(true);
    setModalSelectedNodes(new Set());
    setModalExpandedFolders(new Set(folders.map(f => f.id)));
    setNewGroupName('');
  };

  const handleCloseGroupModal = () => {
    setIsGroupModalOpen(false);
    setModalSelectedNodes(new Set());
    setNewGroupName('');
  };

  const handleToggleModalNode = (nodeId: string) => {
    setModalSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleToggleModalFolder = (folderId: string) => {
    setModalExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleSelectAllInFolder = (folderId: string | null) => {
    const docsInFolder = documents.filter(d => d.folderId === folderId);
    const nodeIdsInFolder = docsInFolder
      .map(doc => nodes.find(n => (n.data as any).documentId === doc.id)?.id)
      .filter((id): id is string => !!id);

    setModalSelectedNodes(prev => {
      const next = new Set(prev);
      const allSelected = nodeIdsInFolder.every(id => next.has(id));
      if (allSelected) {
        nodeIdsInFolder.forEach(id => next.delete(id));
      } else {
        nodeIdsInFolder.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleCreateVisualGroupFromModal = () => {
    if (modalSelectedNodes.size > 0 && newGroupName.trim()) {
      const colorIndex = visualGroups.length % GROUP_COLORS.length;
      createVisualGroup(newGroupName.trim(), Array.from(modalSelectedNodes), GROUP_COLORS[colorIndex]);
      handleCloseGroupModal();
    }
  };

  const handleToggleVisualGroup = (groupId: string) => {
    if (activeVisualGroupId === groupId) {
      setActiveVisualGroup(null);
    } else {
      setActiveVisualGroup(groupId);
    }
  };

  // Group nodes by type
  const groupedNodes = useMemo(() => {
    const groups: Record<string, typeof nodes> = {
      all: [],
      tech: [],
      database: [],
      business: [],
      group: [],
      comment: [],
      other: [],
    };

    nodes.forEach((node) => {
      groups.all.push(node);
      const type = node.type || 'other';
      if (groups[type]) {
        groups[type].push(node);
      } else {
        groups.other.push(node);
      }
    });

    return groups;
  }, [nodes]);

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return groupedNodes.all;
    const query = searchQuery.toLowerCase();
    return groupedNodes.all.filter((node) => {
      const label = node.data.label?.toLowerCase() || '';
      const desc = node.data.description?.toLowerCase() || '';
      return label.includes(query) || desc.includes(query);
    });
  }, [groupedNodes.all, searchQuery]);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleNodeClick = (nodeId: string) => {
    selectNode(nodeId);
    onNodeSelect?.(nodeId);
  };

  const getNodeIcon = (type: string | undefined, hasContent: boolean) => {
    if (hasContent) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    switch (type) {
      case 'database':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
            <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
            <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
          </svg>
        );
      case 'tech':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'business':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'group':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'comment':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        );
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />;
    }
  };

  const getTypeColor = (type: string | undefined) => {
    switch (type) {
      case 'database': return 'text-purple-500';
      case 'tech': return 'text-blue-500';
      case 'business': return 'text-indigo-500';
      case 'group': return 'text-gray-500';
      case 'comment': return 'text-amber-500';
      default: return 'text-gray-400 dark:text-gray-500';
    }
  };

  const groupLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    tech: {
      label: t('fileTree.technical'),
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
    },
    database: {
      label: t('fileTree.databases'),
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" /><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" /><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" /></svg>,
    },
    business: {
      label: t('fileTree.business'),
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    },
    group: {
      label: t('fileTree.groupsLabel'),
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    },
    comment: {
      label: t('fileTree.comments'),
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>,
    },
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={t('fileTree.expandSidebar')}
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="w-8 h-px bg-gray-200 dark:bg-gray-700 my-1" />
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{nodes.length}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: sidebarWidth }} className="relative bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full select-none">
      {/* Header */}
      <div className={`border-b border-gray-200 dark:border-gray-700 flex items-center ${isIconMode ? 'flex-col p-3 gap-2' : 'p-3 justify-between'}`}>
        {!isIconMode && <span className={`font-semibold text-gray-800 dark:text-gray-200 ${isCompactMode ? 'text-xs' : 'text-sm'}`}>{t('fileTree.files')}</span>}
        <div className={`flex items-center ${isIconMode ? 'flex-col gap-2' : 'gap-1'}`}>
          <button
            onClick={handleCreateFolder}
            className={`rounded-xl transition-all hover:scale-105 ${isIconMode ? 'w-10 h-10 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center justify-center' : 'p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg'}`}
            title={t('fileTree.newFolder')}
          >
            <svg className={`text-amber-500 ${isIconMode ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            onClick={() => handleCreateDocument(null)}
            className={`rounded-xl transition-all hover:scale-105 ${isIconMode ? 'w-10 h-10 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center justify-center' : 'p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg'}`}
            title={t('fileTree.newDocument')}
          >
            <svg className={`text-blue-500 ${isIconMode ? 'w-5 h-5' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {!isIconMode && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('fileTree.collapseSidebar')}
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {isIconMode ? (
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex justify-center">
          <button className="w-10 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all hover:scale-105 flex items-center justify-center" title="Search">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="p-2 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-2 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={isCompactMode ? "..." : t('fileTree.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-7 pr-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 ${isCompactMode ? 'text-xs' : 'text-sm'}`}
            />
          </div>
        </div>
      )}

      {/* File List */}
      <div className={`flex-1 overflow-y-auto ${isIconMode ? 'p-2 flex flex-col items-center gap-2' : 'p-2'}`}>
        {searchQuery ? (
          // Search results
          <div className="space-y-0.5">
            {filteredNodes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{t('fileTree.noResults')}</p>
            ) : (
              filteredNodes.map((node) => {
                const data = node.data as any;
                const hasContent = !!data?.fullContent;
                return (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      selectedNodeId === node.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className={getTypeColor(node.type)}>{getNodeIcon(node.type, hasContent)}</span>
                    <span className="text-sm truncate flex-1">{node.data.label}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          // Grouped view
          <div className="space-y-1">
            {/* Documents Section */}
            {(documents.length > 0 || folders.length > 0) && (
              <div>
                <button
                  onClick={() => toggleGroup('documents')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${expandedGroups.has('documents') ? 'rotate-90' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 text-left">{t('fileTree.documents')}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{documents.length}</span>
                </button>

                <AnimatePresence>
                  {expandedGroups.has('documents') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="pl-4 space-y-0.5 py-1"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDropOnFolder(null)}
                      >
                        {/* Folders */}
                        {folders.map((folder) => (
                          <div key={folder.id}>
                            {/* Folder header */}
                            <div
                              className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                                selectedFolderId === folder.id
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                              } ${draggedDocId ? 'border-2 border-dashed border-yellow-300' : ''}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => { e.stopPropagation(); handleDropOnFolder(folder.id); }}
                            >
                              <button
                                onClick={() => toggleFolder(folder.id)}
                                className="p-0.5"
                              >
                                <svg
                                  className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${expandedFolders.has(folder.id) ? 'rotate-90' : ''}`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                              </svg>
                              {editingFolderId === folder.id ? (
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={handleSaveTitle}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTitle();
                                    if (e.key === 'Escape') {
                                      setEditingFolderId(null);
                                      setEditingTitle('');
                                    }
                                  }}
                                  className="flex-1 text-sm bg-white dark:bg-gray-900 border border-yellow-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-yellow-500 text-gray-900 dark:text-gray-100"
                                  autoFocus
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleFolderClick(folder.id)}
                                    onDoubleClick={() => {
                                      setEditingFolderId(folder.id);
                                      setEditingTitle(folder.name);
                                    }}
                                    className="flex-1 text-left text-sm truncate"
                                  >
                                    {folder.name}
                                  </button>
                                  <button
                                    onClick={() => handleCreateDocument(folder.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-100 rounded transition-opacity"
                                    title={t('fileTree.addToFolder')}
                                  >
                                    <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => deleteFolder(folder.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
                                    title={t('fileTree.deleteFolder')}
                                  >
                                    <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                            {/* Documents in folder */}
                            <AnimatePresence>
                              {expandedFolders.has(folder.id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.1 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pl-6 space-y-0.5 py-0.5">
                                    {getDocsInFolder(folder.id).map((doc) => (
                                      <div
                                        key={doc.id}
                                        draggable
                                        onDragStart={() => handleDragStart(doc.id)}
                                        onDragEnd={() => setDraggedDocId(null)}
                                        className={`group flex items-center gap-2 px-2 py-1 rounded-lg transition-colors cursor-move ${
                                          selectedDocumentId === doc.id
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <button
                                          onClick={() => handleDocumentClick(doc.id)}
                                          onDoubleClick={() => handleStartEditTitle(doc.id, doc.title)}
                                          className="flex-1 text-left text-xs truncate"
                                        >
                                          {doc.title}
                                        </button>
                                        <button
                                          onClick={() => {
                                            addDocumentToCanvas(doc.id, { x: 100, y: 100 });
                                            onAddToCanvas?.(doc.id);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-amber-100 rounded transition-opacity"
                                          title={t('fileTree.addToCanvas')}
                                        >
                                          <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                          </svg>
                                        </button>
                                      </div>
                                    ))}
                                    {getDocsInFolder(folder.id).length === 0 && (
                                      <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 italic">{t('fileTree.emptyFolder')}</div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}

                        {/* Root documents (no folder) */}
                        {getDocsInFolder(null).map((doc) => (
                          <div
                            key={doc.id}
                            draggable
                            onDragStart={() => handleDragStart(doc.id)}
                            onDragEnd={() => setDraggedDocId(null)}
                            className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-move ${
                              selectedDocumentId === doc.id
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {editingDocId === doc.id ? (
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveTitle();
                                  if (e.key === 'Escape') {
                                    setEditingDocId(null);
                                    setEditingTitle('');
                                  }
                                }}
                                className="flex-1 text-sm bg-white dark:bg-gray-900 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                                autoFocus
                              />
                            ) : (
                              <>
                                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <button
                                  onClick={() => handleDocumentClick(doc.id)}
                                  onDoubleClick={() => handleStartEditTitle(doc.id, doc.title)}
                                  className="flex-1 text-left text-sm truncate"
                                >
                                  {doc.title}
                                </button>
                                <button
                                  onClick={() => {
                                    addDocumentToCanvas(doc.id, { x: 100, y: 100 });
                                    onAddToCanvas?.(doc.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-amber-100 rounded transition-opacity"
                                  title={t('fileTree.addToCanvas')}
                                >
                                  <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteDocument(doc.id)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
                                  title={t('fileTree.deleteDocument')}
                                >
                                  <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Separator if both documents and nodes exist */}
            {(documents.length > 0 || folders.length > 0) && nodes.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
            )}

            {/* Canvas Nodes */}
            {Object.entries(groupLabels).map(([type, { label, icon }]) => {
              const typeNodes = groupedNodes[type] || [];
              if (typeNodes.length === 0) return null;
              const isExpanded = expandedGroups.has(type);

              // Color schemes for each type
              const typeStyles: Record<string, { bg: string; hoverBg: string; text: string; badge: string }> = {
                tech: { bg: 'bg-blue-50', hoverBg: 'hover:bg-blue-100', text: 'text-blue-600', badge: 'bg-blue-500' },
                database: { bg: 'bg-purple-50', hoverBg: 'hover:bg-purple-100', text: 'text-purple-600', badge: 'bg-purple-500' },
                business: { bg: 'bg-indigo-50', hoverBg: 'hover:bg-indigo-100', text: 'text-indigo-600', badge: 'bg-indigo-500' },
                group: { bg: 'bg-gray-100 dark:bg-gray-800', hoverBg: 'hover:bg-gray-200 dark:hover:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', badge: 'bg-gray-500' },
                comment: { bg: 'bg-amber-50', hoverBg: 'hover:bg-amber-100', text: 'text-amber-600', badge: 'bg-amber-500' },
              };
              const style = typeStyles[type] || typeStyles.group;

              return (
                <div key={type}>
                  <button
                    onClick={() => toggleGroup(type)}
                    className={`w-full flex items-center rounded-xl transition-all ${
                      isIconMode
                        ? `justify-center p-2 ${style.bg} ${style.hoverBg} hover:scale-105`
                        : 'gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={isIconMode ? `${label} (${typeNodes.length})` : undefined}
                  >
                    {!isIconMode && (
                      <svg
                        className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {isIconMode ? (
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.text}`}>
                          <span className="scale-125">{icon}</span>
                        </div>
                        <span className={`absolute -top-1 -right-1 text-[10px] text-white ${style.badge} rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium shadow-sm`}>
                          {typeNodes.length}
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className={`${getTypeColor(type)} flex-shrink-0`}>{icon}</span>
                        <span className={`font-medium text-gray-700 dark:text-gray-300 flex-1 text-left truncate ${isCompactMode ? 'text-xs' : 'text-sm'}`}>
                          {isCompactMode ? label.slice(0, 4) : label}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">{typeNodes.length}</span>
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && !isIconMode && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className={`space-y-0.5 py-1 ${isCompactMode ? 'pl-2' : 'pl-4'}`}>
                          {typeNodes.map((node) => {
                            const data = node.data as any;
                            const hasContent = !!data?.fullContent;
                            return (
                              <button
                                key={node.id}
                                onClick={() => handleNodeClick(node.id)}
                                className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-left transition-colors ${
                                  selectedNodeId === node.id
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                                title={isCompactMode ? node.data.label : undefined}
                              >
                                <span className={`${getTypeColor(node.type)} flex-shrink-0`}>{getNodeIcon(node.type, hasContent)}</span>
                                <span className={`truncate flex-1 ${isCompactMode ? 'text-xs' : 'text-sm'}`}>{node.data.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resizable Divider */}
      <div
        className={`relative h-1.5 bg-gray-200 dark:bg-gray-700 cursor-ns-resize group flex-shrink-0 ${
          isDraggingDivider ? 'bg-blue-400' : 'hover:bg-blue-300'
        }`}
        onMouseDown={handleDividerMouseDown}
      >
        {/* Visual handle indicator */}
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 rounded-full transition-colors ${
          isDraggingDivider ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-500'
        }`} />
      </div>

      {/* Visual Groups Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col" style={{ height: isIconMode ? 'auto' : collectionsHeight }}>
        {/* Header */}
        <div className={`flex items-center border-b border-gray-100 dark:border-gray-800 flex-shrink-0 ${isIconMode ? 'flex-col p-3 gap-2' : 'p-2 justify-between'}`}>
          {!isIconMode && <span className={`font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>{t('fileTree.collections')}</span>}
          <button
            onClick={handleOpenGroupModal}
            className={`transition-all hover:scale-105 ${isIconMode ? 'w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl flex items-center justify-center' : 'p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded'}`}
            title={t('fileTree.createCollection')}
          >
            <svg className={`text-emerald-500 ${isIconMode ? 'w-5 h-5' : 'w-4 h-4 text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Groups list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {visualGroups.length === 0 ? (
            <div className={`text-gray-400 dark:text-gray-500 text-center italic ${isIconMode ? 'p-3 text-xs' : 'p-3 text-xs'}`}>
              {isIconMode ? '' : t('fileTree.noCollections')}
            </div>
          ) : (
            <div className={`${isIconMode ? 'p-2 flex flex-col items-center gap-2' : 'p-1 space-y-0.5'}`}>
              {visualGroups.map((group) => (
                <div
                  key={group.id}
                  className={`group flex items-center cursor-pointer transition-all ${
                    isIconMode
                      ? `w-10 h-10 rounded-xl justify-center hover:scale-105 ${activeVisualGroupId === group.id ? 'ring-2 ring-offset-2' : ''}`
                      : `rounded-lg gap-2 px-2 py-1.5 ${activeVisualGroupId === group.id ? 'bg-gray-100 dark:bg-gray-800 ring-2 ring-offset-1 dark:ring-offset-gray-900' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`
                  }`}
                  style={{
                    ['--tw-ring-color' as string]: group.color,
                    backgroundColor: isIconMode ? `${group.color}20` : undefined,
                  }}
                  onClick={() => handleToggleVisualGroup(group.id)}
                  title={isIconMode ? `${group.name} (${group.nodeIds.length})` : undefined}
                >
                  <div className="relative">
                    <div
                      className={`rounded-full flex-shrink-0 ${isIconMode ? 'w-5 h-5' : 'w-3 h-3'}`}
                      style={{ backgroundColor: group.color }}
                    />
                    {isIconMode && (
                      <span
                        className="absolute -top-1.5 -right-2 text-[10px] text-white rounded-full min-w-[16px] h-4 flex items-center justify-center font-medium shadow-sm"
                        style={{ backgroundColor: group.color }}
                      >
                        {group.nodeIds.length}
                      </span>
                    )}
                  </div>
                  {!isIconMode && (
                    editingGroupId === group.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => {
                          if (editingTitle.trim()) {
                            updateVisualGroup(group.id, { name: editingTitle.trim() });
                          }
                          setEditingGroupId(null);
                          setEditingTitle('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingTitle.trim()) {
                              updateVisualGroup(group.id, { name: editingTitle.trim() });
                            }
                            setEditingGroupId(null);
                            setEditingTitle('');
                          }
                          if (e.key === 'Escape') {
                            setEditingGroupId(null);
                            setEditingTitle('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-gray-100 ${isCompactMode ? 'text-xs' : 'text-sm'}`}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span
                          className={`flex-1 truncate ${isCompactMode ? 'text-xs' : 'text-sm'}`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingGroupId(group.id);
                            setEditingTitle(group.name);
                          }}
                        >
                          {group.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{group.nodeIds.length}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteVisualGroup(group.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
                          title={t('fileTree.deleteCollection')}
                        >
                          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active group indicator */}
        {activeVisualGroupId && (
          <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <button
              onClick={() => setActiveVisualGroup(null)}
              className="w-full text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {t('fileTree.showAll')}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${isIconMode ? 'p-2' : 'p-2'}`}>
        {isIconMode ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{nodes.length}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('fileTree.nodesDocs', { nodes: nodes.length, docs: documents.length })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={handleCloseGroupModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl dark:shadow-gray-950 w-[400px] max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('fileTree.createCollectionTitle')}</h3>
                <button
                  onClick={handleCloseGroupModal}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Collection Name Input */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('fileTree.collectionName')}</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t('fileTree.enterCollectionName')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>

              {/* Tree Selection */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('fileTree.selectItems')}</div>

                {/* Documents & Folders */}
                {(documents.length > 0 || folders.length > 0) && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('fileTree.documents')}</span>
                    </div>

                    {/* Folders */}
                    {folders.map((folder) => {
                      const docsInFolder = documents.filter(d => d.folderId === folder.id);
                      const nodeIdsInFolder = docsInFolder
                        .map(doc => nodes.find(n => (n.data as any).documentId === doc.id)?.id)
                        .filter((id): id is string => !!id);
                      const allSelected = nodeIdsInFolder.length > 0 && nodeIdsInFolder.every(id => modalSelectedNodes.has(id));
                      const someSelected = nodeIdsInFolder.some(id => modalSelectedNodes.has(id));

                      return (
                        <div key={folder.id} className="ml-2">
                          <div className="flex items-center gap-2 py-1">
                            <button
                              onClick={() => handleToggleModalFolder(folder.id)}
                              className="p-0.5"
                            >
                              <svg
                                className={`w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform ${modalExpandedFolders.has(folder.id) ? 'rotate-90' : ''}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={() => handleSelectAllInFolder(folder.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            </svg>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{folder.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">({docsInFolder.length})</span>
                          </div>

                          {modalExpandedFolders.has(folder.id) && (
                            <div className="ml-6 space-y-0.5">
                              {docsInFolder.map((doc) => {
                                const nodeForDoc = nodes.find(n => (n.data as any).documentId === doc.id);
                                if (!nodeForDoc) return null;
                                return (
                                  <label key={doc.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={modalSelectedNodes.has(nodeForDoc.id)}
                                      onChange={() => handleToggleModalNode(nodeForDoc.id)}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                    />
                                    <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{doc.title}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Root documents (no folder) */}
                    {getDocsInFolder(null).map((doc) => {
                      const nodeForDoc = nodes.find(n => (n.data as any).documentId === doc.id);
                      if (!nodeForDoc) return null;
                      return (
                        <label key={doc.id} className="flex items-center gap-2 py-1 px-2 ml-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modalSelectedNodes.has(nodeForDoc.id)}
                            onChange={() => handleToggleModalNode(nodeForDoc.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                          />
                          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{doc.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Canvas Nodes by Type */}
                {Object.entries(groupLabels).map(([type, { label, icon }]) => {
                  const typeNodes = groupedNodes[type] || [];
                  if (typeNodes.length === 0) return null;

                  return (
                    <div key={type} className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={getTypeColor(type)}>{icon}</span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
                      </div>
                      <div className="ml-2 space-y-0.5">
                        {typeNodes.map((node) => (
                          <label key={node.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modalSelectedNodes.has(node.id)}
                              onChange={() => handleToggleModalNode(node.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span className={getTypeColor(node.type)}>{getNodeIcon(node.type, !!(node.data as any)?.fullContent)}</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{node.data.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {nodes.length === 0 && documents.length === 0 && (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    No items available
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-b-xl">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {modalSelectedNodes.size} item{modalSelectedNodes.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCloseGroupModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateVisualGroupFromModal}
                    disabled={modalSelectedNodes.size === 0 || !newGroupName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Create Collection
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right edge resize handle */}
      <div
        onMouseDown={handleSidebarResizeStart}
        onMouseEnter={() => setIsHoveringSidebarHandle(true)}
        onMouseLeave={() => setIsHoveringSidebarHandle(false)}
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-20 group"
        style={{ marginRight: '-6px' }}
      >
        {/* Visual indicator line */}
        <div
          className={`absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 transition-all duration-150 ${
            isResizingSidebar
              ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
              : isHoveringSidebarHandle
              ? 'bg-blue-400'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />
        {/* Grip handle - always visible */}
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 p-1 rounded transition-all ${
          isResizingSidebar
            ? 'bg-blue-500'
            : isHoveringSidebarHandle
            ? 'bg-blue-400'
            : 'bg-gray-300 dark:bg-gray-600'
        }`}>
          <div className="w-0.5 h-3 rounded-full bg-white" />
          <div className="w-0.5 h-3 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
