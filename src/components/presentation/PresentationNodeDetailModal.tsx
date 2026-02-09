'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCanvasStore } from '@/stores/canvasStore';
import type { AppNode, AppEdge, TechNodeData, DatabaseNodeData, BusinessNodeData, CommentNodeData } from '@/types/canvas';

interface PresentationNodeDetailModalProps {
  node: AppNode | null;
  onClose: () => void;
}

const typeColors: Record<string, { badge: string; icon: string }> = {
  tech: { badge: 'bg-blue-500/20 text-blue-300', icon: 'bg-blue-500' },
  database: { badge: 'bg-purple-500/20 text-purple-300', icon: 'bg-purple-500' },
  business: { badge: 'bg-indigo-500/20 text-indigo-300', icon: 'bg-indigo-500' },
  comment: { badge: 'bg-amber-500/20 text-amber-300', icon: 'bg-amber-500' },
  group: { badge: 'bg-gray-500/20 text-gray-300', icon: 'bg-gray-500' },
  shape: { badge: 'bg-cyan-500/20 text-cyan-300', icon: 'bg-cyan-500' },
};

type TtsStatus = 'idle' | 'loading-intro' | 'speaking-intro' | 'waiting-presenter' | 'speaking-presenter' | 'paused';

// Strip markdown to plain text for TTS
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/>\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

// Generate an intro phrase from local node data (no AI needed)
function generateIntroPhrase(node: AppNode, edges: AppEdge[], allNodes: AppNode[]): string {
  const label = node.data?.label || node.id;
  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const connectedCount = connectedEdges.length;

  const connectedNames = connectedEdges
    .map(e => {
      const otherId = e.source === node.id ? e.target : e.source;
      return allNodes.find(n => n.id === otherId)?.data?.label || otherId;
    })
    .slice(0, 3);

  const connectionSuffix = connectedCount > 0
    ? ` Связан с ${connectedCount} ${connectedCount === 1 ? 'компонентом' : connectedCount < 5 ? 'компонентами' : 'компонентами'}: ${connectedNames.join(', ')}${connectedCount > 3 ? ' и другими' : ''}.`
    : '';

  switch (node.type) {
    case 'tech': {
      const data = node.data as TechNodeData;
      const methodPart = data.method ? ` с эндпоинтом ${data.method}` : '';
      return `Давайте рассмотрим компонент ${label}. Это технический сервис${methodPart}.${connectionSuffix}`;
    }
    case 'database': {
      const data = node.data as DatabaseNodeData;
      const tablePart = data.tableName ? ` с таблицей ${data.tableName}` : '';
      return `Перед нами ${label}${tablePart}. Хранилище данных.${connectionSuffix}`;
    }
    case 'business': {
      const data = node.data as BusinessNodeData;
      const statusPart = data.status ? ` в статусе ${data.status}` : '';
      return `Рассмотрим бизнес-компонент ${label}${statusPart}.${connectionSuffix}`;
    }
    case 'comment': {
      const data = node.data as CommentNodeData;
      const authorPart = data.author ? ` от ${data.author}` : '';
      return `Здесь заметка${authorPart} — ${label}.`;
    }
    default:
      return `Давайте рассмотрим ${label}.${connectionSuffix}`;
  }
}

// Fetch TTS audio blob without playing it
async function fetchTtsBlob(text: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `TTS HTTP ${res.status}`);
  }

  const blob = await res.blob();
  if (signal.aborted) return null;
  return URL.createObjectURL(blob);
}

// Play an audio blob URL, resolve when ended
function playAudioBlob(blobUrl: string, audioRef: React.MutableRefObject<HTMLAudioElement | null>): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(blobUrl);
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(blobUrl);
      audioRef.current = null;
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      audioRef.current = null;
      reject(new Error('Audio playback error'));
    };

    audio.play().catch(reject);
  });
}

export function PresentationNodeDetailModal({ node, onClose }: PresentationNodeDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { nodes, edges } = useCanvasStore();

  // AI description state
  const [aiText, setAiText] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [aiError, setAiError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const fullAiTextRef = useRef('');
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TTS state (two-phase audio pipeline)
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentPhaseRef = useRef<'intro' | 'presenter' | null>(null);

  // Store presenter narration blob URL for replay
  const [presenterNarration, setPresenterNarration] = useState<string | null>(null);
  const presenterBlobRef = useRef<string | null>(null);

  // Typewriter: start printing full text char by char
  const startTypewriter = useCallback((fullText: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    fullAiTextRef.current = fullText;
    let idx = 0;
    setAiText('');
    setAiTyping(true);

    // Print in chunks of 2-3 chars for natural speed
    typewriterRef.current = setInterval(() => {
      const chunkSize = fullText[idx] === ' ' ? 3 : 2;
      idx += chunkSize;
      if (idx >= fullText.length) {
        setAiText(fullText);
        setAiTyping(false);
        if (typewriterRef.current) {
          clearInterval(typewriterRef.current);
          typewriterRef.current = null;
        }
      } else {
        setAiText(fullText.slice(0, idx));
      }
    }, 20);
  }, []);

  const stopTypewriter = useCallback(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    // Show full text instantly if we had one
    if (fullAiTextRef.current) {
      setAiText(fullAiTextRef.current);
    }
    setAiTyping(false);
  }, []);

  // Pending Phase 2 blob URL (ready to play after Phase 1)
  const pendingPhase2Ref = useRef<string | null>(null);
  // Flag: Phase 1 has finished playing
  const phase1DoneRef = useRef(false);
  // Flag: Phase 2 fetch failed
  const phase2ErrorRef = useRef(false);

  // Stop audio helper
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      audioRef.current = null;
    }
    currentPhaseRef.current = null;
    setTtsStatus('idle');
  }, []);

  // Play Phase 2 (presenter narration)
  const playPhase2 = useCallback(async (blobUrl: string) => {
    currentPhaseRef.current = 'presenter';
    setTtsStatus('speaking-presenter');
    try {
      await playAudioBlob(blobUrl, audioRef);
      currentPhaseRef.current = null;
      setTtsStatus('idle');
    } catch {
      currentPhaseRef.current = null;
      setTtsStatus('idle');
    }
  }, []);

  // Try to play Phase 2 — called when Phase 1 ends or Phase 2 blob becomes ready
  const tryPlayPhase2 = useCallback(() => {
    if (phase1DoneRef.current && pendingPhase2Ref.current) {
      const blobUrl = pendingPhase2Ref.current;
      pendingPhase2Ref.current = null;
      playPhase2(blobUrl);
    } else if (phase1DoneRef.current && !pendingPhase2Ref.current && !phase2ErrorRef.current) {
      // Phase 1 done but Phase 2 not ready yet — show waiting state
      setTtsStatus('waiting-presenter');
    }
    // If phase2ErrorRef is true, we just stay idle after Phase 1
  }, [playPhase2]);

  // Cleanup TTS + typewriter when node changes or modal closes
  useEffect(() => {
    return () => {
      stopAudio();
      stopTypewriter();
      // Revoke any pending blob URLs
      if (pendingPhase2Ref.current) {
        URL.revokeObjectURL(pendingPhase2Ref.current);
        pendingPhase2Ref.current = null;
      }
      if (presenterBlobRef.current) {
        URL.revokeObjectURL(presenterBlobRef.current);
        presenterBlobRef.current = null;
      }
    };
  }, [node?.id, stopAudio, stopTypewriter]);

  // Main effect: two-phase audio pipeline + description fetch
  useEffect(() => {
    if (!node) {
      setAiText('');
      setAiError('');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    stopTypewriter();
    setAiText('');
    fullAiTextRef.current = '';
    setAiError('');
    setAiTyping(false);
    setTtsStatus('loading-intro');
    setPresenterNarration(null);
    phase1DoneRef.current = false;
    pendingPhase2Ref.current = null;
    phase2ErrorRef.current = false;
    presenterBlobRef.current = null;

    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);

    const contextPayload = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.data?.label,
        description: n.data?.description,
      })),
      edges: connectedEdges.map(e => ({
        source: e.source,
        target: e.target,
        sourceLabel: nodes.find(n => n.id === e.source)?.data?.label || e.source,
        targetLabel: nodes.find(n => n.id === e.target)?.data?.label || e.target,
        label: (e.data as Record<string, unknown>)?.label || '',
      })),
      selectedNode: {
        id: node.id,
        type: node.type,
        label: node.data?.label,
      },
    };

    // --- PHASE 1: Immediate intro phrase → TTS → play ---
    const introText = generateIntroPhrase(node, edges, nodes);
    const phase1Promise = (async () => {
      try {
        const blobUrl = await fetchTtsBlob(introText, controller.signal);
        if (controller.signal.aborted || !blobUrl) return;

        currentPhaseRef.current = 'intro';
        setTtsStatus('speaking-intro');
        await playAudioBlob(blobUrl, audioRef);

        if (controller.signal.aborted) return;
        phase1DoneRef.current = true;
        currentPhaseRef.current = null;
        // Try transitioning to Phase 2
        tryPlayPhase2();
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.warn('[TTS Phase 1] error:', err?.message);
        // Phase 1 failed — skip to Phase 2 when ready
        phase1DoneRef.current = true;
        currentPhaseRef.current = null;
        tryPlayPhase2();
      }
    })();

    // --- PHASE 2: Presenter AI → TTS → queue for after Phase 1 ---
    const phase2Promise = (async () => {
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: `Дай краткое описание этого компонента архитектуры: "${node.data?.label || node.id}". Опиши его роль, зачем он нужен, как связан с другими компонентами.`,
            context: contextPayload,
            locale: 'ru',
            mode: 'presenter',
          }),
        });
        const data = await res.json();
        if (controller.signal.aborted) return;

        const presenterText = data.message || '';
        if (!presenterText) return;

        setPresenterNarration(presenterText);

        const blobUrl = await fetchTtsBlob(presenterText, controller.signal);
        if (controller.signal.aborted || !blobUrl) return;

        presenterBlobRef.current = blobUrl;
        pendingPhase2Ref.current = blobUrl;

        // If Phase 1 is already done, play immediately
        if (phase1DoneRef.current) {
          const url = pendingPhase2Ref.current;
          pendingPhase2Ref.current = null;
          playPhase2(url);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.warn('[Phase 2 presenter] error:', err?.message);
        phase2ErrorRef.current = true;
        // If Phase 1 done and we were waiting, go to idle
        if (phase1DoneRef.current) {
          setTtsStatus('idle');
        }
      }
    })();

    // --- PHASE 3 (parallel): Description AI → on-screen text (typewriter) ---
    const phase3Promise = (async () => {
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: `Дай краткое описание этого компонента архитектуры: "${node.data?.label || node.id}". Опиши его роль, зачем он нужен, как связан с другими компонентами. Ответ 3-5 предложений, можно использовать markdown.`,
            context: contextPayload,
            locale: 'ru',
            mode: 'description',
          }),
        });
        const data = await res.json();
        if (!controller.signal.aborted) {
          const text = data.message || '';
          if (text) {
            startTypewriter(text);
          } else {
            setAiTyping(false);
          }
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setAiError(err?.message || 'Ошибка AI');
          setAiTyping(false);
        }
      }
    })();

    // Silence lint about unused promises
    void phase1Promise;
    void phase2Promise;
    void phase3Promise;

    return () => {
      controller.abort();
      stopAudio();
      stopTypewriter();
      if (pendingPhase2Ref.current) {
        URL.revokeObjectURL(pendingPhase2Ref.current);
        pendingPhase2Ref.current = null;
      }
    };
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play/Pause toggle
  const handleTtsToggle = useCallback(() => {
    const isSpeaking = ttsStatus === 'speaking-intro' || ttsStatus === 'speaking-presenter';

    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      setTtsStatus('paused');
      return;
    }

    if (ttsStatus === 'paused' && audioRef.current) {
      audioRef.current.play();
      // Restore the correct speaking status based on current phase
      const phase = currentPhaseRef.current;
      setTtsStatus(phase === 'intro' ? 'speaking-intro' : 'speaking-presenter');
      return;
    }

    // idle — replay presenter narration only (no intro on replay)
    if (ttsStatus === 'idle' && presenterNarration) {
      (async () => {
        setTtsStatus('loading-intro'); // reuse loading state
        try {
          const blobUrl = await fetchTtsBlob(presenterNarration, new AbortController().signal);
          if (blobUrl) {
            currentPhaseRef.current = 'presenter';
            setTtsStatus('speaking-presenter');
            await playAudioBlob(blobUrl, audioRef);
            currentPhaseRef.current = null;
            setTtsStatus('idle');
          }
        } catch {
          setTtsStatus('idle');
        }
      })();
    }
  }, [ttsStatus, presenterNarration]);

  // Stop button
  const handleTtsStop = useCallback(() => {
    stopAudio();
    // Clear pending Phase 2
    if (pendingPhase2Ref.current) {
      URL.revokeObjectURL(pendingPhase2Ref.current);
      pendingPhase2Ref.current = null;
    }
    phase1DoneRef.current = true; // Prevent Phase 2 from auto-starting
    phase2ErrorRef.current = true;
  }, [stopAudio]);

  // Close on Escape
  useEffect(() => {
    if (!node) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        stopAudio();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [node, onClose, stopAudio]);

  // Focus dialog on open
  useEffect(() => {
    if (node && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [node]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      stopAudio();
      onClose();
    }
  }, [onClose, stopAudio]);

  // Derive display data
  const data = node?.data;
  const label = data?.label || '';
  const description = data?.description || '';
  const colors = typeColors[node?.type || ''] || { badge: 'bg-white/10 text-gray-400', icon: 'bg-gray-500' };
  const fullContent = (data as CommentNodeData | undefined)?.fullContent;
  const hasMarkdown = fullContent && fullContent.length > 0;

  // Derive UI states from ttsStatus
  const isSpeaking = ttsStatus === 'speaking-intro' || ttsStatus === 'speaking-presenter';
  const isLoading = ttsStatus === 'loading-intro' || ttsStatus === 'waiting-presenter';
  const isActive = isSpeaking || isLoading || ttsStatus === 'paused';

  // Voice phase label
  const voicePhaseLabel = (() => {
    switch (ttsStatus) {
      case 'loading-intro': return 'Загрузка голоса...';
      case 'speaking-intro': return 'Вступление...';
      case 'waiting-presenter': return 'Подготовка...';
      case 'speaking-presenter': return 'Рассказ презентатора';
      case 'paused': return 'Пауза';
      default: return null;
    }
  })();

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key="node-detail-modal"
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Node details: ${label}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-stretch p-6 outline-none"
          onClick={handleBackdropClick}
        >
          {/* Left panel — Node details */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-1/2 max-h-full flex flex-col overflow-hidden mr-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 ${colors.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <NodeTypeIcon type={node.type || ''} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${colors.badge}`}>
                      {node.type || 'node'}
                    </span>
                    {data?.color && (
                      <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: data.color }} />
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white truncate">{label}</h2>
                </div>
              </div>
              <button
                onClick={() => { stopAudio(); onClose(); }}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors flex-shrink-0 ml-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {description && (
                <p className="text-sm text-gray-300 leading-relaxed">{description}</p>
              )}

              {node.type === 'tech' && <TechDetails data={node.data as TechNodeData} />}
              {node.type === 'database' && <DatabaseDetails data={node.data as DatabaseNodeData} />}
              {node.type === 'business' && <BusinessDetails data={node.data as BusinessNodeData} />}
              {node.type === 'comment' && <CommentDetails data={node.data as CommentNodeData} />}

              {hasMarkdown && (
                <>
                  <div className="border-t border-white/10" />
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-gray-100 prose-p:text-gray-300 prose-a:text-blue-400 prose-code:text-purple-300 prose-code:bg-purple-900/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-table:text-sm prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-900/20 prose-blockquote:py-1 prose-li:marker:text-gray-500">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            {children}
                          </a>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                            <table className="min-w-full border-collapse">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="border-b border-white/10 bg-white/5 px-4 py-2.5 text-left font-semibold text-sm text-gray-200">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="border-b border-white/5 px-4 py-2.5 text-sm text-gray-300">{children}</td>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-800 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">{children}</pre>
                        ),
                      }}
                    >
                      {fullContent}
                    </ReactMarkdown>
                  </div>
                </>
              )}

              {!description && !hasMarkdown && node.type !== 'tech' && node.type !== 'database' && node.type !== 'business' && node.type !== 'comment' && (
                <p className="text-sm text-gray-500 italic">No additional details available.</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 flex-shrink-0">
              <span className="text-[10px] text-gray-500">Esc or click outside to close</span>
            </div>
          </motion.div>

          {/* Right panel — AI description */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.05 }}
            className="bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-1/2 max-h-full flex flex-col overflow-hidden ml-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* AI Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">AI-описание</h2>
                <p className="text-[11px] text-gray-500">Краткий анализ компонента</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {/* TTS controls */}
                {(isSpeaking || isLoading || ttsStatus === 'paused' || ttsStatus === 'idle') && (
                  <>
                    <button
                      onClick={handleTtsToggle}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isSpeaking || ttsStatus === 'paused'
                          ? 'bg-purple-500/20 text-purple-400'
                          : isLoading
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
                      }`}
                      title={
                        isSpeaking ? 'Пауза' :
                        ttsStatus === 'paused' ? 'Продолжить' :
                        isLoading ? 'Загрузка голоса...' :
                        'Озвучить'
                      }
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : isSpeaking ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    {isActive && (
                      <button
                        onClick={handleTtsStop}
                        className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Остановить"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
                {/* AI typing indicator */}
                {aiTyping && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Voice phase indicator */}
            {voicePhaseLabel && (
              <div className="flex items-center gap-2 px-6 py-2 border-b border-white/5 bg-white/[0.02]">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isSpeaking ? 'bg-green-400 animate-pulse' :
                  ttsStatus === 'waiting-presenter' ? 'bg-yellow-400 animate-pulse' :
                  ttsStatus === 'paused' ? 'bg-yellow-400' :
                  'bg-purple-400 animate-pulse'
                }`} />
                <span className="text-[11px] text-gray-400">{voicePhaseLabel}</span>
              </div>
            )}

            {/* AI Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!aiText && !aiError && !aiTyping && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="inline-block w-1.5 h-4 bg-purple-400/60 animate-pulse rounded-sm" />
                  <span>Генерация описания...</span>
                </div>
              )}

              {aiError && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-sm text-red-400 text-center">{aiError}</p>
                </div>
              )}

              {aiText && (
                <div className="prose prose-invert prose-sm max-w-none prose-headings:text-gray-100 prose-p:text-gray-300 prose-a:text-blue-400 prose-code:text-purple-300 prose-code:bg-purple-900/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-li:marker:text-gray-500">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiText}
                  </ReactMarkdown>
                  {aiTyping && (
                    <span className="inline-block w-1.5 h-4 bg-purple-400/80 animate-pulse rounded-sm align-middle ml-0.5" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NodeTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'comment':
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      );
    case 'shape':
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
        </svg>
      );
    case 'database':
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      );
  }
}

function TechDetails({ data }: { data: TechNodeData }) {
  if (!data.apiEndpoint && !data.method) return null;
  return (
    <div className="space-y-2 bg-white/5 rounded-xl p-4">
      {data.method && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16">Method</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
            {data.method}
          </span>
        </div>
      )}
      {data.apiEndpoint && (
        <div className="flex items-start gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16 pt-0.5">Endpoint</span>
          <span className="text-xs font-mono text-gray-300 break-all">{data.apiEndpoint}</span>
        </div>
      )}
    </div>
  );
}

function DatabaseDetails({ data }: { data: DatabaseNodeData }) {
  if (!data.tableName && (!data.columns || data.columns.length === 0)) return null;
  return (
    <div className="space-y-2 bg-white/5 rounded-xl p-4">
      {data.tableName && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16">Table</span>
          <span className="text-xs font-mono text-purple-300">{data.tableName}</span>
        </div>
      )}
      {data.columns && data.columns.length > 0 && (
        <div className="flex items-start gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16 pt-0.5">Columns</span>
          <div className="flex flex-wrap gap-1">
            {data.columns.map((col, i) => (
              <span key={i} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BusinessDetails({ data }: { data: BusinessNodeData }) {
  if (!data.metric && !data.status) return null;
  const statusColors: Record<string, string> = {
    active: 'text-green-400',
    planned: 'text-yellow-400',
    deprecated: 'text-red-400',
  };
  return (
    <div className="space-y-2 bg-white/5 rounded-xl p-4">
      {data.status && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16">Status</span>
          <span className={`text-xs capitalize ${statusColors[data.status] || 'text-gray-300'}`}>
            {data.status}
          </span>
        </div>
      )}
      {data.metric && (
        <div className="flex items-start gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16 pt-0.5">Metric</span>
          <span className="text-xs text-gray-300">{data.metric}</span>
        </div>
      )}
    </div>
  );
}

function CommentDetails({ data }: { data: CommentNodeData }) {
  if (data.fullContent) {
    return data.author ? (
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 uppercase w-16">Author</span>
          <span className="text-xs text-gray-400">{data.author}</span>
        </div>
      </div>
    ) : null;
  }

  if (!data.content) return null;
  return (
    <div className="space-y-2 bg-white/5 rounded-xl p-4">
      <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
        {data.content}
      </div>
      {data.author && (
        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
          <span className="text-[10px] text-gray-500 uppercase w-16">Author</span>
          <span className="text-xs text-gray-400">{data.author}</span>
        </div>
      )}
    </div>
  );
}
