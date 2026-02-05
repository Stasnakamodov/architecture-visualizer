'use client';

import { useRef, useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useTranslation } from '@/i18n/context';

export function DataBackup() {
  const { exportData, importData, _hasHydrated } = useCanvasStore();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!_hasHydrated) return null;

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archviz-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);

    try {
      const text = await file.text();
      const result = importData(text);

      if (result.success) {
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } else {
        setImportError(result.error || 'Import failed');
      }
    } catch {
      setImportError('Failed to read file');
    }

    // Reset input
    e.target.value = '';
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title={t('dataBackup.title')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg dark:shadow-gray-950 border border-gray-200 dark:border-gray-700 py-1 z-50">
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('dataBackup.export')}
            </button>
            <button
              onClick={handleImportClick}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {t('dataBackup.import')}
            </button>
          </div>
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Import status messages */}
      {importError && (
        <div className="absolute right-0 top-full mt-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 z-50">
          {importError}
        </div>
      )}
      {importSuccess && (
        <div className="absolute right-0 top-full mt-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-600 z-50">
          {t('dataBackup.success')}
        </div>
      )}
    </div>
  );
}
