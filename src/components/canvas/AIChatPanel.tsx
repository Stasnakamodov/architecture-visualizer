'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';
import { processDroppedItems, type AttachedFile } from '@/lib/utils/fileProcessing';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CanvasResult {
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: string[];
  canvasResult?: CanvasResult;
}

interface AIChatPanelProps {
  displayMode: 'icon' | 'compact' | 'full';
  onCanvasGenerated?: (data: CanvasResult) => void;
  sidebar?: boolean;
}

export function AIChatPanel({ displayMode, onCanvasGenerated, sidebar = false }: AIChatPanelProps) {
  const { nodes, edges, selectedNodeId, selectedEdgeId } = useCanvasStore();
  const { t, locale } = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupedItems, setGroupedItems] = useState<Array<{ kind: 'node' | 'edge'; id: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevSelectedNodeId = useRef<string | null>(null);
  const prevSelectedEdgeId = useRef<string | null>(null);

  const isCompact = displayMode === 'compact';
  const isFull = displayMode === 'full';

  // Resolve selected node for echo
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Resolve selected edge for echo
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return edges.find(e => e.id === selectedEdgeId) || null;
  }, [selectedEdgeId, edges]);

  // Resolve grouped items (nodes + edges)
  const resolvedGroupItems = useMemo(() => {
    return groupedItems.map(item => {
      if (item.kind === 'node') {
        const node = nodes.find(n => n.id === item.id);
        if (!node) return null;
        return { kind: 'node' as const, id: item.id, label: node.data?.label || node.id, type: node.type, node };
      } else {
        const edge = edges.find(e => e.id === item.id);
        if (!edge) return null;
        const src = nodes.find(n => n.id === edge.source);
        const tgt = nodes.find(n => n.id === edge.target);
        const edgeLabel = (edge.data as any)?.label;
        return {
          kind: 'edge' as const, id: item.id,
          label: `${src?.data?.label || edge.source} → ${tgt?.data?.label || edge.target}${edgeLabel ? ` (${edgeLabel})` : ''}`,
          edge,
        };
      }
    }).filter(Boolean) as Array<
      | { kind: 'node'; id: string; label: string; type: string; node: any }
      | { kind: 'edge'; id: string; label: string; edge: any }
    >;
  }, [groupedItems, nodes, edges]);

  // Selection echo — add a system-like message when user clicks a node
  useEffect(() => {
    if (!sidebar || !selectedNode) return;
    if (selectedNodeId === prevSelectedNodeId.current) return;
    prevSelectedNodeId.current = selectedNodeId;

    const label = selectedNode.data?.label || selectedNode.id;
    const type = selectedNode.type || 'node';

    if (isGroupMode && selectedNodeId) {
      // Group mode: toggle node in/out of group
      setGroupedItems(prev => {
        const exists = prev.some(i => i.kind === 'node' && i.id === selectedNodeId);
        if (exists) {
          setMessages(msgs => [...msgs, {
            id: `sel-${crypto.randomUUID()}`,
            role: 'assistant',
            content: `${t('ai.nodeRemoved')}: **${label}** (${type})`,
          }]);
          return prev.filter(i => !(i.kind === 'node' && i.id === selectedNodeId));
        } else {
          setMessages(msgs => [...msgs, {
            id: `sel-${crypto.randomUUID()}`,
            role: 'assistant',
            content: `${t('ai.nodeAdded')}: **${label}** (${type})${selectedNode.data?.description ? '\n' + selectedNode.data.description : ''}`,
          }]);
          return [...prev, { kind: 'node', id: selectedNodeId }];
        }
      });
    } else {
      // Normal mode: replace previous selection echo with new one
      setMessages(prev => [...prev.filter(m => !m.id.startsWith('sel-')), {
        id: `sel-${crypto.randomUUID()}`,
        role: 'assistant',
        content: `${t('ai.selectedNode')}: **${label}** (${type})${selectedNode.data?.description ? '\n' + selectedNode.data.description : ''}`,
      }]);
    }
  }, [selectedNodeId, selectedNode, sidebar, t, isGroupMode]);

  // Selection echo — edge click
  useEffect(() => {
    if (!sidebar || !selectedEdge) return;
    if (selectedEdgeId === prevSelectedEdgeId.current) return;
    prevSelectedEdgeId.current = selectedEdgeId;

    const sourceNode = nodes.find(n => n.id === selectedEdge.source);
    const targetNode = nodes.find(n => n.id === selectedEdge.target);
    const sourceLabel = sourceNode?.data?.label || selectedEdge.source;
    const targetLabel = targetNode?.data?.label || selectedEdge.target;
    const edgeLabel = (selectedEdge.data as any)?.label;
    const edgeDisplayLabel = `**${sourceLabel}** → **${targetLabel}**${edgeLabel ? ` (${edgeLabel})` : ''}`;

    if (isGroupMode && selectedEdgeId) {
      setGroupedItems(prev => {
        const exists = prev.some(i => i.kind === 'edge' && i.id === selectedEdgeId);
        if (exists) {
          setMessages(msgs => [...msgs, {
            id: `sel-edge-${crypto.randomUUID()}`,
            role: 'assistant',
            content: `${t('ai.nodeRemoved')}: ${edgeDisplayLabel}`,
          }]);
          return prev.filter(i => !(i.kind === 'edge' && i.id === selectedEdgeId));
        } else {
          setMessages(msgs => [...msgs, {
            id: `sel-edge-${crypto.randomUUID()}`,
            role: 'assistant',
            content: `${t('ai.nodeAdded')}: ${edgeDisplayLabel}`,
          }]);
          return [...prev, { kind: 'edge', id: selectedEdgeId }];
        }
      });
    } else {
      // Normal mode: replace previous selection echo with new one
      setMessages(prev => [...prev.filter(m => !m.id.startsWith('sel-')), {
        id: `sel-edge-${crypto.randomUUID()}`,
        role: 'assistant',
        content: `${t('ai.selectedEdge')}: ${edgeDisplayLabel}`,
      }]);
    }
  }, [selectedEdgeId, selectedEdge, sidebar, nodes, t, isGroupMode]);

  // Auto-scroll on new messages — only if user is near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    // Wait for DOM update before measuring
    requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) {
        container.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
    });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isFull) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input, isFull]);

  // Read file as text
  const readFile = useCallback(async (file: File): Promise<AttachedFile | null> => {
    try {
      const content = await file.text();
      return { name: file.name, content, size: file.size };
    } catch {
      return null;
    }
  }, []);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!panelRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsProcessingDrop(true);
    try {
      const read = await processDroppedItems(e.dataTransfer);
      setFiles(prev => [...prev, ...read]);
    } finally {
      setIsProcessingDrop(false);
    }
  }, []);

  // Paste handler for files
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const fileItems = items.filter(i => i.kind === 'file');
    if (fileItems.length === 0) return;
    e.preventDefault();
    const pastedFiles = fileItems.map(i => i.getAsFile()).filter(Boolean) as File[];
    const read = (await Promise.all(pastedFiles.map(readFile))).filter(Boolean) as AttachedFile[];
    setFiles(prev => [...prev, ...read]);
  }, [readFile]);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Detect if user wants to generate a schema
  const wantsSchema = useCallback((text: string, hasFiles: boolean): boolean => {
    if (!hasFiles && !text) return false;
    const keywords = ['схем', 'diagram', 'визуализ', 'canvas', 'сделай', 'построй', 'создай', 'generate', 'build', 'make', 'нарисуй', 'покажи', 'архитектур'];
    const lower = text.toLowerCase();
    return hasFiles && keywords.some(kw => lower.includes(kw));
  }, []);

  // Send message
  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && files.length === 0) || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      role: 'user',
      content: trimmed,
      files: files.map(f => f.name),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const attachedFiles = [...files];
    setFiles([]);
    setLoading(true);

    const shouldGenerate = wantsSchema(trimmed, attachedFiles.length > 0);

    try {
      // If user wants a schema — generate canvas from files
      if (shouldGenerate) {
        const filesSummary = attachedFiles.map(f => `--- ${f.name} ---\n${f.content}`).join('\n\n');
        const prompt = trimmed
          ? `${trimmed}\n\nФайлы для анализа:\n${filesSummary}`
          : `Создай архитектурную диаграмму на основе этих файлов:\n${filesSummary}`;

        const genRes = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, locale }),
        });

        const genData = await genRes.json();

        if (genRes.ok && genData.nodes?.length > 0) {
          const canvasResult: CanvasResult = {
            nodes: genData.nodes,
            edges: genData.edges,
            viewport: genData.viewport,
          };

          setMessages(prev => [...prev, {
            id: `msg-${crypto.randomUUID()}`,
            role: 'assistant',
            content: t('ai.schemaReady', { nodes: genData.nodes.length, edges: genData.edges.length }),
            canvasResult,
          }]);
        } else {
          throw new Error(genData.error || t('ai.schemaFailed'));
        }
      } else {
        // Regular chat
        const ctxNode = nodes.find(n => n.id === selectedNodeId);
        const ctxEdge = edges.find(e => e.id === selectedEdgeId);

        // Group mode: send all grouped items as context
        const hasGroupItems = isGroupMode && groupedItems.length > 0;
        const groupedNodesList = hasGroupItems
          ? groupedItems.filter(i => i.kind === 'node')
              .map(i => nodes.find(n => n.id === i.id))
              .filter(Boolean)
              .map(n => ({ id: n!.id, type: n!.type, label: n!.data.label, description: n!.data.description }))
          : null;
        const groupedEdgesList = hasGroupItems
          ? groupedItems.filter(i => i.kind === 'edge')
              .map(i => edges.find(e => e.id === i.id))
              .filter(Boolean)
              .map(e => ({
                source: e!.source, target: e!.target,
                sourceLabel: nodes.find(n => n.id === e!.source)?.data?.label || e!.source,
                targetLabel: nodes.find(n => n.id === e!.target)?.data?.label || e!.target,
                label: (e!.data as Record<string, unknown>)?.label || '',
              }))
          : null;

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            files: attachedFiles.map(f => ({ name: f.name, content: f.content })),
            context: {
              nodes: nodes.map(n => ({
                id: n.id, type: n.type,
                label: n.data.label,
                description: n.data.description,
              })),
              edges: edges.map(e => ({
                source: e.source, target: e.target,
                sourceLabel: nodes.find(n => n.id === e.source)?.data?.label || e.source,
                targetLabel: nodes.find(n => n.id === e.target)?.data?.label || e.target,
                label: (e.data as Record<string, unknown>)?.label || '',
              })),
              selectedNode: !hasGroupItems && ctxNode
                ? { id: ctxNode.id, type: ctxNode.type, label: ctxNode.data.label }
                : null,
              selectedNodes: groupedNodesList?.length ? groupedNodesList : undefined,
              selectedEdge: !hasGroupItems && ctxEdge
                ? {
                    source: ctxEdge.source,
                    target: ctxEdge.target,
                    sourceLabel: nodes.find(n => n.id === ctxEdge.source)?.data?.label || ctxEdge.source,
                    targetLabel: nodes.find(n => n.id === ctxEdge.target)?.data?.label || ctxEdge.target,
                    label: (ctxEdge.data as Record<string, unknown>)?.label || '',
                  }
                : null,
              selectedEdges: groupedEdgesList?.length ? groupedEdgesList : undefined,
            },
            history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            locale,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');

        setMessages(prev => [...prev, {
          id: `msg-${crypto.randomUUID()}`,
          role: 'assistant',
          content: data.message,
        }]);
      }
    } catch (err: unknown) {
      setMessages(prev => [...prev, {
        id: `msg-${crypto.randomUUID()}`,
        role: 'assistant',
        content: err instanceof Error ? err.message : t('ai.error'),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  // Icon mode — minimal view
  if (displayMode === 'icon') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-2 text-gray-400">
        <svg className="w-6 h-6 text-purple-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="text-[8px] text-center text-purple-400">AI</span>
      </div>
    );
  }

  // Full mode — ChatGPT/Claude-like UI
  if (isFull) {
    return (
      <div
        ref={panelRef}
        className="flex-1 flex flex-col overflow-hidden relative min-h-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop overlay */}
        <AnimatePresence>
          {(isDragOver || isProcessingDrop) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-purple-500/10 border-2 border-dashed border-purple-400 rounded-2xl flex items-center justify-center backdrop-blur-sm"
            >
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                  {isProcessingDrop ? (
                    <svg className="w-7 h-7 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                <p className="text-sm text-purple-400 font-medium">
                  {isProcessingDrop ? t('ai.processingFiles') : t('ai.dropFiles')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 chat-scrollbar">
          {/* Empty state */}
          {messages.length === 0 && !loading && (
            sidebar ? (
              <div className="flex-1 flex items-center justify-center h-full px-4">
                <div className="text-center">
                  <svg className="w-6 h-6 mx-auto mb-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t('ai.sidebarEmpty')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full px-6">
                <div className="text-center max-w-md">
                  {/* AI icon with glow */}
                  <div className="relative inline-flex mb-6">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-3xl blur-xl scale-150" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t('ai.emptyTitle')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                    {t('ai.emptyDescription')}
                  </p>

                  {/* Suggestion chips */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {[t('ai.suggestion1'), t('ai.suggestion2'), t('ai.suggestion3')].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(suggestion)}
                        className="px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-600 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  {/* Drag & drop hint */}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {t('ai.emptyHint')}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Message list */}
          {messages.length > 0 && (
            <div className={`${sidebar ? 'px-2 py-3 space-y-3' : 'max-w-3xl mx-auto px-4 py-6 space-y-6'}`}>
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex ${sidebar ? 'gap-2' : 'gap-3'} ${msg.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {/* Assistant avatar */}
                    {msg.role === 'assistant' && (
                      <div className={`flex-shrink-0 ${sidebar ? 'w-6 h-6 rounded-lg' : 'w-8 h-8 rounded-xl'} bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mt-0.5`}>
                        <svg className={`${sidebar ? 'w-3 h-3' : 'w-4 h-4'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`relative group/msg min-w-0 ${sidebar ? 'max-w-[85%] rounded-xl px-2.5 py-2' : 'max-w-[80%] rounded-2xl px-4 py-3'} ${
                      msg.role === 'assistant'
                        ? 'bg-gray-100 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200'
                        : 'bg-purple-600 text-white'
                    }`}>
                      {/* Dismiss button for echo messages */}
                      {msg.id.startsWith('sel-') && (
                        <button
                          onClick={() => removeMessage(msg.id)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-red-400 hover:text-white flex items-center justify-center text-[10px] leading-none opacity-0 group-hover/msg:opacity-100 transition-opacity"
                        >
                          &times;
                        </button>
                      )}
                      {msg.role === 'assistant' ? (
                        <div className={`${sidebar ? 'text-xs' : 'text-sm'} leading-relaxed prose ${sidebar ? 'prose-xs' : 'prose-sm'} dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 max-w-full overflow-hidden`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className={`${sidebar ? 'text-xs' : 'text-sm'} whitespace-pre-wrap break-words leading-relaxed`}>{msg.content}</p>
                      )}
                      {msg.files && msg.files.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                          {msg.files.map((f, i) => (
                            <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs ${
                              msg.role === 'user'
                                ? 'bg-white/20 text-white/90'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                      {msg.canvasResult && onCanvasGenerated && (
                        <button
                          onClick={() => onCanvasGenerated(msg.canvasResult!)}
                          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                          </svg>
                          {t('ai.openSchema')}
                        </button>
                      )}
                    </div>

                    {/* User avatar */}
                    {msg.role === 'user' && (
                      <div className={`flex-shrink-0 ${sidebar ? 'w-6 h-6 rounded-lg' : 'w-8 h-8 rounded-xl'} bg-gray-200 dark:bg-gray-700 flex items-center justify-center mt-0.5`}>
                        <svg className={`${sidebar ? 'w-3 h-3' : 'w-4 h-4'} text-gray-500 dark:text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Loading */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-100 dark:bg-gray-800/80 rounded-2xl">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area — fixed at bottom */}
        <div className="border-t border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className={`${sidebar ? 'px-2 py-2' : 'max-w-3xl mx-auto px-4 py-4'}`}>
            {/* Context chips — unified list for group mode */}
            {sidebar && isGroupMode && resolvedGroupItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {resolvedGroupItems.map(item => (
                  <div key={`${item.kind}-${item.id}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${
                    item.kind === 'node'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}>
                    {item.kind === 'node' ? (
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        item.type === 'tech' ? 'bg-blue-500' :
                        item.type === 'database' ? 'bg-purple-500' :
                        item.type === 'business' ? 'bg-indigo-500' : 'bg-gray-400'
                      }`} />
                    ) : (
                      <svg className="w-3 h-3 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                    <span className={`text-[11px] truncate font-medium max-w-[100px] ${
                      item.kind === 'node'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      {item.label}
                    </span>
                    <button
                      onClick={() => setGroupedItems(prev => prev.filter(i => !(i.kind === item.kind && i.id === item.id)))}
                      className={`ml-0.5 hover:text-red-500 transition-colors text-xs leading-none ${
                        item.kind === 'node' ? 'text-blue-400' : 'text-amber-400'
                      }`}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center">
                  {t('ai.groupNodes', { count: resolvedGroupItems.length })}
                </span>
              </div>
            )}
            {/* Attached files chips */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-1.5 mb-3"
                >
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs border border-purple-200 dark:border-purple-800">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {f.name}
                      <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-red-500 transition-colors text-purple-400">&times;</button>
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input container */}
            <div className="relative flex items-end gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm focus-within:border-purple-400 dark:focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all duration-200">
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 p-3 text-gray-400 hover:text-purple-500 transition-colors"
                title={t('ai.attachFile')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const selected = Array.from(e.target.files || []);
                  const read = (await Promise.all(selected.map(readFile))).filter(Boolean) as AttachedFile[];
                  setFiles(prev => [...prev, ...read]);
                  e.target.value = '';
                }}
              />

              {/* Group mode toggle */}
              {sidebar && (
                <button
                  onClick={() => {
                    setIsGroupMode(prev => {
                      if (prev) setGroupedItems([]);
                      return !prev;
                    });
                  }}
                  className={`flex-shrink-0 p-3 transition-colors ${
                    isGroupMode
                      ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'text-gray-400 hover:text-purple-500'
                  }`}
                  title={isGroupMode ? t('ai.groupModeHint') : t('ai.groupMode')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
                  </svg>
                </button>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t('ai.chatPlaceholder')}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none py-3 leading-relaxed"
                style={{ maxHeight: '160px' }}
              />

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={loading || (!input.trim() && files.length === 0)}
                className="flex-shrink-0 m-2 p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 rounded-xl transition-all duration-200 disabled:opacity-60"
                title={t('ai.send')}
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              Ctrl+Enter {t('ai.toGenerate')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compact mode — sidebar panel
  return (
    <div
      ref={panelRef}
      className="flex-1 flex flex-col overflow-hidden relative min-h-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {(isDragOver || isProcessingDrop) && (
        <div className="absolute inset-0 z-20 bg-purple-500/10 border-2 border-dashed border-purple-400 rounded-lg flex items-center justify-center backdrop-blur-[1px]">
          <div className="text-center">
            {isProcessingDrop ? (
              <svg className="w-8 h-8 text-purple-400 mx-auto mb-1 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-purple-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            <p className="text-xs text-purple-400 font-medium">
              {isProcessingDrop ? t('ai.processingFiles') : t('ai.dropFiles')}
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-1.5 space-y-1.5 chat-scrollbar">
        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto mb-2 text-purple-300 dark:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">
                {t('ai.chatPlaceholder')}
              </p>
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Role label */}
            <div className="flex items-center gap-1 mb-0.5 text-[8px]">
              {msg.role === 'assistant' ? (
                <>
                  <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-medium text-purple-500">AI</span>
                </>
              ) : (
                <span className="font-medium text-gray-400">{t('ai.you')}</span>
              )}
            </div>
            {/* Bubble */}
            <div className={`relative group/msg min-w-0 rounded-lg px-1.5 py-1 text-[10px] ${
              msg.role === 'assistant'
                ? 'bg-purple-50 dark:bg-purple-900/20 text-gray-700 dark:text-gray-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {/* Dismiss button for echo messages */}
              {msg.id.startsWith('sel-') && (
                <button
                  onClick={() => removeMessage(msg.id)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-red-400 hover:text-white flex items-center justify-center text-[9px] leading-none opacity-0 group-hover/msg:opacity-100 transition-opacity"
                >
                  &times;
                </button>
              )}
              {msg.role === 'assistant' ? (
                <div className="leading-relaxed prose prose-xs dark:prose-invert prose-p:my-0.5 prose-ul:my-0.5 prose-li:my-0 max-w-full overflow-hidden">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
              )}
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {msg.files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[9px] text-gray-500 dark:text-gray-400">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading dots */}
        {loading && (
          <div>
            <div className="flex items-center gap-1 mb-0.5 text-[8px]">
              <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium text-purple-500">AI</span>
            </div>
            <div className="inline-flex items-center gap-1 px-2.5 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-1.5">
        {/* Grouped items chips (compact) */}
        {isGroupMode && resolvedGroupItems.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {resolvedGroupItems.map(item => (
              <span key={`${item.kind}-${item.id}`} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border ${
                item.kind === 'node'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}>
                {item.kind === 'node' ? (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    item.type === 'tech' ? 'bg-blue-500' :
                    item.type === 'database' ? 'bg-purple-500' :
                    item.type === 'business' ? 'bg-indigo-500' : 'bg-gray-400'
                  }`} />
                ) : (
                  <svg className="w-2.5 h-2.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
                <span className="truncate max-w-[60px]">{item.label}</span>
                <button
                  onClick={() => setGroupedItems(prev => prev.filter(i => !(i.kind === item.kind && i.id === item.id)))}
                  className={`ml-0.5 hover:text-red-500 transition-colors leading-none ${
                    item.kind === 'node' ? 'text-blue-400' : 'text-amber-400'
                  }`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Attached files chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded text-[10px]">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {f.name}
                <button onClick={() => removeFile(i)} className="hover:text-red-500 transition-colors">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-1.5 items-end">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-gray-400 hover:text-purple-500 transition-colors p-0.5"
            title={t('ai.attachFile')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={async (e) => {
              const selected = Array.from(e.target.files || []);
              const read = (await Promise.all(selected.map(readFile))).filter(Boolean) as AttachedFile[];
              setFiles(prev => [...prev, ...read]);
              e.target.value = '';
            }}
          />

          {/* Group mode toggle (compact) */}
          <button
            onClick={() => {
              setIsGroupMode(prev => {
                if (prev) setGroupedItems([]);
                return !prev;
              });
            }}
            className={`shrink-0 p-0.5 transition-colors rounded ${
              isGroupMode
                ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-400 hover:text-purple-500'
            }`}
            title={isGroupMode ? t('ai.groupModeHint') : t('ai.groupMode')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isGroupMode ? t('ai.groupModeHint') : t('ai.chatPlaceholder')}
            rows={1}
            className="flex-1 resize-none border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 px-1.5 py-1 text-[10px]"
            style={{ maxHeight: '80px' }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && files.length === 0)}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 p-1"
            title={t('ai.send')}
          >
            {loading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
