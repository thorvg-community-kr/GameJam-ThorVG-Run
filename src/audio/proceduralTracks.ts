import ak47TrackUrl from '../asset/music/맨스티어 - AK47.mp3?url';
import day6TrackUrl from '../asset/music/DAY6- 한 페이지가 될 수 있게.mp3?url';
import daftPunkTrackUrl from '../asset/music/Daft Punk - Harder, Better, Faster, Stronger.mp3?url';
import jilpunggadoTrackUrl from '../asset/music/유정석 - 질풍가도 (쾌걸 근육맨 2세 1기 여는노래).mp3?url';
import type { TrackMetadata } from '../types/game';

export const BUILT_IN_TRACKS: TrackMetadata[] = [
  {
    id: 'mens-tear-ak47',
    title: 'Mens Tear - AK47',
    artist: 'Mens Tear',
    bpm: 128,
    durationSec: 167,
    isCustom: false,
    assetUrl: ak47TrackUrl,
  },
  {
    id: 'day6-time-of-our-life',
    title: 'DAY6 - Time of Our Life',
    artist: 'DAY6',
    bpm: 175,
    durationSec: 208,
    isCustom: false,
    assetUrl: day6TrackUrl,
  },
  {
    id: 'daft-punk-hbfs',
    title: 'Daft Punk - Harder, Better, Faster, Stronger',
    artist: 'Daft Punk',
    bpm: 123,
    durationSec: 226,
    isCustom: false,
    assetUrl: daftPunkTrackUrl,
  },
  {
    id: 'yoo-jeong-seok-jilpunggado',
    title: 'Yoo Jeong-seok - Jilpunggado',
    artist: 'Yoo Jeong-seok',
    bpm: 168,
    durationSec: 193,
    isCustom: false,
    assetUrl: jilpunggadoTrackUrl,
  },
];

/**
 * Minimal silent safety buffer used only if neither `assetUrl` nor an uploaded `File` is provided.
 */
export function createFallbackBuffer(ctx: BaseAudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.max(1, Math.floor(sampleRate * Math.max(1, durationSec)));
  return ctx.createBuffer(2, totalSamples, sampleRate);
}
