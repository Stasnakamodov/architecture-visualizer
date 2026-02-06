'use client';

import { memo, useMemo } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { LineStyle } from '@/types/canvas';
import {
  calculatePresentationEdgePath,
  shouldUsePresentationRouting,
} from '@/lib/layout';
import { useCanvasStore } from '@/stores/canvasStore';

export type EdgeType = 'default' | 'arrow' | 'bidirectional' | 'none';

interface CustomEdgeData {
  label?: string;
  edgeType?: EdgeType;
  lineStyle?: LineStyle;
  sourceColor?: string;
  targetColor?: string;
  showGradient?: boolean;
}

// Get strokeDasharray based on line style
const getStrokeDasharray = (lineStyle?: LineStyle): string | undefined => {
  switch (lineStyle) {
    case 'dashed':
      return '8 4';
    case 'dotted':
      return '2 4';
    default:
      return undefined; // solid
  }
};

// Default gray color for inactive edges
const INACTIVE_COLOR = '#94a3b8';

export const CustomEdge = memo(
  ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  }: EdgeProps) => {
    // Read node colors directly from store (bypasses React Flow data passing)
    const srcNodeColor = useCanvasStore(
      (state) => (state.nodes.find((n) => n.id === source)?.data as Record<string, unknown>)?.color as string | undefined
    );
    const tgtNodeColor = useCanvasStore(
      (state) => (state.nodes.find((n) => n.id === target)?.data as Record<string, unknown>)?.color as string | undefined
    );

    // Calculate edge path - use presentation routing if active
    const { edgePath, labelX, labelY } = useMemo(() => {
      if (shouldUsePresentationRouting()) {
        const result = calculatePresentationEdgePath(
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition
        );
        return {
          edgePath: result.path,
          labelX: result.labelX,
          labelY: result.labelY,
        };
      }

      // Default bezier path
      const [path, lx, ly] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      return { edgePath: path, labelX: lx, labelY: ly };
    }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

    const edgeData = data as CustomEdgeData | undefined;
    const edgeType = edgeData?.edgeType || 'arrow';
    const lineStyle = edgeData?.lineStyle;
    const label = edgeData?.label;

    // Determine colors: node data.color takes priority, then data prop fallback
    const hasNodeColors = !!srcNodeColor || !!tgtNodeColor;

    let sourceColor: string;
    let targetColor: string;
    if (srcNodeColor && tgtNodeColor) {
      sourceColor = srcNodeColor;
      targetColor = tgtNodeColor;
    } else if (srcNodeColor) {
      sourceColor = srcNodeColor;
      targetColor = srcNodeColor;
    } else if (tgtNodeColor) {
      sourceColor = tgtNodeColor;
      targetColor = tgtNodeColor;
    } else {
      sourceColor = edgeData?.sourceColor || '#6366f1';
      targetColor = edgeData?.targetColor || '#6366f1';
    }

    // showGradient: true when nodes have colors, or from data prop (selection/group)
    const showGradient = hasNodeColors || (edgeData?.showGradient || false);

    // SVG-safe ID for defs references (edge IDs may contain spaces, Cyrillic, emoji, ">")
    const safeId = useMemo(
      () => Array.from(id).map(c => /[a-zA-Z0-9_-]/.test(c) ? c : (c.codePointAt(0) || 0).toString(16)).join(''),
      [id]
    );
    const gradientId = `eg-${safeId}`;
    const markerId = `em-${safeId}`;
    const markerStartId = `ems-${safeId}`;

    // Visual styling based on state
    const strokeWidth = showGradient ? 2.5 : 1.5;
    const strokeOpacity = showGradient ? 1 : 0.5;

    // Determine if we need markers
    const showEndMarker = edgeType === 'arrow' || edgeType === 'bidirectional' || edgeType === 'default';
    const showStartMarker = edgeType === 'bidirectional';

    // Colors for markers
    const markerEndColor = showGradient ? targetColor : INACTIVE_COLOR;
    const markerStartColor = showGradient ? sourceColor : INACTIVE_COLOR;

    // Use SVG gradient when two different colors, direct color otherwise
    const useGradientStroke = showGradient && sourceColor !== targetColor;
    const strokeColor = showGradient
      ? (useGradientStroke ? `url(#${gradientId})` : sourceColor)
      : INACTIVE_COLOR;

    return (
      <>
        <defs>
          {/* Linear gradient along the edge: source color → target color */}
          {useGradientStroke && (
            <linearGradient
              id={gradientId}
              x1={sourceX}
              y1={sourceY}
              x2={targetX}
              y2={targetY}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={sourceColor} />
              <stop offset="100%" stopColor={targetColor} />
            </linearGradient>
          )}

          {/* Arrow marker for end */}
          <marker
            id={markerId}
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M2,2 L10,6 L2,10 L4,6 Z"
              fill={markerEndColor}
            />
          </marker>

          {/* Arrow marker for start (bidirectional) */}
          <marker
            id={markerStartId}
            markerWidth="12"
            markerHeight="12"
            refX="2"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path
              d="M10,2 L2,6 L10,10 L8,6 Z"
              fill={markerStartColor}
            />
          </marker>
        </defs>

        {/* Edge path — no react-flow__edge-path class to avoid CSS stroke override */}
        <path
          id={id}
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          markerEnd={showEndMarker ? `url(#${markerId})` : undefined}
          markerStart={showStartMarker ? `url(#${markerStartId})` : undefined}
          style={{
            strokeWidth,
            strokeOpacity,
            strokeDasharray: getStrokeDasharray(lineStyle),
            transition: 'stroke-width 0.2s ease, stroke-opacity 0.2s ease, stroke 0.2s ease',
          }}
        />

        {/* Invisible wider path for easier interaction */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          className="react-flow__edge-interaction"
        />

        {/* Edge Label */}
        {label && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
              }}
              className={`
                px-2 py-0.5 rounded text-xs font-medium transition-colors
                ${showGradient
                  ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

CustomEdge.displayName = 'CustomEdge';
