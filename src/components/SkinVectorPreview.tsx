import React from 'react';
import type { CrewmateSkinId } from '../types/game';

interface SkinVectorPreviewProps {
  skinId: CrewmateSkinId;
  active: boolean;
}

/**
 * Pure inline SVG (`0KB` external asset) miniature vector showcase emblems
 * mirroring the exact procedural ornaments in `src/renderer/passes/playerGeometry.ts`:
 * - `classic`: Hexagonal Resonance Shield + Poised Katana Arc
 * - `prism`: 3-Feather Cubic-Bezier Valkyrie Wings + 3-Spire Tiara & 8-Point Star
 * - `flawless`: Twin Hex-Thrusters + Plasma Plumes + Tilted 3D Cyber Halo & V-Visor
 * - `grandmaster`: 5-Spire Imperial Crown (Crimson Ruby) + Solar Mantle & Orbiting Shards
 */
export const SkinVectorPreview: React.FC<SkinVectorPreviewProps> = ({ skinId, active }) => {
  return (
    <svg
      className={`skin-preview-svg${active ? ' is-active' : ''}`}
      data-testid={`skin-preview-svg-${skinId}`}
      viewBox="0 0 56 56"
      width="44"
      height="44"
      fill="none"
      aria-hidden="true"
    >
      {/* Subtle tactical reticle ticks */}
      <path
        d="M5 12V6h6M45 6h6v6M51 44v6h-6M11 50H5v-6"
        stroke="rgba(165, 205, 255, 0.24)"
        strokeWidth="1.2"
      />

      {skinId === 'classic' && (
        <>
          {/* Outer hexagonal resonance shield */}
          <polygon
            points="28,7 46,17.5 46,38.5 28,49 10,38.5 10,17.5"
            fill="rgba(5, 213, 255, 0.14)"
            stroke="#05D5FF"
            strokeWidth="1.7"
          />
          <polygon
            points="28,12 41.5,19.8 41.5,36.2 28,44 14.5,36.2 14.5,19.8"
            stroke="rgba(220, 250, 255, 0.42)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          {/* Crewmate silhouette + visor */}
          <rect
            x="20.5"
            y="18"
            width="14"
            height="20"
            rx="6.8"
            fill="#0D1F38"
            stroke="#05D5FF"
            strokeWidth="1.6"
          />
          <rect
            x="24.5"
            y="21.5"
            width="11.5"
            height="6.2"
            rx="3.1"
            fill="#9BEEFF"
            stroke="#FFFFFF"
            strokeWidth="1.1"
          />
          {/* Poised cyan katana slash arc */}
          <path
            d="M17 36 C25 34, 36 27, 47 16 C40 29, 29 37, 17 38.5 Z"
            fill="#05D5FF"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        </>
      )}

      {skinId === 'prism' && (
        <>
          {/* 3 swept 3rd-order Bezier Valkyrie wing feathers */}
          <path
            d="M23 23 C16 15, 9 13, 4 18 C9 22, 15 24, 22 26 Z"
            fill="rgba(56, 189, 248, 0.85)"
            stroke="#FFF6BE"
            strokeWidth="1.2"
          />
          <path
            d="M22 27 C15 24, 9 25, 5 29 C10 32, 16 31, 22 30 Z"
            fill="rgba(56, 189, 248, 0.72)"
            stroke="#E0F7FF"
            strokeWidth="1.1"
          />
          <path
            d="M22 31 C16 32, 11 35, 8 39 C13 40, 18 37, 23 34 Z"
            fill="rgba(56, 189, 248, 0.56)"
            stroke="#BAE6FD"
            strokeWidth="1"
          />
          {/* Crewmate silhouette + visor */}
          <rect
            x="22"
            y="20"
            width="13.5"
            height="19"
            rx="6.5"
            fill="#102542"
            stroke="#38BDF8"
            strokeWidth="1.6"
          />
          <rect
            x="26"
            y="23.2"
            width="11"
            height="5.8"
            rx="2.9"
            fill="#E0F7FF"
            stroke="#FFFFFF"
            strokeWidth="1.1"
          />
          {/* 3-Spire Crystal Tiara + Golden Diamond Core */}
          <path
            d="M23 19.5 L22.5 13.5 L26.2 16.5 L28.8 9.2 L31.4 16.5 L35 13.5 L34.5 19.5 Z"
            fill="#38BDF8"
            stroke="#FFFFFF"
            strokeWidth="1.2"
          />
          <polygon points="28.8,13.6 30.8,16.4 28.8,19.0 26.8,16.4" fill="#FFE42A" />
          {/* 8-point crystalline Valkyrie star */}
          <polygon
            points="45,11 46.3,14.7 50,16 46.3,17.3 45,21 43.7,17.3 40,16 43.7,14.7"
            fill="#FFE42A"
            stroke="#FFFFFF"
            strokeWidth="0.9"
          />
          {/* Katana blade */}
          <path
            d="M24 35 C32 33, 40 28, 49 21 C42 31, 33 36, 24 37 Z"
            fill="#E0F7FF"
            stroke="#38BDF8"
            strokeWidth="1"
          />
        </>
      )}

      {skinId === 'flawless' && (
        <>
          {/* Emerald plasma exhaust plumes */}
          <polygon points="15,21 3.5,18 11,25" fill="rgba(52, 211, 153, 0.52)" />
          <polygon points="15,34 4.5,39 12,37.5" fill="rgba(52, 211, 153, 0.52)" />
          {/* Twin Hex-Thruster Wing Blades */}
          <polygon
            points="23,23 16,18.5 6.5,20 9.5,24.5 16.5,26 23,27"
            fill="#34D399"
            stroke="#DAFFF6"
            strokeWidth="1.2"
          />
          <polygon
            points="23,30.5 16,32 8,34 6.5,37.5 16.5,38.5 23,34.5"
            fill="#34D399"
            stroke="#DAFFF6"
            strokeWidth="1.2"
          />
          {/* Tilted hollow 3D Cyber Emerald Halo Ring */}
          <ellipse
            cx="29.5"
            cy="12.5"
            rx="10.5"
            ry="3.1"
            transform="rotate(-8 29.5 12.5)"
            stroke="#34D399"
            strokeWidth="2"
          />
          <ellipse
            cx="29.5"
            cy="12.5"
            rx="10.5"
            ry="3.1"
            transform="rotate(-8 29.5 12.5)"
            stroke="#E8FFFA"
            strokeWidth="0.8"
          />
          {/* Crewmate silhouette + V-shaped tactical visor crest */}
          <rect
            x="22.5"
            y="19"
            width="14"
            height="19.5"
            rx="6.6"
            fill="#0B2924"
            stroke="#34D399"
            strokeWidth="1.6"
          />
          <polygon
            points="25,22.5 32,25.2 38.5,21.5 37,25.5 32,28 24.5,25"
            fill="#6EE7B7"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
          {/* Katana blade */}
          <path
            d="M25 35 C33 33, 41 28, 49.5 21.5 C43 31, 34 36.2, 25 37 Z"
            fill="#A7F3D0"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        </>
      )}

      {skinId === 'grandmaster' && (
        <>
          {/* Sacred solar mandala aura */}
          <circle
            cx="28.5"
            cy="28.5"
            r="19"
            fill="rgba(255, 230, 0, 0.08)"
            stroke="rgba(255, 230, 0, 0.42)"
            strokeWidth="1.1"
            strokeDasharray="3 2.5"
          />
          {/* Solar Sovereign Wing-Mantle */}
          <path
            d="M22.5 22 C15 16, 9 15, 4.5 19 C9.5 22.5, 15 24, 22 26 Z"
            fill="#FFE600"
            stroke="#FFFBEB"
            strokeWidth="1.15"
          />
          <path
            d="M22 27.5 C15 26.5, 9.5 28, 6 32.5 C11 34, 16.5 32.5, 22.5 31 Z"
            fill="#FACC15"
            stroke="#FFFBEB"
            strokeWidth="1.1"
          />
          {/* Crewmate silhouette + visor */}
          <rect
            x="21.8"
            y="20"
            width="13.8"
            height="19"
            rx="6.6"
            fill="#2B1F08"
            stroke="#FFE600"
            strokeWidth="1.6"
          />
          <rect
            x="25.8"
            y="23.2"
            width="11"
            height="5.8"
            rx="2.9"
            fill="#FEF08A"
            stroke="#FFFFFF"
            strokeWidth="1.1"
          />
          {/* 5-Spire Imperial Golden Crown + Crimson Ruby */}
          <path
            d="M21.5 19.5 L20.2 13.8 L24 16.6 L25.8 11.5 L28.7 15.8 L28.7 8.5 L31.6 15.8 L33.5 11.5 L35.2 16.6 L37.2 13.8 L35.8 19.5 Z"
            fill="#FFE600"
            stroke="#FFFFFF"
            strokeWidth="1.15"
            strokeLinejoin="round"
          />
          <polygon points="28.7,14.2 30.6,16.8 28.7,19.1 26.8,16.8" fill="#FF2A6D" />
          {/* Orbiting Solar Diamond Shards */}
          <polygon points="45.5,12 47.7,14.8 45.5,17.6 43.3,14.8" fill="#FFE600" stroke="#FFF" strokeWidth="0.8" />
          <polygon points="47.5,33 49.4,35.4 47.5,37.8 45.6,35.4" fill="#FFE600" stroke="#FFF" strokeWidth="0.8" />
          {/* Golden Katana Arc */}
          <path
            d="M23.5 35.5 C32 33.5, 40.5 27.5, 49.5 19.5 C42.5 30.5, 33.5 36.8, 23.5 37.5 Z"
            fill="#FFE600"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
        </>
      )}
    </svg>
  );
};

export type HudIconKind =
  | 'cpu'
  | 'gpu'
  | 'casual'
  | 'standard'
  | 'track'
  | 'customTrack'
  | 'plus'
  | 'gear';

interface HudVectorIconProps {
  kind: HudIconKind;
  size?: number;
  className?: string;
}

/**
 * Crisp geometric Cyberpunk HUD vector icons replacing OS-dependent bitmap emojis on StartScreen.
 */
export const HudVectorIcon: React.FC<HudVectorIconProps> = ({
  kind,
  size = 16,
  className = 'hud-vector-icon',
}) => {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      {kind === 'cpu' && (
        <>
          <rect x="5" y="5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          <rect x="7.8" y="7.8" width="4.4" height="4.4" fill="currentColor" />
          <path
            d="M7.5 2.2V5M12.5 2.2V5M7.5 15v2.8M12.5 15v2.8M2.2 7.5H5M2.2 12.5H5M15 7.5h2.8M15 12.5h2.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      )}
      {kind === 'gpu' && (
        <>
          <polygon
            points="10,2.2 17.4,6.5 17.4,13.5 10,17.8 2.6,13.5 2.6,6.5"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <polygon points="10,5.8 13.8,10 10,14.2 6.2,10" fill="currentColor" />
        </>
      )}
      {kind === 'casual' && (
        <path
          d="M10 2.3L16.4 5v4.7c0 4.1-2.7 6.9-6.4 8.1-3.7-1.2-6.4-4-6.4-8.1V5L10 2.3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )}
      {kind === 'standard' && (
        <path
          d="M3.2 16.8L16.6 3.4M12.2 3.4h4.4v4.4M6.6 11.2l2.2 2.2M3.4 3.4l5.2 5.2M16.8 16.8l-5.2-5.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {kind === 'track' && (
        <>
          <path
            d="M8 14.8V4.5l8-1.8v10.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5.8" cy="14.8" r="2.3" fill="currentColor" />
          <circle cx="13.8" cy="13" r="2.3" fill="currentColor" />
        </>
      )}
      {kind === 'customTrack' && (
        <path
          d="M2.6 5.6h5l1.8 2h8v7.8a1.4 1.4 0 0 1-1.4 1.4H4a1.4 1.4 0 0 1-1.4-1.4V5.6Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )}
      {kind === 'plus' && (
        <path
          d="M10 4v12M4 10h12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      {kind === 'gear' && (
        <>
          <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M10 2.4v2.1M10 15.5v2.1M2.4 10h2.1M15.5 10h2.1M4.6 4.6l1.5 1.5M13.9 13.9l1.5 1.5M15.4 4.6l-1.5 1.5M6.1 13.9l-1.5 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
};
