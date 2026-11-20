import type { Shape as TvgShape } from '@thorvg/webcanvas';
import {
  FORM_CONFIG,
  type BeatTarget,
  type BezierSegment,
  type RenderFrameState,
} from '../../types/game';
import {
  appendHollowPolygonRing,
  appendRegularPolygonPath,
  appendStarPath,
} from './playerGeometry';
import { resetWorldShapeLayers, type TvgShapePool } from './shapePool';

export type ScreenTransformFn = (val: number) => number;

function appendRectCW(shape: TvgShape, x: number, y: number, w: number, h: number): void {
  if (w <= 0.2 || h <= 0.2) return;
  shape
    .moveTo(x, y)
    .lineTo(x + w, y)
    .lineTo(x + w, y + h)
    .lineTo(x, y + h)
    .close();
}

function appendRectCCW(shape: TvgShape, x: number, y: number, w: number, h: number): void {
  if (w <= 0.2 || h <= 0.2) return;
  shape
    .moveTo(x, y)
    .lineTo(x, y + h)
    .lineTo(x + w, y + h)
    .lineTo(x + w, y)
    .close();
}

function appendHollowPrismStarHalo(
  shape: TvgShape,
  cx: number,
  cy: number,
  rad: number,
  spin: number
): void {
  appendStarPath(shape, cx, cy, rad * 1.96, rad * 1.28, 8, spin);
  appendRegularPolygonPath(shape, cx, cy, rad * 1.08, 8, spin, false);
  const orbitR = rad * 2.18;
  const sparkR = Math.max(1.8, rad * 0.22);
  for (let i = 0; i < 4; i++) {
    const a = -spin * 1.25 + (i * Math.PI) / 2;
    const ox = cx + Math.cos(a) * orbitR;
    const oy = cy + Math.sin(a) * orbitR;
    appendRegularPolygonPath(shape, ox, oy, sparkR, 4, a, true);
  }
}

function appendSerratedSawblade(
  shape: TvgShape,
  cx: number,
  cy: number,
  rad: number,
  spin: number
): void {
  const teeth = 10;
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const aBase = spin + i * step;
    const aTip = aBase + step * 0.28;
    const aGullet = aBase + step * 0.74;
    const rRoot = rad * 0.70;
    const rTip = rad * 1.22;
    const rGullet = rad * 0.62;

    const bx = cx + Math.cos(aBase) * rRoot;
    const by = cy + Math.sin(aBase) * rRoot;
    const txp = cx + Math.cos(aTip) * rTip;
    const typ = cy + Math.sin(aTip) * rTip;
    const gx = cx + Math.cos(aGullet) * rGullet;
    const gy = cy + Math.sin(aGullet) * rGullet;

    if (i === 0) shape.moveTo(bx, by);
    else shape.lineTo(bx, by);
    shape.lineTo(txp, typ).lineTo(gx, gy);
  }
  shape.close();
  // Counter-wound machined axle bore
  appendRegularPolygonPath(shape, cx, cy, rad * 0.28, 8, -spin, false);
}

interface ActiveRushGlowAnchor {
  cx: number;
  cy: number;
  radius: number;
  locked: boolean;
}

interface TrimArcCandidate {
  priority: 1 | 2 | 3;
  progress: number;
  strokeWidth: number;
  color: readonly [number, number, number, number];
  circles: ReadonlyArray<readonly [number, number, number]>;
}

/**
 * Stateless 2-Lane Rhythm Slasher World Render Pass (`rhythm-slasher-v6` + ThorVG v1.1.3 Showcase):
 * - Continuous 1F Bezier neon stage deck (`LinearGradient`) + equalizer spectrum + 2F Cyan sky rail & scrolling `dash` telemetry
 * - `RadialGradient` boss/overdrive plasma aura (`coreGlow`) & `Shape.trimPath` progressive circular gauges (`trimArcs`)
 * - Fixed Dual Neon Target Reticles (`HIGH` Cyan `#05D5FF`, `LOW` Crimson `#FF2A6D`) + beat-sync plasma beam
 * - 5 Active Beat Enemy Archetypes (`'high'`, `'low'`, `'chord'`, `'hold'` [with `holdBroken` severed flicker], `'rush'`)
 * - 2 Active-Dodge Hazards (`'sawblade'` 1F, `'mine'` 2F) + Golden 8-Point `★ Prism Star` Halos
 */
export function renderMacroWorldPass(
  shapes: TvgShapePool,
  state: RenderFrameState,
  tx: ScreenTransformFn,
  ty: ScreenTransformFn,
  ts: ScreenTransformFn
): void {
  const { width, height, activeForm, frequency, segments, targets, cameraX } = state;
  const formCfg = FORM_CONFIG[activeForm];
  const [fr, fg, fb] = formCfg.rgb;
  const [sr, sg, sb] = formCfg.secondaryRgb;
  const isDrop = state.sectionIntensity === 'drop';
  const isOverdrive = Boolean(state.overdriveActive);
  const combo = state.combo ?? 1;
  const audioSec = state.audioSec ?? state.timeSec;
  const beatEnergy = Math.max(
    state.beatPulse ?? 0,
    frequency.isBeat ? 0.85 : 0,
    frequency.low * 0.55
  );
  const roundCap = shapes.tvg.StrokeCap.Round;
  const roundJoin = shapes.tvg.StrokeJoin.Round;
  const tw = (w: number) => Math.max(0.75, Math.min(w * 14, ts(w)));
  const cullPad = Math.max(96, ts(115));

  resetWorldShapeLayers(shapes);

  const reticleX = tx(state.reticleScreenX);
  const yHigh = ty(state.laneHighScreenY);
  const yLow = ty(state.laneLowScreenY);

  // Determine visible world X span for continuous rails & beat-reactive ticks
  let visMinWx = cameraX - 240;
  let visMaxWx = cameraX + width + 240;
  const cullSegPad = Math.max(48, ts(60));
  const visibleSegments: BezierSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const sx0 = tx(seg.x0 - cameraX);
    const sx1 = tx(seg.x1 - cameraX);
    if (sx1 >= -cullSegPad && sx0 <= width + cullSegPad) {
      visibleSegments.push(seg);
    }
  }
  if (visibleSegments.length > 0) {
    visMinWx = visibleSegments[0]!.x0 - 160;
    visMaxWx = visibleSegments[visibleSegments.length - 1]!.x1 + 160;
  }

  // 0. Sleek 2F Cyan Sky Rail (`shapes.aurora`) + Scrolling Dash Telemetry Rail & Horizon Aurora (`shapes.skyDash`)
  shapes.aurora.moveTo(0, yHigh).lineTo(width, yHigh);

  const railTickStep = 136;
  const firstTickWx = Math.floor(visMinWx / railTickStep) * railTickStep;
  for (let wx = firstTickWx, idx = 0; wx <= visMaxWx && idx < 256; wx += railTickStep, idx++) {
    const sx = tx(wx - cameraX);
    if (sx < -24 || sx > width + 24) continue;
    const isMajor = Math.abs(Math.round(wx / railTickStep)) % 4 === 0;
    const tickHalfH = ts((isMajor ? 7.5 : 4.0) * (1 + beatEnergy * 0.45));
    shapes.aurora.moveTo(sx, yHigh - tickHalfH).lineTo(sx, yHigh + tickHalfH);
  }

  const secondaryRailOffset = ts(5.5);
  shapes.skyDash
    .moveTo(reticleX, yHigh + secondaryRailOffset)
    .lineTo(width, yHigh + secondaryRailOffset);

  if (isDrop || isOverdrive || combo >= 25) {
    const steps = 12;
    const stepW = width / steps;
    const amp = isOverdrive ? 26 : isDrop ? 20 : 12;
    const baseY1 = height * 0.16;
    const baseY2 = height * 0.23;

    shapes.skyDash.moveTo(0, baseY1);
    for (let i = 1; i <= steps; i++) {
      const x = i * stepW;
      const y = baseY1 + Math.sin(state.timeSec * 3.4 + i * 0.7) * amp + frequency.mid * 14;
      shapes.skyDash.lineTo(x, y);
    }
    shapes.skyDash.moveTo(0, baseY2);
    for (let i = 1; i <= steps; i++) {
      const x = i * stepW;
      const y = baseY2 + Math.cos(state.timeSec * 2.7 + i * 0.65) * (amp * 0.8) - frequency.high * 12;
      shapes.skyDash.lineTo(x, y);
    }
  }

  const skyRailAlpha = Math.min(
    185,
    Math.round((isOverdrive ? 125 : isDrop ? 105 : 82) + beatEnergy * 42)
  );
  const skyRailColor: [number, number, number] = isOverdrive ? [140, 242, 255] : [5, 213, 255];
  shapes.aurora
    .fill(0, 0, 0, 0)
    .stroke({
      width: tw(isOverdrive || isDrop ? 2.4 : 1.9),
      color: [skyRailColor[0], skyRailColor[1], skyRailColor[2], skyRailAlpha],
      cap: roundCap,
      join: roundJoin,
    });

  const dashLen = Math.max(5, ts(18));
  const gapLen = Math.max(4, ts(11));
  const dashPeriod = dashLen + gapLen;
  const dashOffset =
    (((cameraX * Math.min(state.zoomScale, 48)) % dashPeriod) + dashPeriod) % dashPeriod;
  shapes.skyDash
    .fill(0, 0, 0, 0)
    .stroke({
      width: tw(isOverdrive || isDrop ? 2.0 : 1.6),
      color: [skyRailColor[0], skyRailColor[1], skyRailColor[2], Math.round(skyRailAlpha * 0.85)],
      cap: roundCap,
      join: roundJoin,
      dash: [dashLen, gapLen],
      dashOffset,
    });

  // 1. Continuous 1F Cubic-Bezier Neon Stage Deck (`LinearGradient`) + Equalizer Spectrum
  if (visibleSegments.length > 0) {
    const bottomY = Math.max(height + 40, ty(height + 160));
    const first = visibleSegments[0]!;
    const last = visibleSegments[visibleSegments.length - 1]!;
    const startX = tx(first.x0 - cameraX);
    const startY = ty(first.y0);
    const endX = tx(last.x1 - cameraX);
    let hasSpectrum = false;
    const harmonicAmp = (frequency.high * 8 + (isDrop ? 4 : 0)) * Math.min(state.zoomScale, 4);

    shapes.waveFill.moveTo(startX, bottomY).lineTo(startX, startY);
    shapes.waveGlow.moveTo(startX, startY);
    shapes.waveCore.moveTo(startX, startY);

    for (let i = 0; i < visibleSegments.length; i++) {
      const seg = visibleSegments[i]!;
      const cx1 = tx(seg.cx1 - cameraX);
      const cy1 = ty(seg.cy1);
      const cx2 = tx(seg.cx2 - cameraX);
      const cy2 = ty(seg.cy2);
      const x1 = tx(seg.x1 - cameraX);
      const y1 = ty(seg.y1);

      shapes.waveFill.cubicTo(cx1, cy1, cx2, cy2, x1, y1);
      shapes.waveGlow.cubicTo(cx1, cy1, cx2, cy2, x1, y1);
      shapes.waveCore.cubicTo(cx1, cy1, cx2, cy2, x1, y1);

      const x0 = tx(seg.x0 - cameraX);
      const eLow = (seg.low ?? 0.25) * (0.65 + frequency.low * 0.65);
      const eMid = (seg.mid ?? 0.25) * (0.65 + frequency.mid * 0.65);
      const eHigh = (seg.high ?? 0.25) * (0.65 + frequency.high * 0.65);
      const energies = [eLow, eMid, eHigh];
      const midRoadY = (ty(seg.y0) + y1) * 0.5;
      const specBottomY = Math.min(height, bottomY);
      const availDepth = specBottomY - midRoadY - Math.max(4, ts(10));

      if (availDepth > 12 && midRoadY < height - 18) {
        const segSpan = Math.max(ts(12), x1 - x0);
        const barW = Math.max(1.5, segSpan * 0.22);
        for (let bIdx = 0; bIdx < 3; bIdx++) {
          const bx = x0 + (bIdx + 0.22) * (segSpan / 3);
          const bh = Math.max(4, Math.min(availDepth * 0.85, availDepth * energies[bIdx]!));
          const rx = Math.max(1, ts(2));
          shapes.spectrum.appendRect(bx, specBottomY - bh, barW, bh, { rx, ry: rx });
          hasSpectrum = true;
        }
      }
    }

    shapes.waveFill.lineTo(endX, bottomY).close();

    // Secondary harmonic shimmer line underneath solid deck edge + subtle 1F LOW lane guide rail
    const harmonicOffset = ts(11) + Math.sin(state.timeSec * 12) * harmonicAmp * 0.2;
    shapes.waveGlow.moveTo(startX, startY + harmonicOffset);
    for (let i = 0; i < visibleSegments.length; i++) {
      const seg = visibleSegments[i]!;
      shapes.waveGlow.cubicTo(
        tx(seg.cx1 - cameraX),
        ty(seg.cy1) + harmonicOffset,
        tx(seg.cx2 - cameraX),
        ty(seg.cy2) + harmonicOffset,
        tx(seg.x1 - cameraX),
        ty(seg.y1) + harmonicOffset
      );
    }
    shapes.waveGlow.moveTo(reticleX, yLow).lineTo(width, yLow);

    const fillAlpha = isOverdrive ? 68 : isDrop ? 54 : 38;
    const glowWidth = Math.max(1.8, ts(isOverdrive ? 10 : isDrop || frequency.isBeat ? 8 : 6));
    const glowAlpha = isOverdrive ? 155 : isDrop || frequency.isBeat ? 122 : 86;
    const deckR = isOverdrive ? 255 : Math.round(fr * 0.55 + 255 * 0.45);
    const deckG = isOverdrive ? 225 : Math.round(fg * 0.55 + 42 * 0.45);
    const deckB = isOverdrive ? 85 : Math.round(fb * 0.55 + 109 * 0.45);

    // One-shot LinearGradient ownership transfer to `shapes.waveFill`
    const deckTopY = startY;
    const deckGradEndY = Math.max(
      deckTopY + 12,
      Math.min(bottomY, startY + Math.max(90, ts(180)))
    );
    const deckGrad = new shapes.tvg.LinearGradient(0, deckTopY, 0, deckGradEndY);
    deckGrad.setStops(
      [0, [deckR, deckG, deckB, Math.min(132, Math.round(fillAlpha * 1.8))]],
      [0.45, [fr, fg, fb, fillAlpha]],
      [
        1,
        [
          Math.round(fr * 0.3),
          Math.round(fg * 0.3),
          Math.round(fb * 0.45),
          state.videoBackgroundActive ? 10 : 6,
        ],
      ]
    );
    shapes.waveFill.fill(deckGrad).stroke({ width: 0, color: [0, 0, 0, 0] });

    if (hasSpectrum) {
      shapes.spectrum
        .fill(fr, fg, fb, isDrop || isOverdrive ? 86 : 50)
        .stroke({ width: tw(1.2), color: [sr, sg, sb, 115], cap: roundCap, join: roundJoin });
    }
    shapes.waveGlow
      .fill(0, 0, 0, 0)
      .stroke({
        width: glowWidth,
        color: [deckR, deckG, deckB, glowAlpha],
        cap: roundCap,
        join: roundJoin,
      });
    shapes.waveCore
      .fill(0, 0, 0, 0)
      .stroke({
        width: tw(3.2),
        color: [255, 255, 255, 245],
        cap: roundCap,
        join: roundJoin,
      });
  }

  let hasBass = false;      // Crimson #FF2A6D (`LOW` lane core & reticle ring)
  let hasSynth = false;     // Cyan #05D5FF (`HIGH` lane core & reticle ring)
  let hasTreble = false;    // Gold #FFE600 (`CHORD` / `RUSH` shield core)
  let hasWhiteCore = false; // `shapes.gimmicks`: Blazing white inner cores & laser beams
  let hasPrismStars = false;
  let hasTimingRings = false;
  let hasTraps = false;

  let activeRushGlow: ActiveRushGlowAnchor | null = null;
  let bestTrimCandidate: TrimArcCandidate | null = null;
  let bestApproachDt = Infinity;

  // 2. Fixed Dual Neon Target Reticles (`shapes.bandSynth`, `shapes.bandBass`, `shapes.reticles`)
  const pulseHigh = Math.max(0, state.reticlePulseHigh);
  const pulseLow = Math.max(0, state.reticlePulseLow);
  const scaleHigh = 1 + pulseHigh * 0.38;
  const scaleLow = 1 + pulseLow * 0.38;
  const isHighActive = state.playerLane === 'high';
  const isLowActive = state.playerLane === 'low';

  const rHigh = ts((isHighActive ? 23.5 : 21.0) * scaleHigh);
  const rLow = ts((isLowActive ? 23.5 : 21.0) * scaleLow);
  const rotHigh = state.timeSec * 0.95 + pulseHigh * 0.45;
  const rotLow = -state.timeSec * 0.95 - pulseLow * 0.45;

  // Upper Reticle Cyan (`[5, 213, 255]`) double concentric hexagonal/diamond receptor frame
  appendHollowPolygonRing(shapes.bandSynth, reticleX, yHigh, rHigh * 1.18, rHigh * 0.97, 6, rotHigh);
  appendHollowPolygonRing(
    shapes.bandSynth,
    reticleX,
    yHigh,
    rHigh * 0.64,
    rHigh * 0.49,
    4,
    -rotHigh * 0.75
  );
  hasSynth = true;

  // Lower Reticle Crimson (`[255, 42, 109]`) double concentric hexagonal/diamond receptor frame
  appendHollowPolygonRing(shapes.bandBass, reticleX, yLow, rLow * 1.18, rLow * 0.97, 6, rotLow);
  appendHollowPolygonRing(
    shapes.bandBass,
    reticleX,
    yLow,
    rLow * 0.64,
    rLow * 0.49,
    4,
    -rotLow * 0.75
  );
  hasBass = true;

  // Additive Reticle Glow, Crosshair Ticks, Active-Lane Lock Brackets & Vertical Beat Sync Beam (`shapes.reticles`)
  appendRegularPolygonPath(shapes.reticles, reticleX, yHigh, rHigh * 1.30, 6, rotHigh, true);
  appendRegularPolygonPath(shapes.reticles, reticleX, yHigh, rHigh * 0.72, 4, Math.PI * 0.25, true);
  appendRegularPolygonPath(shapes.reticles, reticleX, yLow, rLow * 1.30, 6, rotLow, true);
  appendRegularPolygonPath(shapes.reticles, reticleX, yLow, rLow * 0.72, 4, Math.PI * 0.25, true);

  // Inner crosshair ticks on both reticles
  const appendCrosshairTicks = (cx: number, cy: number, rad: number) => {
    const innerT = rad * 0.26;
    const outerT = rad * 0.88;
    shapes.reticles
      .moveTo(cx - outerT, cy)
      .lineTo(cx - innerT, cy)
      .moveTo(cx + innerT, cy)
      .lineTo(cx + outerT, cy)
      .moveTo(cx, cy - outerT)
      .lineTo(cx, cy - innerT)
      .moveTo(cx, cy + innerT)
      .lineTo(cx, cy + outerT);
  };
  appendCrosshairTicks(reticleX, yHigh, rHigh);
  appendCrosshairTicks(reticleX, yLow, rLow);

  // Subtle active `state.playerLane` tactical lock-on brackets (`<` `>`) so player always feels locked into lane
  const activeY = isHighActive ? yHigh : yLow;
  const activeR = isHighActive ? rHigh : rLow;
  const bSpread = activeR * 1.56;
  const bArm = activeR * 0.42;
  shapes.reticles
    .moveTo(reticleX - bSpread + bArm, activeY - bArm)
    .lineTo(reticleX - bSpread, activeY)
    .lineTo(reticleX - bSpread + bArm, activeY + bArm)
    .moveTo(reticleX + bSpread - bArm, activeY - bArm)
    .lineTo(reticleX + bSpread, activeY)
    .lineTo(reticleX + bSpread - bArm, activeY + bArm);
  shapes.gimmicks.appendCircle(
    reticleX,
    activeY,
    Math.max(1.8, activeR * 0.14),
    Math.max(1.8, activeR * 0.14)
  );
  hasWhiteCore = true;

  // Vertical plasma sync beam connecting High & Low reticles on beat pulse
  const beamTopY = yHigh + rHigh * 1.24;
  const beamBotY = yLow - rLow * 1.24;
  if (beamBotY > beamTopY + ts(4)) {
    shapes.reticles.moveTo(reticleX, beamTopY).lineTo(reticleX, beamBotY);
    const syncPulse = Math.max(beatEnergy, pulseHigh, pulseLow);
    if (syncPulse > 0.28) {
      const spreadX = ts(3.5 * syncPulse);
      const midBeamY = (beamTopY + beamBotY) * 0.5;
      shapes.reticles
        .moveTo(reticleX, beamTopY)
        .lineTo(reticleX - spreadX, midBeamY)
        .lineTo(reticleX, beamBotY)
        .lineTo(reticleX + spreadX, midBeamY)
        .close();
    }
  }

  // 3. Beat Targets & Active-Dodge Hazards (`state.targets`)
  const worldToScreenX = (wx: number): number => tx(wx - cameraX);

  for (let i = 0; i < targets.length; i++) {
    const target: BeatTarget = targets[i]!;
    if (target.resolved && target.kind !== 'hold') continue;

    const minWx = target.worldX;
    const maxWx = target.endWorldX ?? target.worldX;
    if (worldToScreenX(maxWx) < -cullPad || worldToScreenX(minWx) > width + cullPad) {
      continue;
    }

    const baseScreenY = ty(target.screenY ?? target.worldY);
    const pulse =
      1 + Math.sin(state.timeSec * 8.5 + target.id * 0.65) * (isOverdrive ? 0.14 : 0.09);
    const rad = Math.max(2.5, ts(target.radius * pulse));

    // Approach Telegraph Ring (`timingRings`) + Priority-3 `trimPath` Sweep Candidate (`0 <= dtBeat <= 0.28`)
    const isSlashTarget =
      target.kind === 'high' ||
      target.kind === 'low' ||
      target.kind === 'chord' ||
      target.kind === 'hold' ||
      target.kind === 'rush';
    if (
      isSlashTarget &&
      !target.resolved &&
      !target.holdActive &&
      (target.rushHits ?? 0) === 0
    ) {
      const dtBeat = target.timeSec - audioSec;
      if (dtBeat >= -0.025 && dtBeat <= 0.28) {
        const ratio = Math.max(0, Math.min(1, dtBeat / 0.28));
        const ringR = ts(target.radius * (1.06 + ratio * 1.52));
        const headSx = worldToScreenX(target.worldX);
        if (target.kind === 'chord') {
          shapes.timingRings.appendCircle(headSx, yHigh, ringR, ringR);
          shapes.timingRings.appendCircle(headSx, yLow, ringR, ringR);
        } else {
          shapes.timingRings.appendCircle(headSx, baseScreenY, ringR, ringR);
        }
        hasTimingRings = true;

        if (
          dtBeat >= 0 &&
          dtBeat < bestApproachDt &&
          (bestTrimCandidate === null || bestTrimCandidate.priority === 3)
        ) {
          bestApproachDt = dtBeat;
          const sweep = Math.max(0.08, Math.min(1, 1 - dtBeat / 0.28));
          const arcR = Math.max(4, ts(target.radius * 1.62));
          const arcColor: readonly [number, number, number, number] =
            target.kind === 'chord' || target.kind === 'rush'
              ? [255, 234, 80, 238]
              : target.kind === 'high' || (target.kind === 'hold' && target.lane === 'high')
                ? [80, 236, 255, 238]
                : [255, 92, 148, 238];
          bestTrimCandidate = {
            priority: 3,
            progress: sweep,
            strokeWidth: 2.6,
            color: arcColor,
            circles:
              target.kind === 'chord'
                ? [
                    [headSx, yHigh, arcR],
                    [headSx, yLow, arcR],
                  ]
                : [[headSx, baseScreenY, arcR]],
          };
        }
      }
    }

    // Collectible ★ Prism Star 8-point golden harmonic halo
    if (target.isPrismStar && !target.resolved) {
      const starSx =
        target.kind === 'rush' && audioSec >= target.timeSec
          ? worldToScreenX(
              Math.min(
                target.endWorldX ?? target.worldX,
                Math.max(target.worldX, cameraX + state.reticleScreenX)
              )
            )
          : target.kind === 'hold' && target.holdActive
            ? Math.max(worldToScreenX(target.worldX), reticleX)
            : worldToScreenX(target.worldX);
      const starSpin = state.timeSec * 2.5 + target.id * 0.4;
      if (target.kind === 'chord') {
        appendHollowPrismStarHalo(shapes.prismStars, starSx, yHigh, rad * 0.92, starSpin);
        appendHollowPrismStarHalo(shapes.prismStars, starSx, yLow, rad * 0.92, -starSpin);
      } else {
        appendHollowPrismStarHalo(shapes.prismStars, starSx, baseScreenY, rad, starSpin);
      }
      hasPrismStars = true;
    }

    if (target.kind === 'high') {
      // 2F Aerial Interceptor (Cyan #05D5FF): sleek swept-wing cyber drone core + bright white inner diamond
      const sx = worldToScreenX(target.worldX);
      shapes.bandSynth
        .moveTo(sx - rad * 1.34, baseScreenY)
        .lineTo(sx + rad * 0.88, baseScreenY - rad * 1.12)
        .lineTo(sx + rad * 0.44, baseScreenY - rad * 0.28)
        .lineTo(sx + rad * 0.96, baseScreenY)
        .lineTo(sx + rad * 0.44, baseScreenY + rad * 0.28)
        .lineTo(sx + rad * 0.88, baseScreenY + rad * 1.12)
        .close();
      hasSynth = true;

      const dRx = rad * 0.52;
      const dRy = rad * 0.36;
      const dCx = sx - rad * 0.08;
      shapes.gimmicks
        .moveTo(dCx, baseScreenY - dRy)
        .lineTo(dCx + dRx, baseScreenY)
        .lineTo(dCx, baseScreenY + dRy)
        .lineTo(dCx - dRx, baseScreenY)
        .close();
      hasWhiteCore = true;
      continue;
    }

    if (target.kind === 'low') {
      // 1F Heavy Hex Bruiser (Crimson #FF2A6D): armored hexagonal mecha core + reactor circle + chevron
      const sx = worldToScreenX(target.worldX);
      appendRegularPolygonPath(shapes.bandBass, sx, baseScreenY, rad * 1.14, 6, 0, true);
      // Armored top/bottom shoulder plates
      appendRectCW(
        shapes.bandBass,
        sx - rad * 0.46,
        baseScreenY - rad * 1.24,
        rad * 0.92,
        rad * 0.22
      );
      appendRectCW(
        shapes.bandBass,
        sx - rad * 0.46,
        baseScreenY + rad * 1.02,
        rad * 0.92,
        rad * 0.22
      );
      hasBass = true;

      // Glowing inner reactor circle + directional forward chevron (`<`)
      const reactR = rad * 0.34;
      shapes.gimmicks.appendCircle(sx + rad * 0.16, baseScreenY, reactR, reactR);
      shapes.gimmicks
        .moveTo(sx - rad * 0.12, baseScreenY - rad * 0.44)
        .lineTo(sx - rad * 0.62, baseScreenY)
        .lineTo(sx - rad * 0.12, baseScreenY + rad * 0.44)
        .lineTo(sx - rad * 0.34, baseScreenY)
        .close();
      hasWhiteCore = true;
      continue;
    }

    if (target.kind === 'chord') {
      // Dual Gold Shield Core (Gold #FFE600): twin armored octagon cores at BOTH lanes + plasma barrier beam
      const sx = worldToScreenX(target.worldX);
      const octR = rad * 1.16;
      const beamTop = yHigh + octR * 0.78;
      const beamBot = yLow - octR * 0.78;

      if (beamBot > beamTop) {
        const beamW = Math.max(2.5, ts(9.5));
        appendRectCW(shapes.bandTreble, sx - beamW * 0.5, beamTop, beamW, beamBot - beamTop);
        const coreBeamW = Math.max(1.5, ts(3.8));
        appendRectCW(
          shapes.gimmicks,
          sx - coreBeamW * 0.5,
          beamTop,
          coreBeamW,
          beamBot - beamTop
        );
        const midY = (yHigh + yLow) * 0.5;
        appendRegularPolygonPath(shapes.bandTreble, sx, midY, rad * 0.62, 4, 0, true);
        appendRegularPolygonPath(shapes.gimmicks, sx, midY, rad * 0.30, 4, 0, true);
      }

      appendRegularPolygonPath(shapes.bandTreble, sx, yHigh, octR, 8, Math.PI / 8, true);
      appendRegularPolygonPath(shapes.bandTreble, sx, yLow, octR, 8, Math.PI / 8, true);
      hasTreble = true;

      const strikeHigh = target.chordPartialLane === 'high';
      const strikeLow = target.chordPartialLane === 'low';
      appendRegularPolygonPath(
        shapes.gimmicks,
        sx,
        yHigh,
        strikeHigh ? octR * 1.18 : octR * 0.48,
        8,
        Math.PI / 8,
        true
      );
      appendRegularPolygonPath(
        shapes.gimmicks,
        sx,
        yLow,
        strikeLow ? octR * 1.18 : octR * 0.48,
        8,
        Math.PI / 8,
        true
      );
      if (strikeHigh) {
        shapes.reticles.appendCircle(sx, yHigh, octR * 1.55, octR * 1.55);
      } else if (strikeLow) {
        shapes.reticles.appendCircle(sx, yLow, octR * 1.55, octR * 1.55);
      }
      hasWhiteCore = true;
      continue;
    }

    if (target.kind === 'hold') {
      // Sustained Neon Laser Ribbon: translucent outer conduit + blazing white-core inner laser + hex emitters
      const rawHeadX = worldToScreenX(target.worldX);
      const tailX = worldToScreenX(target.endWorldX ?? target.worldX);
      const holdY = target.lane === 'high' ? yHigh : yLow;

      if (target.resolved) {
        const ghostStartX = Math.max(rawHeadX, reticleX);
        if (tailX > ghostStartX + ts(8)) {
          if (target.holdBroken) {
            // Early-released broken ribbon: severed crimson flickering conduit segments
            const brokenH = Math.max(3.5, ts(12));
            const innerBrokenH = brokenH * 0.72;
            const flickerOn = Math.sin(state.timeSec * 28 + target.id) > -0.25;
            const span = tailX - ghostStartX;

            shapes.timingRings.appendRect(
              ghostStartX,
              holdY - brokenH * 0.45,
              span,
              brokenH * 0.9,
              { rx: brokenH * 0.45, ry: brokenH * 0.45 }
            );
            hasTimingRings = true;

            if (flickerOn) {
              const segLen = Math.max(6, ts(24));
              const segGap = Math.max(4, ts(13));
              const segStep = segLen + segGap;
              for (
                let sxSeg = ghostStartX, sCount = 0;
                sxSeg < tailX - ts(2) && sCount < 48;
                sxSeg += segStep, sCount++
              ) {
                const wSeg = Math.min(segLen, tailX - sxSeg);
                appendRectCW(shapes.traps, sxSeg, holdY - brokenH * 0.5, wSeg, brokenH);
                appendRectCCW(shapes.traps, sxSeg, holdY - innerBrokenH * 0.5, wSeg, innerBrokenH);
              }
              appendHollowPolygonRing(
                shapes.traps,
                ghostStartX,
                holdY,
                ts(11.0),
                ts(7.8),
                6,
                state.timeSec * 3.0
              );
              hasTraps = true;
            }
          } else {
            // Completed hold ribbon tail fade-out ghost
            const ghostH = Math.max(2, ts(8));
            shapes.timingRings.appendRect(
              ghostStartX,
              holdY - ghostH * 0.5,
              tailX - ghostStartX,
              ghostH,
              { rx: ghostH * 0.5, ry: ghostH * 0.5 }
            );
            hasTimingRings = true;
          }
        }
        continue;
      }

      const headX = target.holdActive ? Math.min(tailX, Math.max(rawHeadX, reticleX)) : rawHeadX;
      const spanW = Math.max(0, tailX - headX);
      const laneShape = target.lane === 'high' ? shapes.bandSynth : shapes.bandBass;
      if (target.lane === 'high') hasSynth = true;
      else hasBass = true;

      const outerH = Math.max(4, ts(target.holdActive ? 22 : 16));
      const hollowCutH = outerH * 0.56;
      if (spanW > ts(2)) {
        // Hollow neon outer containment rails + additive plasma aura
        appendRectCW(laneShape, headX, holdY - outerH * 0.5, spanW, outerH);
        appendRectCCW(laneShape, headX, holdY - hollowCutH * 0.5, spanW, hollowCutH);

        shapes.timingRings.appendRect(
          headX,
          holdY - outerH * 0.68,
          spanW,
          outerH * 1.36,
          { rx: outerH * 0.68, ry: outerH * 0.68 }
        );
        hasTimingRings = true;

        // Blazing white-core inner laser beam
        const pulseCore = target.holdActive ? 1 + Math.sin(state.timeSec * 42) * 0.22 : 1;
        const coreH = Math.max(2, ts((target.holdActive ? 7.4 : 4.6) * pulseCore));
        appendRectCW(shapes.gimmicks, headX, holdY - coreH * 0.5, spanW, coreH);
        hasWhiteCore = true;
      }

      // Head & tail hexagonal emitter nodes
      const headNodeR = ts(target.holdActive ? 14.5 : 12.5);
      const tailNodeR = ts(11.5);
      appendRegularPolygonPath(laneShape, headX, holdY, headNodeR, 6, state.timeSec * 2.4, true);
      appendRegularPolygonPath(laneShape, tailX, holdY, tailNodeR, 6, -state.timeSec * 2.0, true);
      appendRegularPolygonPath(shapes.gimmicks, headX, holdY, headNodeR * 0.52, 6, 0, true);
      appendRegularPolygonPath(shapes.gimmicks, tailX, holdY, tailNodeR * 0.45, 6, 0, true);
      if (target.holdActive) {
        appendStarPath(
          shapes.gimmicks,
          headX,
          holdY,
          headNodeR * 1.45,
          headNodeR * 0.42,
          4,
          state.timeSec * 9.5
        );
        shapes.reticles.appendCircle(headX, holdY, headNodeR * 1.65, headNodeR * 1.65);

        // Priority-1 `trimPath` circular completion arc (`0% -> 100%`)
        const endSec = target.endTimeSec ?? target.timeSec + 0.25;
        const holdProgress = Math.max(
          0.04,
          Math.min(1, (audioSec - target.timeSec) / Math.max(0.05, endSec - target.timeSec))
        );
        const holdArcR = Math.max(6, headNodeR * 2.05);
        bestTrimCandidate = {
          priority: 1,
          progress: holdProgress,
          strokeWidth: 3.4,
          color: isOverdrive
            ? [255, 238, 105, 252]
            : target.lane === 'high'
              ? [95, 240, 255, 248]
              : [255, 96, 152, 248],
          circles: [[headX, holdY, holdArcR]],
        };
      }
      hasWhiteCore = true;
      continue;
    }

    if (target.kind === 'rush') {
      // Climax Overload Boss Core (`[Fix 4]` exact reticle lock-on formula)
      const rushWorldX =
        !target.resolved && audioSec >= target.timeSec
          ? Math.min(
              target.endWorldX ?? target.worldX,
              Math.max(target.worldX, cameraX + state.reticleScreenX)
            )
          : target.worldX;
      const rushSx = worldToScreenX(rushWorldX);
      const rushSy = baseScreenY;
      const hitRatio = Math.min(
        1,
        (target.rushHits ?? 0) / Math.max(1, target.rushTargetHits ?? 6)
      );
      const isLocked =
        !target.resolved &&
        audioSec >= target.timeSec &&
        audioSec <= (target.endTimeSec ?? target.timeSec);
      const frenzy =
        (1 + hitRatio * 0.44) *
        (1 + Math.sin(state.timeSec * (14 + hitRatio * 26)) * (0.05 + hitRatio * 0.08));
      const bossR = Math.max(6, ts(Math.max(28, target.radius) * frenzy));
      const spin = state.timeSec * (2.8 + hitRatio * 6.8);

      if (activeRushGlow === null || (isLocked && !activeRushGlow.locked)) {
        activeRushGlow = {
          cx: rushSx,
          cy: rushSy,
          radius: bossR * 2.35,
          locked: isLocked,
        };
      }

      // Multi-ring rotating boss core: Gold outer star-shield + Crimson inner hex + Cyan wing ring + White reactor
      appendStarPath(shapes.bandTreble, rushSx, rushSy, bossR * 1.34, bossR * 0.94, 8, spin);
      appendRegularPolygonPath(shapes.bandTreble, rushSx, rushSy, bossR * 0.78, 8, spin, false);
      hasTreble = true;

      appendHollowPolygonRing(
        shapes.bandBass,
        rushSx,
        rushSy,
        bossR * 0.76,
        bossR * 0.56,
        6,
        -spin * 1.35
      );
      hasBass = true;

      appendHollowPolygonRing(
        shapes.bandSynth,
        rushSx,
        rushSy,
        bossR * 1.06,
        bossR * 0.92,
        4,
        spin * 1.65
      );
      hasSynth = true;

      const coreScale = 0.38 + hitRatio * 0.28;
      appendStarPath(
        shapes.gimmicks,
        rushSx,
        rushSy,
        bossR * (coreScale + 0.18),
        bossR * coreScale * 0.55,
        4,
        -spin * 2.1
      );
      shapes.gimmicks.appendCircle(
        rushSx,
        rushSy,
        bossR * coreScale * 0.75,
        bossR * coreScale * 0.75
      );
      hasWhiteCore = true;

      if (isLocked || hitRatio > 0) {
        shapes.reticles.appendCircle(rushSx, rushSy, bossR * 1.52, bossR * 1.52);
        shapes.reticles
          .moveTo(rushSx, yHigh)
          .lineTo(rushSx, rushSy - bossR * 1.1)
          .moveTo(rushSx, rushSy + bossR * 1.1)
          .lineTo(rushSx, yLow);

        if (bestTrimCandidate === null || bestTrimCandidate.priority > 2) {
          bestTrimCandidate = {
            priority: 2,
            progress: Math.max(0.08, Math.min(1, hitRatio)),
            strokeWidth: 3.8,
            color: [255, 234, 75, 250],
            circles: [[rushSx, rushSy, Math.max(8, bossR * 1.72)]],
          };
        }
      }
      continue;
    }

    if (target.kind === 'sawblade') {
      // 1F Spinning Crimson-Orange Serrated Vector Sawblade (`shapes.traps`)
      const sx = worldToScreenX(target.worldX);
      const spin = -state.timeSec * 11.5 + target.id;
      appendSerratedSawblade(shapes.traps, sx, baseScreenY, rad, spin);
      hasTraps = true;
      // Orange-gold friction heat hub ring
      appendHollowPolygonRing(shapes.bandTreble, sx, baseScreenY, rad * 0.50, rad * 0.32, 6, spin);
      hasTreble = true;
      continue;
    }

    if (target.kind === 'mine') {
      // 2F Spiked Violet-Crimson Plasma Mine (`shapes.traps`)
      const sx = worldToScreenX(target.worldX);
      const spin = state.timeSec * 2.6 + target.id * 0.8;
      appendStarPath(shapes.traps, sx, baseScreenY, rad * 1.32, rad * 0.62, 8, spin);
      appendRegularPolygonPath(shapes.traps, sx, baseScreenY, rad * 0.34, 8, spin, false);
      hasTraps = true;
      // Unstable cyan-violet inner plasma spark so 2F mine contrasts sharply with 2F cyan drone
      appendRegularPolygonPath(shapes.bandSynth, sx, baseScreenY, rad * 0.28, 4, -spin * 2, true);
      hasSynth = true;
    }
  }

  // 4. RadialGradient Plasma Core Glow (`shapes.coreGlow` — one-shot ownership transfer)
  if (activeRushGlow !== null) {
    const glowR = Math.max(12, activeRushGlow.radius);
    const radGrad = new shapes.tvg.RadialGradient(activeRushGlow.cx, activeRushGlow.cy, glowR);
    radGrad.setStops(
      [0, [255, 250, 210, 170]],
      [0.48, [255, 210, 40, 88]],
      [1, [255, 42, 109, 0]]
    );
    shapes.coreGlow.appendCircle(activeRushGlow.cx, activeRushGlow.cy, glowR, glowR).fill(radGrad);
  } else if (isOverdrive || combo >= 25) {
    const pCx = tx(state.playerScreenX);
    const pCy = ty(state.playerScreenY);
    const auraR = Math.max(18, ts(state.playerRadius * (isOverdrive ? 3.2 : 2.4)));
    const [ar, ag, ab] = isOverdrive ? [255, 232, 85] : [fr, fg, fb];
    const radGrad = new shapes.tvg.RadialGradient(pCx, pCy, auraR);
    radGrad.setStops(
      [0, [255, 255, 240, isOverdrive ? 128 : 86]],
      [0.45, [ar, ag, ab, isOverdrive ? 76 : 48]],
      [1, [ar, ag, ab, 0]]
    );
    shapes.coreGlow.appendCircle(pCx, pCy, auraR, auraR).fill(radGrad);
  }

  // 5. Progressive Circular Arc Gauge (`shapes.trimArcs` via `Shape.trimPath(0, progress, true)`)
  if (bestTrimCandidate !== null) {
    for (let cIdx = 0; cIdx < bestTrimCandidate.circles.length; cIdx++) {
      const [cx, cy, cr] = bestTrimCandidate.circles[cIdx]!;
      shapes.trimArcs.appendCircle(cx, cy, cr, cr);
    }
    shapes.trimArcs
      .trimPath(0, bestTrimCandidate.progress, true)
      .fill(0, 0, 0, 0)
      .stroke({
        width: tw(bestTrimCandidate.strokeWidth),
        color: bestTrimCandidate.color,
        cap: roundCap,
        join: roundJoin,
      });
  }

  // 6. Commit Paint Styles Deterministically Across All World Layers
  if (hasBass) {
    shapes.bandBass
      .fill(255, 42, 109, 240)
      .stroke({
        width: tw(isOverdrive ? 2.6 : 2.2),
        color: isOverdrive ? [255, 240, 150, 255] : [255, 228, 238, 250],
        cap: roundCap,
        join: roundJoin,
      });
  }
  if (hasSynth) {
    shapes.bandSynth
      .fill(5, 213, 255, 240)
      .stroke({
        width: tw(isOverdrive ? 2.6 : 2.2),
        color: isOverdrive ? [255, 240, 150, 255] : [225, 252, 255, 250],
        cap: roundCap,
        join: roundJoin,
      });
  }
  if (hasTreble) {
    shapes.bandTreble
      .fill(255, 226, 24, 244)
      .stroke({
        width: tw(2.5),
        color: [255, 252, 215, 255],
        cap: roundCap,
        join: roundJoin,
      });
  }
  if (hasWhiteCore) {
    shapes.gimmicks
      .fill(255, 255, 255, 250)
      .stroke({
        width: tw(1.5),
        color: [215, 248, 255, 242],
        cap: roundCap,
        join: roundJoin,
      });
  }
  if (hasPrismStars) {
    shapes.prismStars
      .fill(255, 232, 62, 246)
      .stroke({ width: tw(2.3), color: [255, 255, 230, 255], cap: roundCap, join: roundJoin });
  }
  if (hasTimingRings) {
    shapes.timingRings
      .fill(0, 0, 0, 0)
      .stroke({ width: tw(2.1), color: [210, 248, 255, 215], cap: roundCap, join: roundJoin });
  }
  if (hasTraps) {
    shapes.traps
      .fill(250, 48, 76, 242)
      .stroke({ width: tw(2.1), color: [255, 212, 185, 255], cap: roundCap, join: roundJoin });
  }

  // Reticles additive plasma glow tinted toward active lane & beat pulse
  const retGlowBoost = Math.min(1, Math.max(pulseHigh, pulseLow, beatEnergy * 0.65));
  const retColor: [number, number, number] = isOverdrive
    ? [255, 235, 130]
    : isHighActive
      ? [115, 236, 255]
      : [255, 118, 168];
  shapes.reticles
    .fill(0, 0, 0, 0)
    .stroke({
      width: tw(1.8 + retGlowBoost * 1.4),
      color: [retColor[0], retColor[1], retColor[2], Math.round(148 + retGlowBoost * 102)],
      cap: roundCap,
      join: roundJoin,
    });
}
