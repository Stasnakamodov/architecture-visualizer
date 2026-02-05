'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  convertJSONCanvasToReactFlow,
  parseJSONCanvas,
} from '@/lib/converters/jsonCanvasToReactFlow';
import type { AppNode, AppEdge } from '@/types/canvas';

interface CanvasDropzoneProps {
  onImport: (data: {
    nodes: AppNode[];
    edges: AppEdge[];
    viewport: { x: number; y: number; zoom: number };
  }) => void;
}

export function CanvasDropzone({ onImport }: CanvasDropzoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);
      const file = acceptedFiles[0];
      if (!file) return;

      setIsProcessing(true);

      try {
        const text = await file.text();
        const canvas = parseJSONCanvas(text);
        const reactFlowData = convertJSONCanvasToReactFlow(canvas);
        onImport(reactFlowData);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to parse canvas file'
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [onImport]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.canvas', '.json'],
    },
    maxFiles: 1,
    disabled: isProcessing,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
        ${isProcessing ? 'opacity-50 cursor-wait' : ''}
      `}
    >
      <input {...getInputProps()} />

      <svg
        className={`w-12 h-12 mx-auto mb-4 transition-colors ${
          isDragActive ? 'text-blue-500' : 'text-gray-400'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>

      {isProcessing ? (
        <p className="text-gray-600">Processing...</p>
      ) : isDragActive ? (
        <p className="text-blue-600 font-medium">Drop the .canvas file here</p>
      ) : (
        <>
          <p className="text-gray-600 mb-1">
            Drag & drop a <code className="text-blue-600">.canvas</code> file
          </p>
          <p className="text-gray-400 text-sm">or click to select</p>
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
