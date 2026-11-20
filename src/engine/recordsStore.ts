import {
  CREWMATE_SKIN_ORDER,
  type CrewmateSkinId,
  type DifficultyMode,
  type HUDTelemetry,
  type ResultRank,
  type SfxMode,
  type TrackMetadata,
  type TrackRecord,
} from '../types/game';

const RECORDS_STORAGE_KEY = 'thorvg_run:records:v2';
const SFX_MODE_STORAGE_KEY = 'thorvg_run:sfx_mode:v1';
const BGM_VOLUME_STORAGE_KEY = 'thorvg_run:bgm_volume:v1';
const SFX_VOLUME_STORAGE_KEY = 'thorvg_run:sfx_volume:v1';
const REDUCED_MOTION_STORAGE_KEY = 'thorvg_run:reduced_motion:v1';
const SELECTED_SKIN_KEY = 'thorvg_run:selected_skin:v1';
const AUDIO_OFFSET_MS_KEY = 'thorvg_run:audio_offset_ms:v1';
const GUIDE_DISMISSED_KEY = 'thorvg_run:guide_dismissed:v1';
const SELECTED_TRACK_KEY = 'thorvg_run:selected_track:v1';

const RANK_WEIGHT: Record<ResultRank, number> = {
  S: 4,
  A: 3,
  B: 2,
  C: 1,
};

function buildTrackKey(track: TrackMetadata, difficulty: DifficultyMode): string {
  const baseId = track.isCustom
    ? `custom:${track.title.trim().toLowerCase()}:${Math.round(track.durationSec)}`
    : track.id;
  return `${baseId}::${difficulty}`;
}

function readAllRecords(): Record<string, TrackRecord> {
  try {
    const raw = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, TrackRecord>;
    }
  } catch {
    // Ignore storage access errors in private/restricted contexts
  }
  return {};
}

function writeAllRecords(records: Record<string, TrackRecord>): void {
  try {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore quota/storage errors
  }
}

export function getTrackRecord(
  track: TrackMetadata,
  difficulty: DifficultyMode
): TrackRecord | null {
  const all = readAllRecords();
  return all[buildTrackKey(track, difficulty)] ?? null;
}

export function saveTrackRunResult(
  track: TrackMetadata,
  difficulty: DifficultyMode,
  hud: Pick<
    HUDTelemetry,
    | 'score'
    | 'rank'
    | 'accuracy'
    | 'maxCombo'
    | 'starsCollected'
    | 'judgmentCounts'
    | 'orbsCollected'
    | 'totalOrbs'
  >
): { record: TrackRecord; isNewRecord: boolean; scoreDelta: number } {
  const all = readAllRecords();
  const key = buildTrackKey(track, difficulty);
  const prev = all[key];

  const runScore = Math.max(0, Math.floor(hud.score));
  const runRank: ResultRank = hud.rank ?? 'B';
  const runAcc = hud.accuracy ?? 0;
  const runCombo = hud.maxCombo ?? 0;
  const runStars = hud.starsCollected ?? 0;

  const counts = hud.judgmentCounts;
  const judgedHits =
    (counts?.perfect ?? 0) + (counts?.great ?? 0) + (counts?.good ?? 0);
  const expectedTargets = hud.totalOrbs ?? 0;
  const allTargetsCleared =
    expectedTargets > 0
      ? (hud.orbsCollected ?? judgedHits) >= expectedTargets &&
        judgedHits >= expectedTargets
      : judgedHits > 0;
  const runNoMiss = (counts?.miss ?? 0) === 0 && allTargetsCleared;

  const isNewRecord = !prev || runScore > prev.bestScore;
  const scoreDelta = prev ? runScore - prev.bestScore : runScore;

  const next: TrackRecord = {
    bestScore: prev ? Math.max(prev.bestScore, runScore) : runScore,
    bestRank:
      prev && RANK_WEIGHT[prev.bestRank] > RANK_WEIGHT[runRank] ? prev.bestRank : runRank,
    bestAccuracy: prev ? Math.max(prev.bestAccuracy, runAcc) : runAcc,
    maxCombo: prev ? Math.max(prev.maxCombo, runCombo) : runCombo,
    bestStars: prev ? Math.max(prev.bestStars, runStars) : runStars,
    noMissCleared: Boolean(prev?.noMissCleared || runNoMiss),
    clearCount: (prev?.clearCount ?? 0) + 1,
  };

  all[key] = next;
  writeAllRecords(all);
  return { record: next, isNewRecord, scoreDelta };
}

export function loadSfxMode(): SfxMode {
  try {
    const raw = window.localStorage.getItem(SFX_MODE_STORAGE_KEY);
    if (raw === 'full' || raw === 'impact' || raw === 'off') {
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return 'full';
}

export function saveSfxMode(mode: SfxMode): void {
  try {
    window.localStorage.setItem(SFX_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function nextSfxMode(current: SfxMode): SfxMode {
  if (current === 'full') return 'impact';
  if (current === 'impact') return 'off';
  return 'full';
}

function clampAudioOffsetInt(offsetMs: number): number {
  if (!Number.isFinite(offsetMs)) return 0;
  const rounded = Math.round(offsetMs);
  const clamped = Math.max(-150, Math.min(150, rounded));
  return clamped === 0 ? 0 : clamped;
}

export function loadAudioOffsetMs(): number {
  try {
    const raw = window.localStorage.getItem(AUDIO_OFFSET_MS_KEY);
    if (raw !== null && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return clampAudioOffsetInt(parsed);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 0;
}

export function saveAudioOffsetMs(offsetMs: number): number {
  const clamped = clampAudioOffsetInt(offsetMs);
  try {
    window.localStorage.setItem(AUDIO_OFFSET_MS_KEY, String(clamped));
  } catch {
    // Ignore storage errors
  }
  return clamped;
}

function isValidSkinId(v: unknown): v is CrewmateSkinId {
  return (
    typeof v === 'string' &&
    (CREWMATE_SKIN_ORDER as readonly string[]).includes(v)
  );
}

export function loadSelectedSkin(): CrewmateSkinId {
  try {
    const raw = window.localStorage.getItem(SELECTED_SKIN_KEY);
    if (isValidSkinId(raw)) {
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return 'classic';
}

export function saveSelectedSkin(skinId: CrewmateSkinId): CrewmateSkinId {
  const safeSkin: CrewmateSkinId = isValidSkinId(skinId) ? skinId : 'classic';
  try {
    window.localStorage.setItem(SELECTED_SKIN_KEY, safeSkin);
  } catch {
    // Ignore storage errors
  }
  return safeSkin;
}

export function loadGuideDismissed(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveGuideDismissed(dismissed: boolean): void {
  try {
    if (dismissed) {
      window.localStorage.setItem(GUIDE_DISMISSED_KEY, '1');
    } else {
      window.localStorage.removeItem(GUIDE_DISMISSED_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadSelectedTrackId(): string | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_TRACK_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function saveSelectedTrackId(trackId: string): void {
  if (!trackId) return;
  try {
    window.localStorage.setItem(SELECTED_TRACK_KEY, trackId);
  } catch {
    // Ignore storage errors
  }
}

function clampUnitVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1.0;
  const clamped = Math.max(0, Math.min(1, volume));
  return Math.round(clamped * 100) / 100;
}

export function loadBgmVolume(): number {
  try {
    const raw = window.localStorage.getItem(BGM_VOLUME_STORAGE_KEY);
    if (raw !== null && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return clampUnitVolume(parsed);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 1.0;
}

export function saveBgmVolume(volume: number): number {
  const clamped = clampUnitVolume(volume);
  try {
    window.localStorage.setItem(BGM_VOLUME_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage errors
  }
  return clamped;
}

export function loadSfxVolume(): number {
  try {
    const raw = window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY);
    if (raw !== null && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return clampUnitVolume(parsed);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 1.0;
}

export function saveSfxVolume(volume: number): number {
  const clamped = clampUnitVolume(volume);
  try {
    window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(clamped));
  } catch {
    // Ignore storage errors
  }
  return clamped;
}

export function hasExplicitReducedMotionPref(): boolean {
  try {
    const raw = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    return raw === '1' || raw === '0';
  } catch {
    return false;
  }
}

export function loadReducedMotion(): boolean {
  try {
    const raw = window.localStorage.getItem(REDUCED_MOTION_STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // Ignore storage errors
  }
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch {
    // Ignore matchMedia errors
  }
  return false;
}

export function saveReducedMotion(enabled: boolean): boolean {
  const next = Boolean(enabled);
  try {
    window.localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, next ? '1' : '0');
  } catch {
    // Ignore storage errors
  }
  return next;
}
