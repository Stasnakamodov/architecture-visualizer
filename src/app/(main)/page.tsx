'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n/context';

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {t('home.heroTitle')}
          <span className="text-blue-600"> {t('home.heroTitleAccent')}</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          {t('home.heroDescription')}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/import"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
          >
            {t('home.importCanvas')}
          </Link>
          <Link
            href="/projects"
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-lg"
          >
            {t('home.viewProjects')}
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('home.featureImportTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t('home.featureImportDesc')}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('home.featureDualTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t('home.featureDualDesc')}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('home.featureCanvasTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {t('home.featureCanvasDesc')}
          </p>
        </div>
      </div>

      {/* Node Types Preview */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          {t('home.smartDetection')}
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-medium text-sm">{t('home.technical')}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('home.technicalDesc')}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-purple-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
              <span className="font-medium text-sm">{t('home.database')}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('home.databaseDesc')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950 dark:to-gray-900 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-800">
            <div className="font-semibold text-sm text-indigo-900 dark:text-indigo-200 mb-2">
              {t('home.business')}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('home.businessDesc')}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="font-medium text-sm">{t('home.group')}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('home.groupDesc')}</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {t('home.ctaTitle')}
        </h2>
        <Link
          href="/import"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {t('home.ctaButton')}
        </Link>
      </div>
    </div>
  );
}
