'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { DataBackup } from '@/components/ui/DataBackup';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTranslation } from '@/i18n/context';

function toRoman(num: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romans[num - 1] || String(num);
}

export function Header() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const {
    isCanvasOpen,
    currentCanvasName,
    isDirty,
    lastNamedSaveAt,
    _hasHydrated,
    setRequestSaveDialog,
    closeCanvas,
    steps,
    isStepperActive,
    activeStepId,
    toggleStepper,
    setActiveStep,
    setEditingSteps,
    goToNextStep,
    goToPrevStep,
    editingStepId,
    setEditingStepId,
    createStep,
  } = useCanvasStore();

  // Check if we're on the import page with canvas open
  const showCanvasUI = pathname === '/import' && isCanvasOpen;

  // Stepper computed values
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const activeIndex = sorted.findIndex(s => s.id === activeStepId);
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= sorted.length - 1;
  const hasActive = isStepperActive && activeIndex >= 0;

  const progress = !hasActive
    ? 0
    : sorted.length === 1
      ? 100
      : (activeIndex / (sorted.length - 1)) * 100;

  // Keyboard: ArrowLeft / ArrowRight
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (editingStepId) return; // Disable during inline editing
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
    if (e.key === 'ArrowRight' && !isLast) { e.preventDefault(); goToNextStep(); }
    if (e.key === 'ArrowLeft' && !isFirst) { e.preventDefault(); goToPrevStep(); }
  }, [goToNextStep, goToPrevStep, isFirst, isLast, editingStepId]);

  useEffect(() => {
    if (!hasActive) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasActive, handleKeyDown]);

  const handleCreateAndEdit = useCallback(() => {
    const id = createStep();
    setEditingStepId(id);
  }, [createStep, setEditingStepId]);

  const handleStepClick = useCallback((stepId: string) => {
    if (editingStepId) return; // Disable during inline editing
    if (isStepperActive && activeStepId === stepId) {
      // Повторный клик по активному → редактирование нод на канвасе
      setEditingStepId(stepId);
      return;
    }
    if (!isStepperActive) toggleStepper(true);
    setActiveStep(stepId);
  }, [isStepperActive, toggleStepper, setActiveStep, editingStepId, activeStepId, setEditingStepId]);

  // Format time helper
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render save status
  const renderSaveStatus = () => {
    if (isDirty) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span>{t('header.unsaved')}</span>
        </div>
      );
    }

    if (lastNamedSaveAt) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{t('header.saved', { time: formatTime(lastNamedSaveAt) })}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <span>{t('header.notSaved')}</span>
      </div>
    );
  };

  const handleBack = () => {
    closeCanvas();
  };

  const handleSave = () => {
    setRequestSaveDialog(true);
  };

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-12 sticky top-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
              />
            </svg>
            <span className="font-semibold text-sm">ArchViz</span>
          </Link>

          {/* Canvas-specific UI */}
          {showCanvasUI && (
            <>
              {/* Back button */}
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-2 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('header.back')}
              </button>

              {/* Separator */}
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

              {/* Canvas name + status */}
              <div className="flex items-center gap-2">
                {currentCanvasName ? (
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentCanvasName}</span>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400 italic">{t('header.untitled')}</span>
                )}
                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                {renderSaveStatus()}
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors text-sm font-medium ${
                  isDirty
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {t('header.save')}
              </button>

              {/* Separator */}
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

              {/* Inline Stepper */}
              {steps.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  {/* Prev arrow */}
                  <button
                    onClick={goToPrevStep}
                    disabled={!hasActive || isFirst || !!editingStepId}
                    className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    title={t('header.previous')}
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Timeline with circles */}
                  <div className="relative flex items-center gap-2">
                    {/* Base line */}
                    <div className="absolute top-1/2 left-3 right-3 h-[2px] -translate-y-1/2 bg-gray-200 dark:bg-gray-600 rounded-full" />

                    {/* Progress line */}
                    <motion.div
                      className="absolute top-1/2 left-3 h-[2px] -translate-y-1/2 bg-blue-500 rounded-full origin-left"
                      style={{ right: '12px' }}
                      initial={false}
                      animate={{
                        scaleX: progress / 100,
                        opacity: hasActive ? 1 : 0,
                      }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    />

                    {/* Step circles */}
                    {sorted.map((step, index) => {
                      const isActive = hasActive && index === activeIndex;
                      const isPassed = hasActive && index < activeIndex;

                      return (
                        <motion.button
                          key={step.id}
                          onClick={() => handleStepClick(step.id)}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          className={`
                            relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center
                            transition-colors duration-300 outline-none flex-shrink-0
                            ${isActive
                              ? 'bg-blue-600 border-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900'
                              : isPassed
                                ? 'bg-blue-500 border-blue-500'
                                : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400'
                            }
                          `}
                          title={step.name}
                        >
                          {isPassed ? (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className={`text-[9px] font-bold select-none leading-none ${
                              isActive ? 'text-white' : 'text-gray-400 dark:text-gray-400'
                            }`}>
                              {toRoman(index + 1)}
                            </span>
                          )}

                          {/* Pulse ring on active circle */}
                          {isActive && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-[1.5px] border-blue-400"
                              initial={{ scale: 1, opacity: 0.6 }}
                              animate={{ scale: 1.6, opacity: 0 }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Next arrow */}
                  <button
                    onClick={goToNextStep}
                    disabled={!hasActive || isLast || !!editingStepId}
                    className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    title={t('header.next')}
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Step counter */}
                  {hasActive && (
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums ml-0.5">
                      {activeIndex + 1}/{sorted.length}
                    </span>
                  )}

                  {/* Edit steps */}
                  <button
                    onClick={() => setEditingSteps(true)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title={t('header.editSteps')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Deactivate stepper */}
                  {hasActive && (
                    <button
                      onClick={() => toggleStepper(false)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title={t('header.resetStepper')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                /* Empty state: dashed circle on a line */
                <div className="flex items-center gap-1.5">
                  <div className="relative flex items-center">
                    <div className="w-8 h-[2px] bg-gray-200 dark:bg-gray-600 rounded-full" />
                    <motion.button
                      onClick={handleCreateAndEdit}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      className="relative z-10 w-6 h-6 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-500 hover:border-blue-400 flex items-center justify-center transition-colors outline-none bg-white dark:bg-gray-800"
                      title={t('header.createSteps')}
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </motion.button>
                    <div className="w-8 h-[2px] bg-gray-200 dark:bg-gray-600 rounded-full" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right side */}
        <nav className="flex items-center gap-4 text-sm">
          <DataBackup />
          <Link href="/projects" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            {t('header.projects')}
          </Link>
          <Link href="/import" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
            {t('header.import')}
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
