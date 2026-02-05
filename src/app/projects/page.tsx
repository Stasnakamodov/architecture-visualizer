'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAllCanvases, deleteCanvas, type SavedCanvas } from '@/lib/storage/localStorage';

// Format date
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Clean label - remove numeric prefix like "0 ", "1 ", "01 " etc.
function cleanLabel(label: string): string {
  return label.replace(/^\d+\s+/, '').trim();
}

// Get node type distribution
function getTypeDistribution(canvas: SavedCanvas): { type: string; count: number; color: string }[] {
  const stats: Record<string, number> = {};

  canvas.nodes.forEach((node) => {
    const type = node.type || 'default';
    if (type !== 'group') { // Skip group containers
      stats[type] = (stats[type] || 0) + 1;
    }
  });

  const typeColors: Record<string, string> = {
    tech: '#3b82f6',
    database: '#8b5cf6',
    business: '#6366f1',
    comment: '#f59e0b',
    shape: '#06b6d4',
    default: '#9ca3af',
  };

  return Object.entries(stats)
    .map(([type, count]) => ({
      type,
      count,
      color: typeColors[type] || typeColors.default,
    }))
    .sort((a, b) => b.count - a.count);
}

// Get hub nodes (most connected)
function getHubNodes(canvas: SavedCanvas, limit = 3): { label: string; connections: number; type: string }[] {
  if (canvas.edges.length === 0) return [];

  // Count connections per node
  const connectionCount: Record<string, number> = {};
  canvas.edges.forEach(edge => {
    connectionCount[edge.source] = (connectionCount[edge.source] || 0) + 1;
    connectionCount[edge.target] = (connectionCount[edge.target] || 0) + 1;
  });

  // Create node map for quick lookup
  const nodeMap = new Map(canvas.nodes.map(n => [n.id, n]));

  // Get nodes with connections, sorted by connection count
  return Object.entries(connectionCount)
    .map(([nodeId, count]) => {
      const node = nodeMap.get(nodeId);
      if (!node || node.type === 'group') return null;
      const rawLabel = String(node.data?.label || '').trim();
      if (!rawLabel) return null;
      const label = cleanLabel(rawLabel);
      if (!label) return null;
      return {
        label: label.length > 18 ? label.slice(0, 18) + '…' : label,
        connections: count,
        type: node.type || 'default',
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null && n.connections > 0)
    .sort((a, b) => b.connections - a.connections)
    .slice(0, limit);
}

// Node colors by type
const nodeColors: Record<string, { bg: string; border: string }> = {
  tech: { bg: '#3b82f6', border: '#2563eb' },
  database: { bg: '#8b5cf6', border: '#7c3aed' },
  business: { bg: '#6366f1', border: '#4f46e5' },
  group: { bg: '#f3f4f6', border: '#d1d5db' },
  comment: { bg: '#fbbf24', border: '#f59e0b' },
  shape: { bg: '#06b6d4', border: '#0891b2' },
  default: { bg: '#9ca3af', border: '#6b7280' },
};

// Canvas Preview Component
function CanvasPreview({ canvas }: { canvas: SavedCanvas }) {
  const previewData = useMemo(() => {
    if (canvas.nodes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    canvas.nodes.forEach(node => {
      const x = node.position.x;
      const y = node.position.y;
      const width = (node.measured?.width || node.style?.width as number) || 150;
      const height = (node.measured?.height || node.style?.height as number) || 60;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    const padding = 40;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const canvasWidth = maxX - minX;
    const canvasHeight = maxY - minY;
    const previewWidth = 280;
    const previewHeight = 140;

    const scaleX = previewWidth / canvasWidth;
    const scaleY = previewHeight / canvasHeight;
    const scale = Math.min(scaleX, scaleY, 0.15);

    const transformedNodes = canvas.nodes
      .filter(node => node.type !== 'group')
      .slice(0, 20)
      .map(node => {
        const x = (node.position.x - minX) * scale;
        const y = (node.position.y - minY) * scale;
        const width = Math.max(((node.measured?.width || node.style?.width as number) || 150) * scale, 8);
        const height = Math.max(((node.measured?.height || node.style?.height as number) || 60) * scale, 5);
        const colors = nodeColors[node.type || 'default'] || nodeColors.default;

        return { id: node.id, x, y, width, height, type: node.type, ...colors };
      });

    const nodeMap = new Map(canvas.nodes.map(n => [n.id, n]));
    const transformedEdges = canvas.edges.slice(0, 30).map(edge => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      if (!sourceNode || !targetNode) return null;

      const sourceWidth = (sourceNode.measured?.width || sourceNode.style?.width as number) || 150;
      const sourceHeight = (sourceNode.measured?.height || sourceNode.style?.height as number) || 60;
      const targetWidth = (targetNode.measured?.width || targetNode.style?.width as number) || 150;
      const targetHeight = (targetNode.measured?.height || targetNode.style?.height as number) || 60;

      return {
        id: edge.id,
        x1: (sourceNode.position.x + sourceWidth / 2 - minX) * scale,
        y1: (sourceNode.position.y + sourceHeight / 2 - minY) * scale,
        x2: (targetNode.position.x + targetWidth / 2 - minX) * scale,
        y2: (targetNode.position.y + targetHeight / 2 - minY) * scale,
      };
    }).filter(Boolean);

    const contentWidth = (maxX - minX) * scale;
    const contentHeight = (maxY - minY) * scale;
    const offsetX = (previewWidth - contentWidth) / 2;
    const offsetY = (previewHeight - contentHeight) / 2;

    return { nodes: transformedNodes, edges: transformedEdges, offsetX, offsetY, previewWidth, previewHeight };
  }, [canvas]);

  if (!previewData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-400 text-sm">Empty canvas</div>
      </div>
    );
  }

  return (
    <svg
      width={previewData.previewWidth}
      height={previewData.previewHeight}
      className="w-full h-full"
      viewBox={`0 0 ${previewData.previewWidth} ${previewData.previewHeight}`}
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <g transform={`translate(${previewData.offsetX}, ${previewData.offsetY})`}>
        {previewData.edges.map((edge: any) => (
          <line
            key={edge.id}
            x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
            stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.6"
          />
        ))}
        {previewData.nodes.map((node: any) => (
          <rect
            key={node.id}
            x={node.x} y={node.y}
            width={node.width} height={node.height}
            rx={2} fill={node.bg}
          />
        ))}
      </g>
    </svg>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<SavedCanvas[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setCanvases(getAllCanvases());
    setIsLoading(false);
  }, []);

  const handleDelete = (id: string) => {
    if (deleteCanvas(id)) {
      setCanvases(getAllCanvases());
      setDeleteConfirm(null);
    }
  };

  const handleOpen = (canvas: SavedCanvas) => {
    sessionStorage.setItem('open-canvas-id', canvas.id);
    router.push('/import');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-96 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
          <p className="text-gray-600">
            {canvases.length > 0
              ? `${canvases.length} saved project${canvases.length !== 1 ? 's' : ''}`
              : 'Your saved architecture diagrams'}
          </p>
        </div>
        <Link
          href="/import"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Link>
      </div>

      {canvases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {canvases.map((canvas) => {
            const typeDistribution = getTypeDistribution(canvas);
            const hubNodes = getHubNodes(canvas, 3);
            const totalNodes = canvas.nodes.filter(n => n.type !== 'group').length;

            return (
              <div
                key={canvas.id}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-100"
              >
                {/* Preview */}
                <div
                  className="h-36 relative cursor-pointer overflow-hidden bg-gradient-to-br from-slate-50 to-gray-100"
                  onClick={() => handleOpen(canvas)}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <CanvasPreview canvas={canvas} />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-2.5 shadow-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Title */}
                  <h3
                    className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors mb-2 truncate"
                    onClick={() => handleOpen(canvas)}
                  >
                    {canvas.name}
                  </h3>

                  {/* Quick stats with type breakdown */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-500">{totalNodes} nodes</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-sm text-gray-500">{canvas.edges.length} links</span>

                    {/* Type distribution mini-bar */}
                    {typeDistribution.length > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <div className="flex gap-0.5">
                          {typeDistribution.slice(0, 4).map((t, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: t.color }}
                              title={`${t.type}: ${t.count}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Hub nodes (most connected) */}
                  {hubNodes.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-400 mb-1.5">Key components</div>
                      <div className="flex flex-wrap gap-1.5">
                        {hubNodes.map((node, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded-md"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: nodeColors[node.type]?.bg || '#9ca3af' }}
                            />
                            {node.label}
                            <span className="text-gray-400 text-[10px]">({node.connections})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {formatDate(canvas.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpen(canvas)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Open"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(canvas.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === canvas.id && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 rounded-2xl">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-700 mb-4 text-center">
                      Delete "<span className="font-medium">{canvas.name}</span>"?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(canvas.id)}
                        className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-500 mb-6">Import your first architecture diagram</p>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Import Canvas
          </Link>
        </div>
      )}
    </div>
  );
}
