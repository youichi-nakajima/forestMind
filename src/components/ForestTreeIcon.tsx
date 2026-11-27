import React from 'react';
import type { TreeSpecies } from '../utils/forestGraph';

interface ForestTreeIconProps {
  species: TreeSpecies;
  canopyFill: string;
  canopyStroke: string;
  trunkColor?: string;
  size?: number;
  x?: number;
  y?: number;
}

/**
 * Custom botanical SVG tree silhouette representing map scale, depth, and hub role (6 species).
 */
export const ForestTreeIcon: React.FC<ForestTreeIconProps> = React.memo(({
  species,
  canopyFill,
  canopyStroke,
  trunkColor = '#78350f',
  size = 56,
  x,
  y,
}) => {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`forest-tree-svg species-${species}`}
    >
      {/* Ground shadow */}
      <ellipse cx="32" cy="57" rx="14" ry="3.5" fill="rgba(15, 23, 42, 0.14)" />

      {species === 'sprout' && (
        <g>
          <path
            d="M32 55 L32 34"
            stroke={trunkColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M32 37 C23 36, 19 29, 23 24 C27 20, 32 28, 32 35 Z"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
          />
          <path
            d="M32 35 C41 34, 45 27, 41 22 C37 18, 32 26, 32 33 Z"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
          />
        </g>
      )}

      {species === 'sapling' && (
        <g>
          <path
            d="M32 56 L32 30"
            stroke={trunkColor}
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <circle
            cx="32"
            cy="27"
            r="12"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
          />
          <circle
            cx="24"
            cy="31"
            r="7"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="1.8"
          />
        </g>
      )}

      {species === 'shrub' && (
        <g>
          <path
            d="M27 55 L30 43 M37 55 L34 43"
            stroke={trunkColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="19" cy="40" r="10" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="45" cy="40" r="10" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="28" cy="34" r="11" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="37" cy="35" r="10" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <ellipse cx="32" cy="42" rx="18" ry="8" fill={canopyFill} />
        </g>
      )}

      {species === 'pine' && (
        <g>
          <rect x="29" y="42" width="6" height="14" rx="2" fill={trunkColor} />
          <polygon
            points="32,7 45,24 19,24"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="32,17 48,35 16,35"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="32,27 51,46 13,46"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      )}

      {species === 'mature' && (
        <g>
          <path
            d="M28 56 L29 33 L35 33 L36 56 Z M30 41 L21 32 M34 39 L43 31"
            fill={trunkColor}
            stroke={trunkColor}
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <ellipse
            cx="32"
            cy="24"
            rx="20"
            ry="14"
            fill={canopyFill}
            stroke={canopyStroke}
            strokeWidth="2"
          />
          <circle cx="19" cy="29" r="9" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="45" cy="29" r="9" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="32" cy="14" r="11" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <ellipse cx="32" cy="25" rx="16" ry="10" fill={canopyFill} />
        </g>
      )}

      {species === 'ancient' && (
        <g>
          <path
            d="M25 56 C27 48, 28 40, 28 31 L36 31 C36 40, 37 48, 39 56 Z"
            fill={trunkColor}
          />
          <path
            d="M28 38 L16 28 M36 37 L48 27"
            stroke={trunkColor}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="15" cy="27" r="10" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="49" cy="27" r="10" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="24" cy="18" r="12" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="40" cy="18" r="12" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <circle cx="32" cy="13" r="11" fill={canopyFill} stroke={canopyStroke} strokeWidth="2" />
          <ellipse cx="32" cy="24" rx="19" ry="10" fill={canopyFill} />
        </g>
      )}
    </svg>
  );
});

ForestTreeIcon.displayName = 'ForestTreeIcon';
