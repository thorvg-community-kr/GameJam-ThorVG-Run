import type {
  AudioSlice,
  LoadingProgress,
  ResonanceFormType,
  SectionIntensity,
} from '../../types/game';

export const SLICE_DURATION_SEC = 0.25;

const FFT_SIZE = 1024;
const HALF_FFT = FFT_SIZE >>> 1; // 512
const FFT_TABLES: {
  hann: Float32Array;
  bitRev: Uint16Array;
  cosTable: Float32Array;
  sinTable: Float32Array;
} = (() => {
  const hann = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }

  const bitRev = new Uint16Array(FFT_SIZE);
  const bits = 10; // 2^10 = 1024
  for (let i = 0; i < FFT_SIZE; i++) {
    let rev = 0;
    let v = i;
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (v & 1);
      v >>>= 1;
    }
    bitRev[i] = rev;
  }

  const cosTable = new Float32Array(HALF_FFT);
  const sinTable = new Float32Array(HALF_FFT);
  for (let i = 0; i < HALF_FFT; i++) {
    const angle = (-2 * Math.PI * i) / FFT_SIZE;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }

  return { hann, bitRev, cosTable, sinTable };
})();

/**
 * In-place Radix-2 Cooley-Tukey 1024-pt FFT (zero heap allocations per frame).
 */
function fft1024InPlace(re: Float32Array, im: Float32Array): void {
  const { bitRev, cosTable, sinTable } = FFT_TABLES;
  for (let i = 0; i < FFT_SIZE; i++) {
    const j = bitRev[i]!;
    if (j > i) {
      const tr = re[i]!;
      const ti = im[i]!;
      re[i] = re[j]!;
      im[i] = im[j]!;
      re[j] = tr;
      im[j] = ti;
    }
  }

  for (let size = 2; size <= FFT_SIZE; size <<= 1) {
    const half = size >>> 1;
    const tableStep = FFT_SIZE / size;
    for (let base = 0; base < FFT_SIZE; base += size) {
      let twiddleIdx = 0;
      for (let k = 0; k < half; k++) {
        const i0 = base + k;
        const i1 = i0 + half;
        const wr = cosTable[twiddleIdx]!;
        const wi = sinTable[twiddleIdx]!;
        const r1 = re[i1]!;
        const m1 = im[i1]!;
        const tr = wr * r1 - wi * m1;
        const ti = wr * m1 + wi * r1;
        re[i1] = re[i0]! - tr;
        im[i1] = im[i0]! - ti;
        re[i0] = re[i0]! + tr;
        im[i0] = im[i0]! + ti;
        twiddleIdx += tableStep;
      }
    }
  }
}

export interface DifficultyDspTuning {
  minBeatGapSec: number;
  fluxGate: number;
  madMultiplier?: number;
}

export interface DetectedBeatEvent {
  timeSec: number;
  worldX: number;
  strength: number;
  kickStrength: number;
  lowMidStrength: number;
  midHighStrength: number;
  hatStrength: number;
  sustainSec: number;
  isDownbeat: boolean;
  centroidNorm: number;
  band: ResonanceFormType;
  intensity: SectionIntensity;
}

export interface DspAnalysisResult {
  bpm: number;
  beatPhaseSec: number;
  durationSec: number;
  totalSlices: number;
  slices: AudioSlice[];
  beatEvents: DetectedBeatEvent[];
  sliceHasBeat: Set<number>;
  sliceIntensity: SectionIntensity[];
  sliceBand: ResonanceFormType[];
  sectionCounts: Record<SectionIntensity, number>;
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function percentileSafe(values: ArrayLike<number>, q: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * q)));
  const val = sorted[idx] ?? 0;
  return Number.isFinite(val) ? val : 0;
}

function medianOfSorted(sorted: readonly number[]): number {
  const len = sorted.length;
  if (len === 0) return 0;
  const mid = len >>> 1;
  if ((len & 1) === 1) {
    return sorted[mid]!;
  }
  return 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

function dominantBandOf(low: number, mid: number, high: number): ResonanceFormType {
  return low >= mid && low >= high ? 'bass' : mid >= high ? 'synth' : 'treble';
}

function estimateBpmAndPhase(
  pulseEnv: Float32Array,
  hopSec: number,
  durationSec: number
): { bpm: number; beatPhaseSec: number } {
  const numFrames = pulseEnv.length;
  if (numFrames < 20 || !Number.isFinite(hopSec) || hopSec <= 0) {
    return { bpm: 128, beatPhaseSec: 0 };
  }

  let mean = 0;
  for (let i = 0; i < numFrames; i++) {
    mean += pulseEnv[i]!;
  }
  mean /= numFrames;

  let energy = 0;
  const centered = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const v = Math.max(0, pulseEnv[i]! - mean * 0.65);
    centered[i] = v;
    energy += v * v;
  }

  // [Fix 5] Guard zero/silent/constant buffers against NaN
  if (!Number.isFinite(energy) || energy < 1e-7) {
    return { bpm: 128, beatPhaseSec: 0 };
  }

  const minLag = Math.max(2, Math.round(60 / 185 / hopSec));
  const maxLag = Math.min(numFrames - 3, Math.round(60 / 85 / hopSec));
  if (maxLag <= minLag) {
    return { bpm: 128, beatPhaseSec: 0 };
  }

  const corr = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const limit = numFrames - lag;
    for (let i = 0; i < limit; i++) {
      sum += centered[i]! * centered[i + lag]!;
    }
    const norm = limit > 0 ? sum / limit : 0;
    corr[lag] = Number.isFinite(norm) ? norm : 0;
  }

  let bestLag = Math.round(60 / 128 / hopSec);
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const candBpm = 60 / (lag * hopSec);
    // Gentle Gaussian tempo prior around 128 BPM + 2x harmonic reinforcement
    const logRatio = Math.log2(candBpm / 128);
    const prior = Math.exp(-0.5 * (logRatio / 0.55) * (logRatio / 0.55));
    let harmonic = corr[lag]!;
    const doubleLag = lag * 2;
    if (doubleLag <= maxLag) {
      harmonic += 0.42 * corr[doubleLag]!;
    } else if (doubleLag < numFrames - 2) {
      let sum2 = 0;
      const lim2 = numFrames - doubleLag;
      for (let i = 0; i < lim2; i++) {
        sum2 += centered[i]! * centered[i + doubleLag]!;
      }
      if (lim2 > 0) harmonic += 0.42 * (sum2 / lim2);
    }
    const score = harmonic * (0.72 + 0.28 * prior);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (!Number.isFinite(bestScore) || bestScore <= 1e-9) {
    return { bpm: 128, beatPhaseSec: 0 };
  }

  let rawBpm = 60 / (bestLag * hopSec);
  while (rawBpm < 85) rawBpm *= 2;
  while (rawBpm > 185) rawBpm *= 0.5;
  const bpm = Math.max(85, Math.min(185, Math.round(rawBpm)));
  const beatSec = 60 / bpm;

  // Phase grid search over [0, beatSec)
  const phaseSteps = 48;
  let bestPhaseSec = 0;
  let bestPhaseScore = -1;
  const maxBeatsToCheck = Math.max(1, Math.floor(durationSec / beatSec));

  for (let p = 0; p < phaseSteps; p++) {
    const candPhase = (p / phaseSteps) * beatSec;
    let pScore = 0;
    for (let k = 0; k <= maxBeatsToCheck; k++) {
      const t = candPhase + k * beatSec;
      const fIdx = Math.round(t / hopSec);
      if (fIdx < 0 || fIdx >= numFrames) continue;
      const center = centered[fIdx]!;
      const left = fIdx > 0 ? centered[fIdx - 1]! * 0.5 : 0;
      const right = fIdx + 1 < numFrames ? centered[fIdx + 1]! * 0.5 : 0;
      pScore += center + left + right;
    }
    if (pScore > bestPhaseScore) {
      bestPhaseScore = pScore;
      bestPhaseSec = candPhase;
    }
  }

  if (!Number.isFinite(bestPhaseScore) || bestPhaseScore < 1e-7) {
    bestPhaseSec = 0;
  }

  return { bpm, beatPhaseSec: bestPhaseSec };
}

/**
 * Stage 1 & 2 DSP Pipeline (`rhythm-slasher-v6` — 4-Band Hann STFT `SuperFlux`):
 * - 1024-pt Hann STFT (`~10ms` hop) + in-place Radix-2 FFT
 * - Log-magnitude compression `ln(1 + 40 * mag)`, 3-bin frequency max-filter, 2-frame lag `SuperFlux`
 *   across 4 perceptual bands:
 *   1. `kickFlux` (`35–140Hz`)
 *   2. `lowMidFlux` (`140–500Hz`)
 *   3. `midHighFlux` (`500–4500Hz` — Snare / Rap vocals / Synth lead)
 *   4. `hatFlux` (`4500–12000Hz` — Hi-Hat / Cymbal transients)
 * - Autocorrelation BPM (`85..185` folded) + beat phase estimation with silent-buffer `NaN` protection
 * - Sliding Median/MAD peak picking + 3-point parabolic sub-frame interpolation + `1/4` & `1/3` hybrid beat-grid soft-snap
 */
export async function extractAudioSlicesAndBeats(
  buffer: AudioBuffer,
  worldPxPerSec: number,
  tuning: DifficultyDspTuning,
  onProgress?: (status: LoadingProgress) => void
): Promise<DspAnalysisResult> {
  const segWidth = worldPxPerSec * SLICE_DURATION_SEC;
  const sampleRate = Math.max(8000, buffer.sampleRate || 44100);
  const totalSamples = buffer.length;
  const durationSec = Math.max(0.1, buffer.duration || totalSamples / sampleRate);
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

  const hopSamples = Math.max(128, Math.round(sampleRate * 0.01));
  const hopSec = hopSamples / sampleRate;
  const numFrames = Math.max(
    8,
    Math.ceil(Math.max(1, totalSamples - FFT_SIZE) / hopSamples) + 1
  );

  const binHz = sampleRate / FFT_SIZE;
  const clampBin = (hz: number): number =>
    Math.max(1, Math.min(HALF_FFT - 1, Math.round(hz / binHz)));

  // 4 SuperFlux bands
  const bKick0 = clampBin(35);
  const bKick1 = Math.max(bKick0, clampBin(140));
  const bLowMid0 = Math.min(HALF_FFT - 1, bKick1 + 1);
  const bLowMid1 = Math.max(bLowMid0, clampBin(500));
  const bMidHigh0 = Math.min(HALF_FFT - 1, bLowMid1 + 1);
  const bMidHigh1 = Math.max(bMidHigh0, clampBin(4500));
  const bHat0 = Math.min(HALF_FFT - 1, bMidHigh1 + 1);
  const bHat1 = Math.max(bHat0, clampBin(12000));

  // 3 visual slice bands (20-250Hz, 250-4000Hz, 4000-16000Hz)
  const vLow0 = clampBin(20);
  const vLow1 = Math.max(vLow0, clampBin(250));
  const vMid0 = Math.min(HALF_FFT - 1, vLow1 + 1);
  const vMid1 = Math.max(vMid0, clampBin(4000));
  const vHigh0 = Math.min(HALF_FFT - 1, vMid1 + 1);
  const vHigh1 = Math.max(vHigh0, clampBin(16000));

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const curLogSpec = new Float32Array(HALF_FFT);
  let maxSpecLag2 = new Float32Array(HALF_FFT);
  let maxSpecLag1 = new Float32Array(HALF_FFT);
  let curMaxSpec = new Float32Array(HALF_FFT);

  const rawKickFlux = new Float32Array(numFrames);
  const rawLowMidFlux = new Float32Array(numFrames);
  const rawMidHighFlux = new Float32Array(numFrames);
  const rawHatFlux = new Float32Array(numFrames);

  const frameLowE = new Float32Array(numFrames);
  const frameMidE = new Float32Array(numFrames);
  const frameHighE = new Float32Array(numFrames);
  const frameCentroid = new Float32Array(numFrames);

  const LOG_CENTROID_MIN = Math.log2(80);
  const INV_LOG_CENTROID_SPAN = 1 / (Math.log2(8000) - LOG_CENTROID_MIN);

  const { hann } = FFT_TABLES;
  const invSqrtN = 1 / Math.sqrt(FFT_SIZE); // 1/32 unitary FFT normalization

  for (let f = 0; f < numFrames; f++) {
    const startSample = f * hopSamples;
    for (let i = 0; i < FFT_SIZE; i++) {
      const sIdx = startSample + i;
      if (sIdx < totalSamples) {
        const mono = ch1 ? (ch0[sIdx]! + ch1[sIdx]!) * 0.5 : ch0[sIdx]!;
        re[i] = mono * hann[i]!;
      } else {
        re[i] = 0;
      }
      im[i] = 0;
    }

    fft1024InPlace(re, im);

    let sumVisLow = 0;
    let sumVisMid = 0;
    let sumVisHigh = 0;
    let sumCentroidPower = 0;
    let sumCentroidWeightedLog = 0;

    for (let b = 1; b < HALF_FFT; b++) {
      const mag = Math.hypot(re[b]!, im[b]!) * invSqrtN;
      curLogSpec[b] = Math.log(1 + 40 * mag);

      const freqHz = b * binHz;
      if (freqHz >= 80 && freqHz <= 8000) {
        const power = mag * mag;
        sumCentroidPower += power;
        sumCentroidWeightedLog += power * Math.log2(freqHz);
      }

      if (b >= vLow0 && b <= vLow1) sumVisLow += mag;
      else if (b >= vMid0 && b <= vMid1) sumVisMid += mag;
      else if (b >= vHigh0 && b <= vHigh1) sumVisHigh += mag;
    }

    frameLowE[f] = sumVisLow / Math.max(1, vLow1 - vLow0 + 1);
    frameMidE[f] = sumVisMid / Math.max(1, vMid1 - vMid0 + 1);
    frameHighE[f] = sumVisHigh / Math.max(1, vHigh1 - vHigh0 + 1);
    frameCentroid[f] =
      sumCentroidPower > 1e-12
        ? Math.max(
            0,
            Math.min(
              1,
              (sumCentroidWeightedLog / sumCentroidPower - LOG_CENTROID_MIN) *
                INV_LOG_CENTROID_SPAN
            )
          )
        : 0.5;

    // 3-bin frequency max-filter for vibrato/808 pitch-slide suppression
    for (let b = 1; b < HALF_FFT; b++) {
      const left = curLogSpec[b > 1 ? b - 1 : 1]!;
      const center = curLogSpec[b]!;
      const right = curLogSpec[b + 1 < HALF_FFT ? b + 1 : HALF_FFT - 1]!;
      curMaxSpec[b] = Math.max(left, center, right);
    }

    // 2-frame lag SuperFlux across 4 bands
    if (f >= 2) {
      let kf = 0;
      for (let b = bKick0; b <= bKick1; b++) {
        const diff = curLogSpec[b]! - maxSpecLag2[b]!;
        if (diff > 0) kf += diff;
      }
      rawKickFlux[f] = kf / Math.max(1, bKick1 - bKick0 + 1);

      let lmf = 0;
      for (let b = bLowMid0; b <= bLowMid1; b++) {
        const diff = curLogSpec[b]! - maxSpecLag2[b]!;
        if (diff > 0) lmf += diff;
      }
      rawLowMidFlux[f] = lmf / Math.max(1, bLowMid1 - bLowMid0 + 1);

      let mhf = 0;
      for (let b = bMidHigh0; b <= bMidHigh1; b++) {
        const diff = curLogSpec[b]! - maxSpecLag2[b]!;
        if (diff > 0) mhf += diff;
      }
      rawMidHighFlux[f] = mhf / Math.max(1, bMidHigh1 - bMidHigh0 + 1);

      let hf = 0;
      for (let b = bHat0; b <= bHat1; b++) {
        const diff = curLogSpec[b]! - maxSpecLag2[b]!;
        if (diff > 0) hf += diff;
      }
      rawHatFlux[f] = hf / Math.max(1, bHat1 - bHat0 + 1);
    }

    // Rotate lag buffers without allocating
    const recycle = maxSpecLag2;
    maxSpecLag2 = maxSpecLag1;
    maxSpecLag1 = curMaxSpec;
    curMaxSpec = recycle;

    if (f > 0 && f % 900 === 0) {
      onProgress?.({
        progress: 0.2 + (f / numFrames) * 0.35,
        stage: 'analyzingBands',
      });
      await nextFrame();
    }
  }

  // Safe 95th-percentile normalization ([Fix 5]: denom < 1e-7 guarded)
  const normOrOne = (arr: Float32Array): number => {
    const p = percentileSafe(arr, 0.95);
    return p < 1e-7 ? 1 : p;
  };

  const kickDenom = normOrOne(rawKickFlux);
  const lowMidDenom = normOrOne(rawLowMidFlux);
  const midHighDenom = normOrOne(rawMidHighFlux);
  const hatDenom = normOrOne(rawHatFlux);

  const lowEDenom = normOrOne(frameLowE);
  const midEDenom = normOrOne(frameMidE);
  const highEDenom = normOrOne(frameHighE);

  const nKick = new Float32Array(numFrames);
  const nLowMid = new Float32Array(numFrames);
  const nMidHigh = new Float32Array(numFrames);
  const nHat = new Float32Array(numFrames);

  const nLowE = new Float32Array(numFrames);
  const nMidE = new Float32Array(numFrames);
  const nHighE = new Float32Array(numFrames);
  const nOverallE = new Float32Array(numFrames);

  const combinedFlux = new Float32Array(numFrames);
  const onsetFlux = new Float32Array(numFrames);
  const pulseEnv = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const k = Math.min(1.5, rawKickFlux[f]! / kickDenom);
    const lm = Math.min(1.5, rawLowMidFlux[f]! / lowMidDenom);
    const mh = Math.min(1.5, rawMidHighFlux[f]! / midHighDenom);
    const h = Math.min(1.5, rawHatFlux[f]! / hatDenom);

    nKick[f] = Math.min(1.0, k);
    nLowMid[f] = Math.min(1.0, lm);
    nMidHigh[f] = Math.min(1.0, mh);
    nHat[f] = Math.min(1.0, h);

    // Balanced multi-band onset + dominant-band salience so solo vocal/guitar/snare transients stand out clearly
    const baseFlux = k * 0.34 + lm * 0.16 + mh * 0.34 + h * 0.16;
    const domBand = Math.max(k * 0.92, lm * 0.85, mh * 1.0, h * 0.82);
    combinedFlux[f] = baseFlux;
    onsetFlux[f] = baseFlux * 0.55 + domBand * 0.45;
    pulseEnv[f] = k * 0.48 + lm * 0.18 + mh * 0.26 + h * 0.08;

    const le = Math.min(1.0, frameLowE[f]! / lowEDenom);
    const me = Math.min(1.0, frameMidE[f]! / midEDenom);
    const he = Math.min(1.0, frameHighE[f]! / highEDenom);
    nLowE[f] = le;
    nMidE[f] = me;
    nHighE[f] = he;
    nOverallE[f] = Math.min(1.0, le * 0.45 + me * 0.35 + he * 0.2);
  }

  const { bpm, beatPhaseSec } = estimateBpmAndPhase(pulseEnv, hopSec, durationSec);
  const beatSec = 60 / bpm;
  const stepQuarter = beatSec / 4; // 16th-note grid
  const stepTriplet = beatSec / 3; // Triplet grid

  // Aggregate 0.25s slices for waveform minimap & section intensity classification
  const totalSlices = Math.max(8, Math.ceil(durationSec / SLICE_DURATION_SEC));
  const framesPerSlice = Math.max(1, Math.round(SLICE_DURATION_SEC / hopSec));
  const sliceLow: number[] = new Array(totalSlices).fill(0);
  const sliceMid: number[] = new Array(totalSlices).fill(0);
  const sliceHigh: number[] = new Array(totalSlices).fill(0);
  const sliceOverall: number[] = new Array(totalSlices).fill(0);

  for (let i = 0; i < totalSlices; i++) {
    const f0 = Math.min(numFrames - 1, i * framesPerSlice);
    const f1 = Math.min(numFrames, Math.max(f0 + 1, (i + 1) * framesPerSlice));
    let sl = 0;
    let sm = 0;
    let sh = 0;
    let cnt = 0;
    for (let f = f0; f < f1; f++) {
      sl += nLowE[f]!;
      sm += nMidE[f]!;
      sh += nHighE[f]!;
      cnt++;
    }
    if (cnt > 0) {
      sliceLow[i] = sl / cnt;
      sliceMid[i] = sm / cnt;
      sliceHigh[i] = sh / cnt;
      sliceOverall[i] = Math.min(
        1.0,
        sliceLow[i]! * 0.45 + sliceMid[i]! * 0.35 + sliceHigh[i]! * 0.2
      );
    }
  }

  const rollingEnergy: number[] = new Array(totalSlices).fill(0);
  const windowRadius = 6;
  for (let i = 0; i < totalSlices; i++) {
    let sum = 0;
    let cnt = 0;
    for (
      let k = Math.max(0, i - windowRadius);
      k <= Math.min(totalSlices - 1, i + windowRadius);
      k++
    ) {
      sum += sliceOverall[k]!;
      cnt++;
    }
    rollingEnergy[i] = cnt > 0 ? sum / cnt : 0.2;
  }

  const calmThreshold = Math.max(0.2, Math.min(0.44, percentileSafe(rollingEnergy, 0.32)));
  const dropThreshold = Math.max(
    calmThreshold + 0.12,
    Math.min(0.75, percentileSafe(rollingEnergy, 0.67))
  );

  const sectionCounts: Record<SectionIntensity, number> = { calm: 0, groove: 0, drop: 0 };
  const sliceIntensity: SectionIntensity[] = new Array(totalSlices).fill('groove');
  const sliceBand: ResonanceFormType[] = new Array(totalSlices).fill('synth');

  for (let i = 0; i < totalSlices; i++) {
    sliceBand[i] = dominantBandOf(sliceLow[i]!, sliceMid[i]!, sliceHigh[i]!);
    const roll = rollingEnergy[i]!;
    const inten: SectionIntensity =
      roll >= dropThreshold ? 'drop' : roll >= calmThreshold ? 'groove' : 'calm';
    sliceIntensity[i] = inten;
    sectionCounts[inten]++;
  }

  // Section- & tempo-aware sliding Median/MAD thresholding + parabolic peak + subtle micro-timing polish
  const isCasual = tuning.minBeatGapSec >= 0.24;
  const madMult = tuning.madMultiplier ?? 1.05;
  const onsetEdgeOffsetSec = (FFT_SIZE * 0.25) / sampleRate;
  const beatEvents: DetectedBeatEvent[] = [];
  const sliceHasBeat = new Set<number>();
  let lastAcceptedSec = -tuning.minBeatGapSec;

  const windowBuf: number[] = [];
  const absDevBuf: number[] = [];

  for (let f = 2; f < numFrames - 2; f++) {
    const y1 = onsetFlux[f]!;
    if (y1 <= 0 || y1 < tuning.fluxGate * 0.85) continue;

    const fSlice = Math.min(
      totalSlices - 1,
      Math.max(0, Math.floor((f * hopSec) / SLICE_DURATION_SEC))
    );
    const secInten = sliceIntensity[fSlice] ?? 'groove';
    const effectiveFluxGate =
      secInten === 'calm'
        ? tuning.fluxGate * 1.18
        : secInten === 'drop'
          ? tuning.fluxGate * 0.88
          : tuning.fluxGate;
    if (y1 < effectiveFluxGate) continue;

    const y0 = onsetFlux[f - 1]!;
    const y2 = onsetFlux[f + 1]!;
    if (y1 < y0 || y1 <= y2) continue;

    // Strictly clamped sliding Median/MAD window [max(0, f-50), min(numFrames-1, f+50)]
    const w0 = Math.max(0, f - 50);
    const w1 = Math.min(numFrames - 1, f + 50);
    windowBuf.length = 0;
    for (let w = w0; w <= w1; w++) {
      windowBuf.push(onsetFlux[w]!);
    }
    windowBuf.sort((a, b) => a - b);
    const med = medianOfSorted(windowBuf);

    absDevBuf.length = 0;
    for (let i = 0; i < windowBuf.length; i++) {
      absDevBuf.push(Math.abs(windowBuf[i]! - med));
    }
    absDevBuf.sort((a, b) => a - b);
    const mad = medianOfSorted(absDevBuf);

    const effectiveMadMult =
      secInten === 'calm'
        ? madMult * 1.12
        : secInten === 'drop'
          ? madMult * 0.88
          : madMult;
    const adaptiveThreshold =
      med + effectiveMadMult * Math.max(mad * 1.4826, 0.014) + effectiveFluxGate;
    if (y1 < adaptiveThreshold) continue;

    // 3-point parabolic sub-frame peak interpolation aligned to true attack edge
    const denom = y0 - 2 * y1 + y2;
    const subFrameDelta =
      Math.abs(denom) > 1e-7
        ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom))
        : 0;
    const rawTimeSec = Math.max(0, (f + subFrameDelta) * hopSec + onsetEdgeOffsetSec);

    // Gentle micro-timing jitter polish (<= 12ms -> 20% blend) preserving natural acoustic groove
    const gridQuarter =
      beatPhaseSec + Math.round((rawTimeSec - beatPhaseSec) / stepQuarter) * stepQuarter;
    const gridTriplet =
      beatPhaseSec + Math.round((rawTimeSec - beatPhaseSec) / stepTriplet) * stepTriplet;
    const nearestGrid =
      Math.abs(rawTimeSec - gridQuarter) <= Math.abs(rawTimeSec - gridTriplet)
        ? gridQuarter
        : gridTriplet;
    const gridErr = Math.abs(rawTimeSec - nearestGrid);
    const snappedTimeSec =
      gridErr <= 0.012 ? rawTimeSec * 0.8 + nearestGrid * 0.2 : rawTimeSec;

    const effectiveMinGap =
      secInten === 'calm'
        ? tuning.minBeatGapSec * 1.25
        : secInten === 'drop'
          ? isCasual
            ? Math.max(tuning.minBeatGapSec * 0.9, beatSec * 0.48)
            : Math.max(0.115, Math.min(tuning.minBeatGapSec * 0.85, beatSec * 0.44))
          : isCasual
            ? tuning.minBeatGapSec
            : Math.min(tuning.minBeatGapSec, beatSec * 0.46);

    if (snappedTimeSec <= 0.05 || snappedTimeSec >= durationSec - 0.08) continue;
    if (snappedTimeSec - lastAcceptedSec < effectiveMinGap) {
      // If significantly stronger than the immediately preceding onset within the gap, upgrade it
      const prev = beatEvents[beatEvents.length - 1];
      if (prev && y1 > prev.strength * 1.35 && snappedTimeSec - prev.timeSec < 0.065) {
        prev.timeSec = Number(snappedTimeSec.toFixed(4));
        prev.worldX = prev.timeSec * worldPxPerSec;
        prev.strength = Math.min(1.0, y1 * 0.82 + nOverallE[f]! * 0.28);
        prev.kickStrength = nKick[f]!;
        prev.lowMidStrength = nLowMid[f]!;
        prev.midHighStrength = nMidHigh[f]!;
        prev.hatStrength = nHat[f]!;
        prev.centroidNorm = frameCentroid[f]!;
        prev.band = dominantBandOf(
          nKick[f]! * 0.75 + nLowE[f]! * 0.25,
          nMidHigh[f]! * 0.7 + nMidE[f]! * 0.3,
          nHat[f]! * 0.75 + nHighE[f]! * 0.25
        );
        prev.intensity = secInten;
        lastAcceptedSec = prev.timeSec;
      }
      continue;
    }

    lastAcceptedSec = snappedTimeSec;
    const timeSec = Number(snappedTimeSec.toFixed(4));
    const sIdx = Math.min(totalSlices - 1, Math.max(0, Math.floor(timeSec / SLICE_DURATION_SEC)));
    sliceHasBeat.add(sIdx);

    // Estimate true tonal sustain length (gated on tonal continuity & stopped on re-attacks)
    const maxSustainFrames = Math.min(numFrames - 1 - f, Math.round(1.2 / hopSec));
    const tonalEnergy = Math.max(nLowE[f]! * 0.85, nMidE[f]!);
    const attackEnergy = Math.max(0.22, tonalEnergy);
    const tonalRatio =
      (nLowE[f]! * 0.8 + nMidE[f]! * 0.9) /
      Math.max(0.15, nLowE[f]! + nMidE[f]! + nHighE[f]!);
    let sustainFrames = 0;
    if (tonalRatio >= 0.44) {
      for (let sf = 1; sf <= maxSustainFrames; sf++) {
        const idx = f + sf;
        const curTonal = Math.max(nLowE[idx]! * 0.85, nMidE[idx]!);
        if (curTonal < attackEnergy * 0.58) {
          break;
        }
        const majorReattack =
          sf >= 5 &&
          onsetFlux[idx]! >= Math.max(tuning.fluxGate * 1.55, y1 * 0.65) &&
          Math.max(nKick[idx]!, nMidHigh[idx]!) >= 0.42;
        if (majorReattack) {
          break;
        }
        sustainFrames = sf;
      }
    }
    const sustainSec = sustainFrames * hopSec;

    const nearestBeatLine =
      beatPhaseSec + Math.round((timeSec - beatPhaseSec) / beatSec) * beatSec;
    const isDownbeat = Math.abs(timeSec - nearestBeatLine) <= 0.042;

    const band = dominantBandOf(
      nKick[f]! * 0.75 + nLowE[f]! * 0.25,
      nMidHigh[f]! * 0.7 + nMidE[f]! * 0.3,
      nHat[f]! * 0.75 + nHighE[f]! * 0.25
    );

    beatEvents.push({
      timeSec,
      worldX: timeSec * worldPxPerSec,
      strength: Math.min(1.0, y1 * 0.82 + nOverallE[f]! * 0.28),
      kickStrength: nKick[f]!,
      lowMidStrength: nLowMid[f]!,
      midHighStrength: nMidHigh[f]!,
      hatStrength: nHat[f]!,
      sustainSec,
      isDownbeat,
      centroidNorm: frameCentroid[f]!,
      band,
      intensity: sliceIntensity[sIdx] ?? 'groove',
    });
  }

  const slices: AudioSlice[] = [];
  for (let i = 0; i < totalSlices; i++) {
    slices.push({
      index: i,
      timeSec: i * SLICE_DURATION_SEC,
      worldX0: i * segWidth,
      worldX1: (i + 1) * segWidth,
      low: sliceLow[i]!,
      mid: sliceMid[i]!,
      high: sliceHigh[i]!,
      overall: sliceOverall[i]!,
      dominantBand: sliceBand[i]!,
      intensity: sliceIntensity[i]!,
      isBeatOnset: sliceHasBeat.has(i),
    });
  }

  return {
    bpm,
    beatPhaseSec,
    durationSec,
    totalSlices,
    slices,
    beatEvents,
    sliceHasBeat,
    sliceIntensity,
    sliceBand,
    sectionCounts,
  };
}
