'use client';

import { useState, useCallback } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';
import type { Presentation } from '@/types/canvas';

interface PresentationPanelProps {
  displayMode: 'icon' | 'compact' | 'full';
}

export function PresentationPanel({ displayMode }: PresentationPanelProps) {
  const {
    presentations,
    scenarios,
    activePresentationId,
    createPresentation,
    updatePresentation,
    deletePresentation,
    setActivePresentation,
    startPresentationMode,
    setPresentationNotes,
  } = useCanvasStore();
  const { t, locale } = useTranslation();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayInterval, setAutoplayInterval] = useState<5000 | 10000 | 15000>(5000);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [generatingNotesId, setGeneratingNotesId] = useState<string | null>(null);
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState<string | null>(null);

  const isIconMode = displayMode === 'icon';
  const isCompactMode = displayMode === 'compact';

  const activePresentation = activePresentationId
    ? presentations.find(p => p.id === activePresentationId)
    : null;

  const handleCreate = useCallback(() => {
    if (!name.trim() || selectedScenarioIds.length === 0) return;
    const id = createPresentation(name.trim(), selectedScenarioIds);
    updatePresentation(id, { settings: { autoplay, autoplayInterval } });
    setIsCreating(false);
    setName('');
    setSelectedScenarioIds([]);
    setAutoplay(false);
    setAutoplayInterval(5000);
  }, [name, selectedScenarioIds, autoplay, autoplayInterval, createPresentation, updatePresentation]);

  const handleEdit = useCallback((pres: Presentation) => {
    setEditingId(pres.id);
    setName(pres.name);
    setSelectedScenarioIds(pres.scenarioIds);
    setAutoplay(pres.settings.autoplay);
    setAutoplayInterval(pres.settings.autoplayInterval);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !name.trim()) return;
    updatePresentation(editingId, {
      name: name.trim(),
      scenarioIds: selectedScenarioIds,
      settings: { autoplay, autoplayInterval },
    });
    setEditingId(null);
    setName('');
    setSelectedScenarioIds([]);
  }, [editingId, name, selectedScenarioIds, autoplay, autoplayInterval, updatePresentation]);

  const handleDelete = useCallback((id: string) => {
    if (confirmDeleteId === id) {
      deletePresentation(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  }, [confirmDeleteId, deletePresentation]);

  const toggleScenario = useCallback((scenarioId: string) => {
    setSelectedScenarioIds(prev =>
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  }, []);

  const handleGenerateNotes = useCallback(async (pres: Presentation) => {
    setGeneratingNotesId(pres.id);
    try {
      // Collect all steps with sub-slide info from all scenarios
      const allSteps: Array<{
        scenarioId: string;
        stepId: string;
        name: string;
        description: string;
        nodeIds: string[];
        subSlideNodeIds?: string[]; // For per-node caption generation
      }> = [];

      for (const scenarioId of pres.scenarioIds) {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) continue;
        for (const step of scenario.steps) {
          // Overview step
          allSteps.push({
            scenarioId,
            stepId: step.id,
            name: step.name,
            description: step.description,
            nodeIds: step.nodeIds,
            subSlideNodeIds: step.nodeIds, // pass node IDs for per-node generation
          });
        }
      }

      const { nodes, edges } = useCanvasStore.getState();
      const nodeData = nodes.map(n => ({ id: n.id, type: n.type, label: n.data.label, description: n.data.description }));
      const edgeData = edges.map(e => ({ source: e.source, target: e.target, label: e.data?.label }));

      // Generate captions (overview + per-node)
      const captionRes = await fetch('/api/ai/presentation-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: allSteps,
          nodes: nodeData,
          edges: edgeData,
          mode: 'captions',
          locale,
          includeNodeSlides: true,
        }),
      });
      const captionData = await captionRes.json();

      // Generate speaker notes (overview + per-node)
      const notesRes = await fetch('/api/ai/presentation-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: allSteps,
          nodes: nodeData,
          edges: edgeData,
          mode: 'speaker',
          locale,
          includeNodeSlides: true,
        }),
      });
      const notesData = await notesRes.json();

      // Merge into presentation notes: overview keys + node keys
      for (const step of allSteps) {
        const overviewKey = `${step.scenarioId}:${step.stepId}`;
        setPresentationNotes(pres.id, overviewKey, {
          caption: captionData.notes?.[overviewKey] || '',
          speakerNotes: notesData.notes?.[overviewKey] || '',
        });

        // Node-level notes
        for (const nodeId of step.nodeIds) {
          const nodeKey = `${step.scenarioId}:${step.stepId}:${nodeId}`;
          if (captionData.notes?.[nodeKey] || notesData.notes?.[nodeKey]) {
            setPresentationNotes(pres.id, nodeKey, {
              caption: captionData.notes?.[nodeKey] || '',
              speakerNotes: notesData.notes?.[nodeKey] || '',
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate notes:', err);
    } finally {
      setGeneratingNotesId(null);
    }
  }, [scenarios, setPresentationNotes, locale]);

  const handleShare = useCallback(async (pres: Presentation) => {
    if (pres.isPublic) {
      // Disable sharing
      updatePresentation(pres.id, { isPublic: false });
    } else {
      // Start recording run-through: launch presentation in recording mode
      const { startRecording } = useCanvasStore.getState();
      startRecording();
      startPresentationMode(pres.id);
    }
  }, [updatePresentation, startPresentationMode]);

  const handleCopyLink = useCallback((pres: Presentation) => {
    if (!pres.publicSlug) return;
    const url = `${window.location.origin}/present/${pres.publicSlug}`;
    navigator.clipboard.writeText(url);
    setLinkCopiedId(pres.id);
    setTimeout(() => setLinkCopiedId(null), 2000);
  }, []);

  // Icon mode: minimal
  if (isIconMode) {
    return (
      <div className="flex-1 flex flex-col items-center p-2 gap-2">
        <button
          onClick={() => setIsCreating(true)}
          className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center transition-colors"
          title={t('presentation.new')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {presentations.map(pres => (
          <button
            key={pres.id}
            onClick={() => startPresentationMode(pres.id)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activePresentationId === pres.id
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={pres.name}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
          </button>
        ))}
      </div>
    );
  }

  // Create/Edit form
  const renderForm = () => (
    <div className={`space-y-3 ${isCompactMode ? 'p-2' : 'p-3'}`}>
      {/* Name */}
      <div>
        <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
          {t('presentation.name')}
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('presentation.enterName')}
          className={`w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}
          autoFocus
        />
      </div>

      {/* Scenario selection */}
      <div>
        <label className={`block font-medium text-gray-600 dark:text-gray-400 mb-1 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
          {t('presentation.scenarios')}
        </label>
        {scenarios.length === 0 ? (
          <p className={`text-gray-400 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>{t('presentation.noScenarios')}</p>
        ) : (
          <div className="space-y-1">
            {scenarios.map(sc => (
              <label
                key={sc.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  selectedScenarioIds.includes(sc.id)
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedScenarioIds.includes(sc.id)}
                  onChange={() => toggleScenario(sc.id)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: sc.color }}
                />
                <span className={`text-gray-700 dark:text-gray-300 truncate ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
                  {sc.name}
                </span>
                <span className={`text-gray-400 ml-auto ${isCompactMode ? 'text-[10px]' : 'text-[10px]'}`}>
                  {sc.steps.length} steps
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Autoplay */}
      {!isCompactMode && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('presentation.autoplay')}
          </label>
          <button
            onClick={() => setAutoplay(!autoplay)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              autoplay ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
              autoplay ? 'left-4' : 'left-0.5'
            }`} />
          </button>
        </div>
      )}

      {autoplay && !isCompactMode && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">{t('presentation.interval')}:</label>
          {([5000, 10000, 15000] as const).map(ms => (
            <button
              key={ms}
              onClick={() => setAutoplayInterval(ms)}
              className={`px-2 py-0.5 rounded text-[10px] ${
                autoplayInterval === ms
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}
            >
              {ms / 1000}s
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setIsCreating(false); setEditingId(null); setName(''); setSelectedScenarioIds([]); }}
          className={`flex-1 px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}
        >
          {t('presentation.cancel')}
        </button>
        <button
          onClick={editingId ? handleSaveEdit : handleCreate}
          disabled={!name.trim() || selectedScenarioIds.length === 0}
          className={`flex-1 px-2 py-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}
        >
          {editingId ? t('dialogs.save') : t('canvas.create')}
        </button>
      </div>
    </div>
  );

  // List view
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header with create button */}
      <div className={`flex items-center justify-between border-b border-gray-100 dark:border-gray-800 ${isCompactMode ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
        <h3 className={`font-medium text-gray-700 dark:text-gray-300 ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
          {t('presentation.title')}
        </h3>
        {!isCreating && !editingId && (
          <button
            onClick={() => setIsCreating(true)}
            className={`flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded px-1.5 py-0.5 transition-colors ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {!isCompactMode && t('presentation.new')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {(isCreating || editingId) ? renderForm() : (
          presentations.length === 0 ? (
            <div className={`flex-1 flex items-center justify-center text-gray-400 ${isCompactMode ? 'p-2' : 'p-4'}`}>
              <div className="text-center">
                <svg className={`mx-auto mb-2 text-emerald-300 dark:text-emerald-700 ${isCompactMode ? 'w-6 h-6' : 'w-10 h-10'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                {!isCompactMode && (
                  <>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{t('presentation.noPresentations')}</p>
                    <p className="text-xs text-gray-400">{t('presentation.createFirst')}</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={`space-y-1 ${isCompactMode ? 'p-1' : 'p-2'}`}>
              {presentations.map(pres => {
                const validScenarioCount = pres.scenarioIds.filter(id => scenarios.find(s => s.id === id)).length;
                return (
                  <div
                    key={pres.id}
                    className={`rounded-lg border transition-colors ${
                      activePresentationId === pres.id
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${isCompactMode ? 'p-1.5' : 'p-2'}`}
                    onClick={() => setActivePresentation(activePresentationId === pres.id ? null : pres.id)}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium text-gray-700 dark:text-gray-300 truncate ${isCompactMode ? 'text-[10px]' : 'text-xs'}`}>
                        {pres.name}
                      </span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {pres.isPublic && (
                          <span className={`px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ${isCompactMode ? 'text-[8px]' : 'text-[10px]'}`}>
                            {t('presentation.public')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Scenario count */}
                    <p className={`text-gray-400 mb-2 ${isCompactMode ? 'text-[10px]' : 'text-[10px]'}`}>
                      {t('presentation.scenarioCount').replace('{count}', String(validScenarioCount))}
                      {pres.settings.autoplay && ' · Auto'}
                    </p>

                    {/* Action buttons */}
                    <div className={`flex gap-1 ${isCompactMode ? 'flex-wrap' : ''}`} onClick={e => e.stopPropagation()}>
                      {/* Play */}
                      <button
                        onClick={() => startPresentationMode(pres.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-[10px]"
                        title={t('presentation.play')}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {!isCompactMode && t('presentation.play')}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(pres)}
                        className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* AI Notes */}
                      {!isCompactMode && (
                        <button
                          onClick={() => handleGenerateNotes(pres)}
                          disabled={generatingNotesId === pres.id}
                          className="p-1 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
                          title={t('presentation.generateNotes')}
                        >
                          {generatingNotesId === pres.id ? (
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                        </button>
                      )}

                      {/* Share */}
                      <button
                        onClick={() => pres.isPublic && pres.publicSlug ? handleCopyLink(pres) : handleShare(pres)}
                        className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title={linkCopiedId === pres.id ? t('presentation.linkCopied') : t('presentation.share')}
                      >
                        {linkCopiedId === pres.id ? (
                          <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(pres.id)}
                        className={`p-1 rounded transition-colors ${
                          confirmDeleteId === pres.id
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
                        }`}
                        title={confirmDeleteId === pres.id ? t('presentation.confirmDelete') : t('presentation.delete')}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
