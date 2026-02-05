'use client';

import { useCallback, useState, useRef } from 'react';
import {
  convertFolderToCanvas,
  processFileList,
  type FolderCanvasData,
} from '@/lib/converters/folderToCanvas';
import type { AppNode, AppEdge } from '@/types/canvas';
import { useTranslation } from '@/i18n/context';

interface FolderDropzoneProps {
  onImport: (data: {
    nodes: AppNode[];
    edges: AppEdge[];
    viewport: { x: number; y: number; zoom: number };
    files?: Map<string, any>;
  }) => void;
}

export function FolderDropzone({ onImport }: FolderDropzoneProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: { name: string; content: string }[]) => {
      if (files.length === 0) {
        setError(t('folderDropzone.noMarkdown'));
        return;
      }

      setFileCount(files.length);
      const canvasData = convertFolderToCanvas(files);

      if (canvasData.nodes.length === 0) {
        setError(t('folderDropzone.noValid'));
        return;
      }

      onImport({
        nodes: canvasData.nodes,
        edges: canvasData.edges,
        viewport: canvasData.viewport,
        files: canvasData.files,
      });
    },
    [onImport]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      setError(null);
      setIsProcessing(true);

      try {
        const items = e.dataTransfer.items;
        const files: { name: string; content: string }[] = [];

        // Process dropped items
        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry?.();

            if (entry?.isDirectory) {
              // Process directory
              const dirFiles = await processDirectory(
                entry as FileSystemDirectoryEntry
              );
              files.push(...dirFiles);
            } else if (entry?.isFile && entry.name.endsWith('.md')) {
              // Single file
              const file = item.getAsFile();
              if (file) {
                const content = await file.text();
                files.push({ name: file.name, content });
              }
            }
          }
        }

        await processFiles(files);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process files');
      } finally {
        setIsProcessing(false);
      }
    },
    [processFiles]
  );

  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      setError(null);
      setIsProcessing(true);

      try {
        const files = await processFileList(fileList);
        await processFiles(files);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process files');
      } finally {
        setIsProcessing(false);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => folderInputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragActive
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 scale-[1.02]'
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20'
        }
        ${isProcessing ? 'opacity-50 cursor-wait' : ''}
      `}
    >
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in types
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderSelect}
        className="hidden"
        accept=".md"
      />

      <div className="flex items-center justify-center mb-4">
        <svg
          className={`w-12 h-12 transition-colors ${
            isDragActive ? 'text-purple-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </div>

      {isProcessing ? (
        <div>
          <p className="text-purple-600 font-medium">{t('folderDropzone.processing')}</p>
          {fileCount > 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {t('folderDropzone.found', { count: fileCount })}
            </p>
          )}
        </div>
      ) : isDragActive ? (
        <p className="text-purple-600 font-medium">
          {t('folderDropzone.dropHere')}
        </p>
      ) : (
        <>
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
            {t('folderDropzone.dragDrop')}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('folderDropzone.orClick')}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-3">
            {t('folderDropzone.wikilinks')}
          </p>
        </>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

// Helper to process directory entries recursively
async function processDirectory(
  entry: FileSystemDirectoryEntry
): Promise<{ name: string; content: string }[]> {
  const files: { name: string; content: string }[] = [];

  const readEntries = (
    dirReader: FileSystemDirectoryReader
  ): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
  };

  const readFile = (fileEntry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  };

  const processEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile && entry.name.endsWith('.md')) {
      const file = await readFile(entry as FileSystemFileEntry);
      const content = await file.text();
      files.push({ name: file.name, content });
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      let entries = await readEntries(dirReader);

      // readEntries may not return all entries at once
      while (entries.length > 0) {
        for (const e of entries) {
          await processEntry(e);
        }
        entries = await readEntries(dirReader);
      }
    }
  };

  const dirReader = entry.createReader();
  let entries = await readEntries(dirReader);

  while (entries.length > 0) {
    for (const e of entries) {
      await processEntry(e);
    }
    entries = await readEntries(dirReader);
  }

  return files;
}
