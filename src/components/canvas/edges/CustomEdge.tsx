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
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  }: EdgeProps) => {
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
    const showGradient = edgeData?.showGradient || false;

    // Colors for gradient
    const sourceColor = edgeData?.sourceColor || '#6366f1';
    const targetColor = edgeData?.targetColor || '#6366f1';

    // Unique IDs for this edge
    const gradientId = `edge-gradient-${id}`;
    const markerId = `edge-marker-${id}`;
    const markerStartId = `edge-marker-start-${id}`;

    // Visual styling based on state
    const strokeWidth = showGradient ? 2.5 : 1.5;
    const strokeOpacity = showGradient ? 1 : 0.5;

    // Determine if we need markers
    const showEndMarker = edgeType === 'arrow' || edgeType === 'bidirectional' || edgeType === 'default';
    const showStartMarker = edgeType === 'bidirectional';

    // Colors for markers
    const markerEndColor = showGradient ? targetColor : INACTIVE_COLOR;
    const markerStartColor = showGradient ? sourceColor : INACTIVE_COLOR;

    return (
      <>
        <defs>
          {/* Gradient from source to target color */}
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

        {/* Edge path - colored when active, gray when inactive */}
        <path
          id={id}
          className="react-flow__edge-path"
          d={edgePath}
          fill="none"
          stroke={showGradient ? sourceColor : INACTIVE_COLOR}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeDasharray={getStrokeDasharray(lineStyle)}
          markerEnd={showEndMarker ? `url(#${markerId})` : undefined}
          markerStart={showStartMarker ? `url(#${markerStartId})` : undefined}
          style={{
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
