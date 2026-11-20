import type { Shape as TvgShape, ThorVGNamespace } from '@thorvg/webcanvas';

/**
 * Pooled ThorVG WASM Shape Layer Bundle:
 * Allocated once in `ThorVGRenderer.init()` in strict Painter's-Algorithm z-order
 * and passed into stateless 60fps render passes so zero WASM heap Shape objects are created per frame.
 */
export interface TvgShapePool {
  tvg: ThorVGNamespace;
  evenOddRule: ThorVGNamespace['FillRule']['EvenOdd'];
  bg: TvgShape;
  aurora: TvgShape;
  skyDash: TvgShape;
  grid: TvgShape;
  waveFill: TvgShape;
  spectrum: TvgShape;
  waveGlow: TvgShape;
  waveCore: TvgShape;
  bandBass: TvgShape;
  bandSynth: TvgShape;
  bandTreble: TvgShape;
  coreGlow: TvgShape;
  gimmicks: TvgShape;
  prismStars: TvgShape;
  timingRings: TvgShape;
  trimArcs: TvgShape;
  traps: TvgShape;
  reticles: TvgShape;
  effects: TvgShape;
  playerGlow: TvgShape;
  playerCore: TvgShape;
  skinFront: TvgShape;
  skinFrontGlow: TvgShape;
  vfxGold: TvgShape;
  vfxCyan: TvgShape;
  vfxCrimson: TvgShape;
  vfxSlicedGold: TvgShape;
  vfxSlicedCyan: TvgShape;
  vfxSlicedCrimson: TvgShape;
  vfxSlashGold: TvgShape;
  vfxSlashCyan: TvgShape;
  vfxSlashCrimson: TvgShape;
  vfxSlashCore: TvgShape;
}

/**
 * Resets all world & reticle shape layers and clears fill/dash/trimPath states
 * so scene switches (`Gameplay` <-> `Preview`) never leave stale vector paths or WASM style bleed.
 */
export function resetWorldShapeLayers(shapes: TvgShapePool): void {
  shapes.aurora.reset().fill(0, 0, 0, 0);
  shapes.skyDash
    .reset()
    .fill(0, 0, 0, 0)
    .stroke({ width: 0, color: [0, 0, 0, 0], dash: [] });
  shapes.waveFill.reset().fill(0, 0, 0, 0);
  shapes.spectrum.reset().fill(0, 0, 0, 0);
  shapes.waveGlow.reset().fill(0, 0, 0, 0);
  shapes.waveCore.reset().fill(0, 0, 0, 0);
  shapes.bandBass.reset().fill(0, 0, 0, 0);
  shapes.bandSynth.reset().fill(0, 0, 0, 0);
  shapes.bandTreble.reset().fill(0, 0, 0, 0);
  shapes.coreGlow.reset().fill(0, 0, 0, 0);
  shapes.gimmicks.reset().fill(0, 0, 0, 0);
  shapes.prismStars.reset().fill(0, 0, 0, 0);
  shapes.timingRings.reset().fill(0, 0, 0, 0);
  shapes.trimArcs
    .reset()
    .trimPath(0, 1, true)
    .fill(0, 0, 0, 0)
    .stroke({ width: 0, color: [0, 0, 0, 0] });
  shapes.traps.reset().fill(0, 0, 0, 0);
  shapes.reticles.reset().fill(0, 0, 0, 0);
}
