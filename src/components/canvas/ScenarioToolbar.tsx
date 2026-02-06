'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

const SCENARIO_COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export function ScenarioToolbar() {
  const { t } = useTranslation();
  const {
    activeScenarioId,
    scenarios,
    steps,
    activeStepId,
    updateScenario,
    setEditingStepId,
    setActiveScenario,
  } = useCanvasStore();

  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const scenario = scenarios.find(s => s.id === activeScenarioId);

  // Close color picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColors(false);
      }
    };
    if (showColors) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showColors]);

  if (!scenario || !activeScenarioId) return null;

  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const currentIndex = activeStepId ? sorted.findIndex(s => s.id === activeStepId) + 1 : 0;
  const total = sorted.length;

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20"
    >
      <div className="flex items-center gap-2.5 px-3 py-2 bg-white/90 dark:bg-[#1a1a2e]/90 backdrop-blur-xl rounded-xl shadow-lg shadow-black/10 dark:shadow-black/30 border border-gray-200/60 dark:border-white/[0.08]">
        {/* Color indicator */}
        <div ref={colorRef} className="relative flex-shrink-0">
          <button
            onClick={() => setShowColors(!showColors)}
            className="w-5 h-5 rounded-full border-2 border-white/20 transition-transform hover:scale-110"
            style={{ backgroundColor: scenario.color }}
          />
          {showColors && (
            <div className="absolute top-full left-0 mt-1.5 flex items-center gap-1 p-1.5 bg-white/90 dark:bg-[#1a1a2e]/95 backdrop-blur-xl rounded-lg border border-gray-200/60 dark:border-white/[0.08] shadow-lg">
              {SCENARIO_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => {
                    updateScenario(activeScenarioId, { color });
                    setShowColors(false);
                  }}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: color === scenario.color ? 'white' : 'transparent',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200 dark:bg-white/[0.08]" />

        {/* Scenario name input */}
        <input
          type="text"
          value={scenario.name}
          onChange={(e) => updateScenario(activeScenarioId, { name: e.target.value })}
          className="w-36 px-2 py-1 text-xs bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          placeholder={t('scenario.scenarioName')}
        />

        {/* Step counter */}
        {total > 0 && (
          <>
            <div className="w-px h-5 bg-gray-200 dark:bg-white/[0.08]" />
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">
              {t('scenario.stepOf', { current: String(currentIndex), total: String(total) })}
            </span>
          </>
        )}

        <div className="w-px h-5 bg-gray-200 dark:bg-white/[0.08]" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {activeStepId && (
            <button
              onClick={() => setEditingStepId(activeStepId)}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
            >
              {t('scenario.editNodes')}
            </button>
          )}
          <button
            onClick={() => setActiveScenario(null)}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            {t('scenario.back')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
