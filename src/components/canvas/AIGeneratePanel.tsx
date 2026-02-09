'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/context';
import type { AppNode, AppEdge } from '@/types/canvas';

interface AIGeneratePanelProps {
  onImport: (data: { nodes: AppNode[]; edges: AppEdge[]; viewport: { x: number; y: number; zoom: number } }) => void;
}

const EXAMPLE_PROMPTS_EN = [
  'Microservice e-commerce',
  'Monolith with PostgreSQL',
  'Serverless AWS',
  'SaaS with Stripe',
];

const EXAMPLE_PROMPTS_RU = [
  'Микросервисный e-commerce',
  'Монолит с PostgreSQL',
  'Serverless AWS',
  'SaaS с оплатой Stripe',
];

export function AIGeneratePanel({ onImport }: AIGeneratePanelProps) {
  const { t, locale } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examples = locale === 'ru' ? EXAMPLE_PROMPTS_RU : EXAMPLE_PROMPTS_EN;

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), locale }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate');
      }

      onImport({
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport,
      });
    } catch (err: any) {
      setError(err.message || t('ai.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6">
        {/* Textarea */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('ai.placeholder')}
          rows={4}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleGenerate();
            }
          }}
        />

        {/* Example chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {examples.map((example) => (
            <button
              key={example}
              onClick={() => setPrompt(example)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-full transition-colors disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isLoading}
          className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('ai.generating')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('ai.generate')}
            </>
          )}
        </button>

        <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 text-center">
          Ctrl+Enter {t('ai.toGenerate')}
        </p>
      </div>
    </div>
  );
}
