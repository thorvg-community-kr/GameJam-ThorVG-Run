import type { BannerMessage, TrackMetadata } from '../types/game';
import { formatMessage, type Messages } from './messages';

/** Resolves a language-agnostic engine banner into localized text. */
export function resolveBanner(
  t: Messages,
  banner: BannerMessage,
  isCoarsePointer: boolean = false
): string {
  const form = banner.params?.form;
  const formText = form ? t.forms[form] : null;
  const bonusVal = banner.params?.bonus;
  const touchTemplate =
    isCoarsePointer && Object.prototype.hasOwnProperty.call(t.bannerTouch, banner.key)
      ? t.bannerTouch[banner.key as keyof Messages['bannerTouch']]
      : undefined;
  const template = touchTemplate ?? t.banner[banner.key];
  return formatMessage(template, {
    form: formText?.name ?? '',
    band: formText?.band ?? '',
    count: banner.params?.count ?? 0,
    collected: banner.params?.collected ?? 0,
    total: banner.params?.total ?? 3,
    hits: banner.params?.hits ?? 0,
    bonus: bonusVal !== undefined ? bonusVal.toLocaleString() : 0,
    seconds: banner.params?.seconds ?? 0,
    mult: banner.params?.mult ?? 1,
    hp: banner.params?.hp ?? 0,
  });
}

type BuiltInTrackId = Exclude<keyof Messages['tracks'], 'customArtist'>;

function isBuiltInTrackId(t: Messages, id: string): id is BuiltInTrackId {
  return id !== 'customArtist' && Object.prototype.hasOwnProperty.call(t.tracks, id);
}

/** Built-in tracks use the localized dictionary name; custom tracks keep their file name. */
export function trackTitle(t: Messages, track: TrackMetadata): string {
  if (!track.isCustom && isBuiltInTrackId(t, track.id)) {
    return t.tracks[track.id].title;
  }
  return track.title;
}

export function trackArtist(t: Messages, track: TrackMetadata): string {
  if (!track.isCustom && isBuiltInTrackId(t, track.id)) {
    return t.tracks[track.id].artist;
  }
  return track.isCustom ? t.tracks.customArtist : track.artist;
}

/** Formats duration in seconds as `m:ss` (e.g. `167 -> "2:47"`, `226 -> "3:46"`). */
export function formatDurationMmSs(seconds: number): string {
  const safeTotal = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const mins = Math.floor(safeTotal / 60);
  const secs = safeTotal % 60;
  return `${mins}:${secs < 10 ? `0${secs}` : String(secs)}`;
}
