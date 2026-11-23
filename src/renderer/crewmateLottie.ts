import type { LottieSlotData } from '@thorvg/webcanvas';
import type { CrewmateSkinId } from '../types/game';

/**
 * Runtime in-memory Lottie slot (`"sid"`) injection & 4-skin palette definitions
 * for `src/asset/Loading 50 _ Among Us.json` (the raw disk asset remains 100% untouched).
 *
 * All 16 color nodes in `Loading 50 _ Among Us.json` use static RGBA (`a: 0`):
 * - 6 dark outlines (`[0.137, 0.122, 0.125, 1]`) & 1 visor glint (`[0.945, 0.949, 0.949, 1]`) stay intact.
 * - `visor_main`: upper visor fill (`face/Group 3/Fill 1`)
 * - `visor_shade`: lower visor shadow fill (`face/Group 4/Fill 1`)
 * - `suit_main`: bright body & backpack fills (`Bod/Group 10/Fill 1`, `pack/Group 15/Fill 1`)
 * - `suit_shade`: lower body/backpack/hip shadow fills (`Bod/Group 9/Fill 1`, `pack/Group 14/Fill 1`,
 *   `Group 6/Fill 1`) PLUS both animated running leg strokes (`Group 5/Stroke 1`, `Group 7/Stroke 1`, `ty: "st"`, `w: 8.2`).
 */

interface LottieColorProp {
  a?: number;
  k?: unknown;
  ix?: number;
  sid?: string;
}

interface LottieShapeNode {
  ty?: string;
  c?: LottieColorProp;
  it?: LottieShapeNode[];
  shapes?: LottieShapeNode[];
}

interface LottieLayerNode {
  shapes?: LottieShapeNode[];
}

interface LottieAssetNode {
  layers?: LottieLayerNode[];
}

interface LottieDocRoot {
  layers?: LottieLayerNode[];
  assets?: LottieAssetNode[];
}

export const CREWMATE_SKIN_LOTTIE_SLOTS: Record<CrewmateSkinId, LottieSlotData> = {
  classic: {
    suit_main: { p: { a: 0, k: [0.93, 0.11, 0.16, 1] } },
    suit_shade: { p: { a: 0, k: [0.76, 0.08, 0.14, 1] } },
    visor_main: { p: { a: 0, k: [0.16, 0.72, 0.95, 1] } },
    visor_shade: { p: { a: 0, k: [0.04, 0.52, 0.76, 1] } },
  },
  prism: {
    suit_main: { p: { a: 0, k: [0.22, 0.74, 0.98, 1] } },
    suit_shade: { p: { a: 0, k: [0.24, 0.36, 0.86, 1] } },
    visor_main: { p: { a: 0, k: [1.0, 0.95, 0.55, 1] } },
    visor_shade: { p: { a: 0, k: [0.96, 0.76, 0.18, 1] } },
  },
  flawless: {
    suit_main: { p: { a: 0, k: [0.20, 0.84, 0.60, 1] } },
    suit_shade: { p: { a: 0, k: [0.04, 0.56, 0.42, 1] } },
    visor_main: { p: { a: 0, k: [0.86, 0.99, 1.0, 1] } },
    visor_shade: { p: { a: 0, k: [0.42, 0.88, 0.96, 1] } },
  },
  grandmaster: {
    suit_main: { p: { a: 0, k: [1.0, 0.88, 0.08, 1] } },
    suit_shade: { p: { a: 0, k: [0.85, 0.50, 0.04, 1] } },
    visor_main: { p: { a: 0, k: [1.0, 0.24, 0.48, 1] } },
    visor_shade: { p: { a: 0, k: [0.72, 0.06, 0.28, 1] } },
  },
};

let cachedRawJson: string | null = null;
let cachedSlottedJson: string | null = null;

function injectShapeSlots(items: LottieShapeNode[] | undefined): void {
  if (!Array.isArray(items)) return;

  for (const item of items) {
    if ((item.ty === 'fl' || item.ty === 'st') && item.c && item.c.a === 0 && Array.isArray(item.c.k)) {
      const k = item.c.k;
      const r = typeof k[0] === 'number' ? k[0] : -1;
      const g = typeof k[1] === 'number' ? k[1] : -1;
      const b = typeof k[2] === 'number' ? k[2] : -1;

      if (r > 0.88 && g >= 0 && g < 0.2 && b >= 0 && b < 0.25) {
        item.c.sid = 'suit_main';
      } else if (r > 0.7 && r <= 0.88 && g >= 0 && g < 0.2 && b >= 0 && b < 0.25) {
        // Covers lower suit/backpack fills AND both running legs (`Group 5/Stroke 1`, `Group 7/Stroke 1`)
        item.c.sid = 'suit_shade';
      } else if (r > 0.1 && r < 0.25 && g > 0.6 && b > 0.8) {
        item.c.sid = 'visor_main';
      } else if (r >= 0 && r < 0.1 && g > 0.45 && g <= 0.6 && b > 0.65) {
        item.c.sid = 'visor_shade';
      }
    }

    if (item.it) {
      injectShapeSlots(item.it);
    }
    if (item.shapes) {
      injectShapeSlots(item.shapes);
    }
  }
}

export function getSlottedCrewmateLottieJson(rawJson: string): string {
  if (cachedRawJson === rawJson && cachedSlottedJson !== null) {
    return cachedSlottedJson;
  }

  try {
    const doc = JSON.parse(rawJson) as LottieDocRoot;
    if (Array.isArray(doc.layers)) {
      for (const layer of doc.layers) {
        injectShapeSlots(layer.shapes);
      }
    }
    if (Array.isArray(doc.assets)) {
      for (const asset of doc.assets) {
        if (Array.isArray(asset.layers)) {
          for (const subLayer of asset.layers) {
            injectShapeSlots(subLayer.shapes);
          }
        }
      }
    }

    const slotted = JSON.stringify(doc);
    cachedRawJson = rawJson;
    cachedSlottedJson = slotted;
    return slotted;
  } catch (err) {
    console.warn('getSlottedCrewmateLottieJson fallback to raw JSON:', err);
    return rawJson;
  }
}
