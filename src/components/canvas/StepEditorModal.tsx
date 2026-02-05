'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

export function StepEditorModal() {
  const {
    steps,
    nodes,
    viewport,
    isEditingSteps,
    setEditingSteps,
    createStep,
    updateStep,
    deleteStep,
    reorderSteps,
    saveStepViewport,
    toggleStepper,
    setActiveStep,
  } = useCanvasStore();

  const { t } = useTranslation();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Reset selectedStepId when modal opens or steps change
  useEffect(() => {
    if (isEditingSteps) {
      const sorted = [...steps].sort((a, b) => a.order - b.order);
      setSelectedStepId(sorted[0]?.id || null);
    }
  }, [isEditingSteps]); // Only on modal open

  const sorted = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);
  const selectedStep = sorted.find(s => s.id === selectedStepId) || null;

  const handleAddStep = () => {
    const id = createStep();
    setSelectedStepId(id);
  };

  const handleDeleteStep = (id: string) => {
    deleteStep(id);
    const remaining = sorted.filter(s => s.id !== id);
    setSelectedStepId(remaining[0]?.id || null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newSteps = [...sorted];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    reorderSteps(newSteps);
  };

  const handleMoveDown = (index: number) => {
    if (index >= sorted.length - 1) return;
    const newSteps = [...sorted];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    reorderSteps(newSteps);
  };

  const handleToggleNode = (nodeId: string) => {
    if (!selectedStep) return;
    const newNodeIds = selectedStep.nodeIds.includes(nodeId)
      ? selectedStep.nodeIds.filter(id => id !== nodeId)
      : [...selectedStep.nodeIds, nodeId];
    updateStep(selectedStep.id, { nodeIds: newNodeIds });
  };

  const handleSelectAll = () => {
    if (!selectedStep) return;
    updateStep(selectedStep.id, { nodeIds: nodes.map(n => n.id) });
  };

  const handleDeselectAll = () => {
    if (!selectedStep) return;
    updateStep(selectedStep.id, { nodeIds: [] });
  };

  const handleSaveViewport = () => {
    if (!selectedStep) return;
    saveStepViewport(selectedStep.id, {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
    });
  };

  const handleClose = () => {
    setEditingSteps(false);
    // Auto-activate stepper if steps exist
    if (steps.length > 0) {
      toggleStepper(true);
      setActiveStep(sorted[0]?.id || null);
    }
  };

  if (!isEditingSteps) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('stepEditor.title')}</h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Step list */}
            <div className="w-56 border-r border-gray-100 dark:border-gray-800 flex flex-col">
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {sorted.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-1.5 p-2 rounded-lg cursor-pointer transition-colors group ${
                      step.id === selectedStepId
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => setSelectedStepId(step.id)}
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                        disabled={index === 0}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                        disabled={index === sorted.length - 1}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <span className="text-xs font-medium w-5 text-center flex-shrink-0">{index + 1}</span>
                    <span className="text-sm truncate flex-1">{step.name}</span>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {sorted.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{t('stepEditor.noSteps')}</p>
                )}
              </div>

              {/* Add step button */}
              <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleAddStep}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('stepEditor.addStep')}
                </button>
              </div>
            </div>

            {/* Right: Step editor */}
            <div className="flex-1 overflow-y-auto p-5">
              {selectedStep ? (
                <div className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('stepEditor.name')}</label>
                    <input
                      type="text"
                      value={selectedStep.name}
                      onChange={(e) => updateStep(selectedStep.id, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder={t('stepEditor.stepName')}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('stepEditor.description')}</label>
                    <textarea
                      value={selectedStep.description}
                      onChange={(e) => updateStep(selectedStep.id, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      rows={2}
                      placeholder={t('stepEditor.optionalDesc')}
                    />
                  </div>

                  {/* Mode toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('stepEditor.mode')}</label>
                    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                      <button
                        onClick={() => updateStep(selectedStep.id, { mode: 'independent' })}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          selectedStep.mode === 'independent'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {t('stepEditor.independent')}
                      </button>
                      <button
                        onClick={() => updateStep(selectedStep.id, { mode: 'cumulative' })}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          selectedStep.mode === 'cumulative'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {t('stepEditor.cumulative')}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {selectedStep.mode === 'independent'
                        ? t('stepEditor.independentHint')
                        : t('stepEditor.cumulativeHint')}
                    </p>
                  </div>

                  {/* Save viewport */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('stepEditor.viewport')}</label>
                    <button
                      onClick={handleSaveViewport}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {t('stepEditor.saveViewport')}
                    </button>
                    {selectedStep.viewport && (
                      <p className="text-xs text-green-600 mt-1">
                        {t('stepEditor.viewportSaved', { zoom: selectedStep.viewport.zoom.toFixed(2) })}
                      </p>
                    )}
                  </div>

                  {/* Node selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('stepEditor.nodesCount', { selected: selectedStep.nodeIds.length, total: nodes.length })}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSelectAll}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {t('stepEditor.selectAll')}
                        </button>
                        <button
                          onClick={handleDeselectAll}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          {t('stepEditor.deselectAll')}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                      {nodes.map((node) => {
                        const isSelected = selectedStep.nodeIds.includes(node.id);
                        return (
                          <label
                            key={node.id}
                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${
                              isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleNode(node.id)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              node.type === 'tech' ? 'bg-blue-500' :
                              node.type === 'database' ? 'bg-purple-500' :
                              node.type === 'business' ? 'bg-indigo-500' :
                              node.type === 'group' ? 'bg-gray-500' :
                              node.type === 'comment' ? 'bg-amber-500' :
                              node.type === 'shape' ? 'bg-cyan-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {node.data?.label || node.id}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">{node.type}</span>
                          </label>
                        );
                      })}
                      {nodes.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{t('stepEditor.noNodes')}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                  {t('stepEditor.selectOrCreate')}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium text-sm"
            >
              {t('stepEditor.done')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
