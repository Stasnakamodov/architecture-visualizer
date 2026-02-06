'use client';

import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

function toRoman(num: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romans[num - 1] || String(num);
}

export function StepperBar() {
  const { t } = useTranslation();
  const {
    steps,
    activeStepId,
    isStepperActive,
    setActiveStep,
    goToNextStep,
    goToPrevStep,
    toggleStepper,
    setEditingSteps,
    editingStepId,
    setEditingStepId,
    createStep,
    activeScenarioId,
    scenarios,
    setActiveScenario,
  } = useCanvasStore();

  const activeScenario = activeScenarioId ? scenarios.find(s => s.id === activeScenarioId) : null;
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const activeIndex = sorted.findIndex(s => s.id === activeStepId);
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= sorted.length - 1;
  const hasActive = isStepperActive && activeIndex >= 0;

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

  // Клик по кружку — если уже активный → инлайн-редактирование, иначе навигация
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

  // Создать шаг и сразу в инлайн-редактирование
  const handleCreateAndEdit = useCallback(() => {
    const id = createStep();
    setEditingStepId(id);
  }, [createStep, setEditingStepId]);

  // Сброс — деактивируем степпер (кружки станут серыми)
  const handleDeactivate = useCallback(() => {
    toggleStepper(false);
  }, [toggleStepper]);

  // Пустое состояние
  if (steps.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-6 py-2 z-40">
        <div className="flex items-center justify-center gap-3">
          {activeScenario && (
            <button
              onClick={() => setActiveScenario(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-white flex-shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: activeScenario.color }}
              title={t('fileTree.backToBase')}
            >
              <span className="truncate max-w-[100px]">{activeScenario.name}</span>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <span className="text-xs text-gray-400">{t('stepper.noSteps')}</span>
          <button
            onClick={handleCreateAndEdit}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('stepper.createFirst')}
          </button>
        </div>
      </div>
    );
  }

  // Прогресс: 0% когда ничего не выбрано, иначе от 0 до 100%
  const progress = !hasActive
    ? 0
    : sorted.length === 1
      ? 100
      : (activeIndex / (sorted.length - 1)) * 100;

  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 px-6 pt-4 pb-5 z-40">
      <div className="flex items-start gap-4">

        {/* Стрелка назад */}
        <button
          onClick={goToPrevStep}
          disabled={!hasActive || isFirst || !!editingStepId}
          className="mt-1 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
          title={t('stepper.previous')}
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Timeline */}
        <div className="flex-1 relative min-w-0">

          {/* Линия — серая база */}
          <div className="absolute top-[18px] left-[20px] right-[20px] h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full" />

          {/* Линия — синий прогресс */}
          <motion.div
            className="absolute top-[18px] left-[20px] h-[3px] bg-blue-500 rounded-full origin-left"
            style={{ right: '20px' }}
            initial={false}
            animate={{
              scaleX: progress / 100,
              opacity: hasActive ? 1 : 0,
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />

          {/* Кружки */}
          <div className="relative flex justify-between">
            {sorted.map((step, index) => {
              const isActive = hasActive && index === activeIndex;
              const isPassed = hasActive && index < activeIndex;
              const isBeingEdited = editingStepId === step.id;

              return (
                <motion.div
                  key={step.id}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3 }}
                >
                  {/* Кружок */}
                  <motion.button
                    onClick={() => handleStepClick(step.id)}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
                      relative z-10 w-9 h-9 rounded-full border-[3px] flex items-center justify-center
                      transition-colors duration-300 outline-none
                      ${isBeingEdited
                        ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200 dark:shadow-blue-900 ring-2 ring-blue-300 ring-offset-2 dark:ring-offset-gray-900'
                        : isActive
                          ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200 dark:shadow-blue-900'
                          : isPassed
                            ? 'bg-blue-500 border-blue-500 shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-500 hover:border-gray-400'
                      }
                    `}
                  >
                    {isPassed && !isBeingEdited ? (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-bold select-none ${
                        isActive || isBeingEdited ? 'text-white' : 'text-gray-400'
                      }`}>
                        {toRoman(index + 1)}
                      </span>
                    )}

                    {/* Пульс на активном кружке */}
                    {isActive && !editingStepId && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-blue-400"
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                  </motion.button>

                  {/* Подпись */}
                  <span className={`mt-1.5 text-[10px] font-medium uppercase tracking-wide truncate max-w-[72px] text-center leading-tight ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : isPassed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                </motion.div>
              );
            })}

            {/* Пунктирный «+» кружок в конце таймлайна */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sorted.length * 0.04, duration: 0.3 }}
            >
              <motion.button
                onClick={handleCreateAndEdit}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.95 }}
                className="relative z-10 w-9 h-9 rounded-full border-[3px] border-dashed border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800 flex items-center justify-center transition-colors duration-300 outline-none"
              >
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </motion.button>
              <span className="mt-1.5 text-[10px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wide">
                {toRoman(sorted.length + 1)}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Стрелка вперёд */}
        <button
          onClick={goToNextStep}
          disabled={!hasActive || isLast || !!editingStepId}
          className="mt-1 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
          title={t('stepper.next')}
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Active scenario badge */}
        {activeScenario && (
          <>
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
            <button
              onClick={() => setActiveScenario(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-white mt-0.5 flex-shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: activeScenario.color }}
              title={t('fileTree.backToBase')}
            >
              <span className="truncate max-w-[100px]">{activeScenario.name}</span>
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}

        {/* Разделитель */}
        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />

        {/* Инфо / кнопки */}
        <div className="flex items-center gap-1 mt-0.5 flex-shrink-0">
          {hasActive && (
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums mr-1">
              {activeIndex + 1}/{sorted.length}
            </span>
          )}

          {/* Управление шагами (модалка) */}
          <button
            onClick={() => setEditingSteps(true)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={t('stepper.editSteps')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Сбросить (показывать только когда активен) */}
          {hasActive && (
            <button
              onClick={handleDeactivate}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('stepper.resetStepper')}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
