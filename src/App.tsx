import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import type { AudioFormat } from './audio/audioFormats';
import { BUILT_IN_TRACKS } from './audio/proceduralTracks';
import { InGameHUD } from './components/InGameHUD';
import { PauseOverlay } from './components/PauseOverlay';
import { ResultModal } from './components/ResultModal';
import { StartScreen, type MenuStep } from './components/StartScreen';
import { TrackLoadingModal } from './components/TrackLoadingModal';
import { GameEngine } from './engine/GameEngine';
import { InputController } from './engine/InputController';
import {
  hasExplicitReducedMotionPref,
  loadAudioOffsetMs,
  loadBgmVolume,
  loadGuideDismissed,
  loadReducedMotion,
  loadSelectedSkin,
  loadSelectedTrackId,
  loadSfxVolume,
  loadVideoBgEnabled,
  saveAudioOffsetMs,
  saveBgmVolume,
  saveReducedMotion,
  saveSelectedSkin,
  saveSelectedTrackId,
  saveSfxVolume,
  saveVideoBgEnabled,
} from './engine/recordsStore';
import { useCoarsePointer } from './hooks/useCoarsePointer';
import { trackTitle } from './i18n/display';
import { useI18n } from './i18n/I18nProvider';
import { ThorVGRenderer } from './renderer/ThorVGRenderer';
import {
  DIFFICULTY_CONFIG,
  type CrewmateSkinId,
  type DifficultyMode,
  type HUDTelemetry,
  type LoadingProgress,
  type RendererMode,
  type SlashLane,
  type TrackMetadata,
} from './types/game';

const CINEMATIC_STORAGE_KEY = 'thorvg-run:cinematic:v1';

function loadInitialCinematic(): boolean {
  try {
    const raw = window.localStorage.getItem(CINEMATIC_STORAGE_KEY);
    if (raw === '0' || raw === 'false') {
      return false;
    }
  } catch {
    // Ignore storage access errors (e.g. private browsing / restricted context).
  }
  return true;
}

function syncBgVideoTime(
  video: HTMLVideoElement,
  rawTargetSec: number,
  fallbackDurationSec: number,
  minDeltaSec: number = 0.002
): void {
  if (video.readyState < 1 || video.seeking || !Number.isFinite(rawTargetSec)) return;
  const hasFiniteVideoDur = Number.isFinite(video.duration) && video.duration > 0;
  const safeDur = hasFiniteVideoDur
    ? video.duration
    : Number.isFinite(fallbackDurationSec) && fallbackDurationSec > 0
      ? fallbackDurationSec
      : 0;
  if (
    hasFiniteVideoDur &&
    rawTargetSec >= video.duration - 0.02 &&
    (video.ended || video.currentTime >= video.duration - 0.08)
  ) {
    return;
  }
  const maxSeek = safeDur > 0 ? Math.max(0, safeDur - 0.01) : Math.max(0, rawTargetSec);
  const targetSec = Math.max(0, Math.min(maxSeek, rawTargetSec));
  if (!Number.isFinite(targetSec)) return;
  if (Math.abs(video.currentTime - targetSec) <= minDeltaSec) return;
  try {
    video.currentTime = targetSec;
  } catch {
    // Ignore transient browser media seek exceptions
  }
}

const INITIAL_HUD: HUDTelemetry = {
  rendererMode: 'sw',
  difficulty: 'standard',
  sfxMode: 'full',
  fps: 60,
  zoomDisplay: 1.0,
  cinematicCamera: true,
  score: 0,
  combo: 0,
  maxCombo: 0,
  progress: 0,
  activeForm: 'synth',
  resonanceGauge: 35,
  grooveHp: 100,
  maxGrooveHp: 100,
  overdriveReady: false,
  overdriveActive: false,
  statusBanner: null,
  isFinished: false,
  isFailed: false,
  trapsDestroyed: 0,
  surfMomentum: 0.25,
  speedMultiplier: 1.0,
  orbsCollected: 0,
  totalOrbs: 0,
  starsCollected: 0,
  totalStars: 3,
  sectionIntensity: 'calm',
  accuracy: 100,
  rank: 'S',
  judgment: null,
  judgmentCounts: { perfect: 0, great: 0, good: 0, miss: 0 },
  judgmentTelemetry: {
    criticalCount: 0,
    fastCount: 0,
    slowCount: 0,
    timedHitCount: 0,
    meanSignedDeltaMs: 0,
  },
  holdBreaks: 0,
  gimmicksTriggered: 0,
  isNewRecord: false,
  scoreDelta: 0,
  playerLane: 'low',
  highKeyFlash: false,
  lowKeyFlash: false,
  chordKeyFlash: false,
  rushCombo: 0,
  audioOffsetMs: 0,
  resumeCountdown: null,
};

type Screen = 'splash' | 'menu' | 'loading' | 'game';

export const App: React.FC = () => {
  const { t } = useI18n();
  const isCoarsePointer = useCoarsePointer();
  const [rendererMode, setRendererMode] = useState<RendererMode>('sw');
  const [selectedTrack, setSelectedTrack] = useState<TrackMetadata>(() => {
    const savedId = loadSelectedTrackId();
    return BUILT_IN_TRACKS.find((track) => track.id === savedId) ?? BUILT_IN_TRACKS[0]!;
  });
  const handleOpenGuide = useCallback(() => setIsGuideOpen(true), []);
  const handleCloseGuide = useCallback(() => setIsGuideOpen(false), []);
  const [customTracks, setCustomTracks] = useState<TrackMetadata[]>([]);
  const [cinematicCamera, setCinematicCamera] = useState<boolean>(() => loadInitialCinematic());
  const [difficulty, setDifficulty] = useState<DifficultyMode>('standard');
  const [menuStep, setMenuStep] = useState<MenuStep>('setup');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [selectedSkin, setSelectedSkin] = useState<CrewmateSkinId>(() => loadSelectedSkin());
  const [audioOffsetMs, setAudioOffsetMs] = useState<number>(() => loadAudioOffsetMs());
  const [bgmVolume, setBgmVolume] = useState<number>(() => loadBgmVolume());
  const [sfxVolume, setSfxVolume] = useState<number>(() => loadSfxVolume());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => loadReducedMotion());
  const [videoBgEnabled, setVideoBgEnabled] = useState<boolean>(() => loadVideoBgEnabled());
  const [videoPlaybackBlocked, setVideoPlaybackBlocked] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(false);
  /** Increments each time a renderer finishes init, so loops can restart on the new instance. */
  const [rendererEpoch, setRendererEpoch] = useState<number>(0);
  const [launchKey, setLaunchKey] = useState<number>(0);
  const [screen, setScreen] = useState<Screen>('splash');
  const inGame = screen === 'game';
  const [hud, setHud] = useState<HUDTelemetry>(() => ({
    ...INITIAL_HUD,
    cinematicCamera,
    audioOffsetMs,
  }));
  const [loadingState, setLoadingState] = useState<LoadingProgress>({
    progress: 0,
    stage: 'decoding',
  });

  const shellRef = useRef<HTMLDivElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ThorVGRenderer | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const measureViewportSize = useCallback((): { w: number; h: number } => {
    const shell = shellRef.current;
    const rawW = shell && shell.clientWidth > 0 ? shell.clientWidth : window.innerWidth;
    const rawH = shell && shell.clientHeight > 0 ? shell.clientHeight : window.innerHeight;
    return {
      w: Math.max(1, Math.round(rawW)),
      h: Math.max(1, Math.round(rawH)),
    };
  }, []);

  const isPaused = Boolean(hud.isPaused);
  const hasSelectedVideo = Boolean(selectedTrack.hasVideo && selectedTrack.videoUrl);
  const activeVideoUrl = hasSelectedVideo ? selectedTrack.videoUrl : undefined;
  const effectiveVideoBgActive =
    inGame && hasSelectedVideo && videoBgEnabled && !videoPlaybackBlocked;

  // Refs read by RAF preview and InputController without re-subscribing listeners.
  const selectedTrackRef = useRef<TrackMetadata>(selectedTrack);
  selectedTrackRef.current = selectedTrack;
  const cinematicCameraRef = useRef<boolean>(cinematicCamera);
  cinematicCameraRef.current = cinematicCamera;
  const difficultyRef = useRef<DifficultyMode>(difficulty);
  difficultyRef.current = difficulty;
  const selectedSkinRef = useRef<CrewmateSkinId>(selectedSkin);
  selectedSkinRef.current = selectedSkin;
  const audioOffsetMsRef = useRef<number>(audioOffsetMs);
  audioOffsetMsRef.current = audioOffsetMs;
  const bgmVolumeRef = useRef<number>(bgmVolume);
  bgmVolumeRef.current = bgmVolume;
  const sfxVolumeRef = useRef<number>(sfxVolume);
  sfxVolumeRef.current = sfxVolume;
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const videoBgEnabledRef = useRef<boolean>(videoBgEnabled);
  videoBgEnabledRef.current = videoBgEnabled;
  const videoPlaybackBlockedRef = useRef<boolean>(videoPlaybackBlocked);
  videoPlaybackBlockedRef.current = videoPlaybackBlocked;
  const effectiveVideoBgActiveRef = useRef<boolean>(effectiveVideoBgActive);
  effectiveVideoBgActiveRef.current = effectiveVideoBgActive;
  const finishedAtRef = useRef<number>(0);
  const inGameRef = useRef<boolean>(inGame);
  inGameRef.current = inGame;
  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;
  const isFinishedRef = useRef<boolean>(hud.isFinished);
  isFinishedRef.current = hud.isFinished;

  const handleSelectTrack = useCallback((track: TrackMetadata) => {
    selectedTrackRef.current = track;
    videoPlaybackBlockedRef.current = false;
    setVideoPlaybackBlocked(false);
    setSelectedTrack(track);
    if (track.isCustom) {
      audioRef.current?.touchCustomTrack(track.id);
    } else {
      saveSelectedTrackId(track.id);
    }
    if (!(track.hasVideo && track.videoUrl)) {
      const video = bgVideoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {
          // Ignore media reset errors
        }
      }
    }
  }, []);

  // The splash plays once per page load, even if the renderer is re-created later.
  const splashStartedRef = useRef<boolean>(false);
  const hasAutoOpenedGuideRef = useRef<boolean>(false);
  const launchSeqRef = useRef<number>(0);

  // Auto-open the beginner guide once per session on first entry to 'menu' (unless dismissed).
  useLayoutEffect(() => {
    if (screen !== 'menu' || hasAutoOpenedGuideRef.current) return;
    hasAutoOpenedGuideRef.current = true;
    if (!loadGuideDismissed()) {
      setIsGuideOpen(true);
    }
  }, [screen]);

  if (!audioRef.current) {
    audioRef.current = new AudioEngine();
  }
  if (!gameEngineRef.current) {
    const engine = new GameEngine(audioRef.current, (nextHud) => {
      isPausedRef.current = Boolean(nextHud.isPaused);
      isFinishedRef.current = nextHud.isFinished;
      if (nextHud.isFinished || nextHud.isPaused) {
        bgVideoRef.current?.pause();
      }
      if (nextHud.isFinished) {
        if (finishedAtRef.current === 0) {
          finishedAtRef.current = performance.now();
        }
      } else {
        finishedAtRef.current = 0;
      }
      setHud(nextHud);
    });
    engine.setDifficulty(difficultyRef.current);
    engine.setCinematicCamera(cinematicCameraRef.current);
    engine.setSelectedSkin(selectedSkinRef.current);
    engine.setAudioOffsetMs(audioOffsetMsRef.current);
    engine.setReducedMotion(reducedMotionRef.current);
    gameEngineRef.current = engine;
  }

  const safePlayBgVideo = useCallback((video: HTMLVideoElement) => {
    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err: unknown) => {
        const errName =
          err instanceof DOMException ? err.name : (err as { name?: string })?.name;
        if (errName === 'AbortError') return;
        if (
          inGameRef.current &&
          !isPausedRef.current &&
          !isFinishedRef.current &&
          videoBgEnabledRef.current
        ) {
          videoPlaybackBlockedRef.current = true;
          setVideoPlaybackBlocked(true);
        }
      });
    }
  }, []);

  useEffect(() => {
    const video = bgVideoRef.current;
    if (video) {
      video.defaultMuted = true;
      video.muted = true;
    }
    return () => {
      if (bgVideoRef.current) {
        try {
          bgVideoRef.current.pause();
          bgVideoRef.current.removeAttribute('src');
          bgVideoRef.current.load();
        } catch {
          // Ignore media cleanup errors on unmount
        }
      }
      audioRef.current?.disposeAllCustomMedia();
    };
  }, []);

  useEffect(() => {
    videoPlaybackBlockedRef.current = false;
    setVideoPlaybackBlocked(false);
    const video = bgVideoRef.current;
    if (!video || activeVideoUrl) return;
    if (video.hasAttribute('src') || video.readyState > 0) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // Ignore media reset errors
      }
    }
  }, [activeVideoUrl]);

  useEffect(() => {
    effectiveVideoBgActiveRef.current = effectiveVideoBgActive;
    gameEngineRef.current?.setVideoBackgroundActive(effectiveVideoBgActive);
  }, [effectiveVideoBgActive]);

  useEffect(() => {
    const video = bgVideoRef.current;
    const engine = gameEngineRef.current;
    if (!video) return;

    if (!inGame || !effectiveVideoBgActive || hud.isFinished) {
      video.pause();
      return;
    }

    if (isPaused) {
      video.pause();
      if (engine) {
        syncBgVideoTime(
          video,
          engine.getCurrentVideoSyncSec(),
          selectedTrack.durationSec,
          0.002
        );
      }
      return;
    }

    if (engine) {
      syncBgVideoTime(
        video,
        engine.getCurrentVideoSyncSec(),
        selectedTrack.durationSec,
        0.05
      );
    }
    safePlayBgVideo(video);

    let rafId = 0;
    const syncTick = () => {
      const liveEngine = gameEngineRef.current;
      if (
        liveEngine &&
        inGameRef.current &&
        !isPausedRef.current &&
        !isFinishedRef.current &&
        effectiveVideoBgActiveRef.current
      ) {
        syncBgVideoTime(
          video,
          liveEngine.getCurrentVideoSyncSec(),
          selectedTrackRef.current.durationSec,
          0.12
        );
      }
      rafId = requestAnimationFrame(syncTick);
    };
    rafId = requestAnimationFrame(syncTick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    activeVideoUrl,
    effectiveVideoBgActive,
    hud.isFinished,
    inGame,
    isPaused,
    launchKey,
    safePlayBgVideo,
    selectedTrack.durationSec,
  ]);

  useEffect(() => {
    cinematicCameraRef.current = cinematicCamera;
    gameEngineRef.current?.setCinematicCamera(cinematicCamera);
  }, [cinematicCamera]);

  useEffect(() => {
    selectedSkinRef.current = selectedSkin;
    gameEngineRef.current?.setSelectedSkin(selectedSkin);
  }, [selectedSkin]);

  useEffect(() => {
    audioOffsetMsRef.current = audioOffsetMs;
    gameEngineRef.current?.setAudioOffsetMs(audioOffsetMs);
  }, [audioOffsetMs]);

  useEffect(() => {
    bgmVolumeRef.current = bgmVolume;
    if (audioRef.current && Math.abs(audioRef.current.getBgmVolume() - bgmVolume) > 1e-6) {
      audioRef.current.setBgmVolume(bgmVolume);
    }
    if (
      gameEngineRef.current &&
      Math.abs(gameEngineRef.current.getBgmVolume() - bgmVolume) > 1e-6
    ) {
      gameEngineRef.current.setBgmVolume(bgmVolume);
    }
  }, [bgmVolume]);

  useEffect(() => {
    sfxVolumeRef.current = sfxVolume;
    if (audioRef.current && Math.abs(audioRef.current.getSfxVolume() - sfxVolume) > 1e-6) {
      audioRef.current.setSfxVolume(sfxVolume);
    }
    if (
      gameEngineRef.current &&
      Math.abs(gameEngineRef.current.getSfxVolume() - sfxVolume) > 1e-6
    ) {
      gameEngineRef.current.setSfxVolume(sfxVolume);
    }
  }, [sfxVolume]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    gameEngineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Live OS prefers-reduced-motion sync when user has not explicitly overridden the preference
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!hasExplicitReducedMotionPref()) {
      reducedMotionRef.current = mql.matches;
      setReducedMotion(mql.matches);
      gameEngineRef.current?.setReducedMotion(mql.matches);
    }
    const handleChange = (event: MediaQueryListEvent) => {
      if (hasExplicitReducedMotionPref()) return;
      reducedMotionRef.current = event.matches;
      setReducedMotion(event.matches);
      gameEngineRef.current?.setReducedMotion(event.matches);
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    mql.addListener(handleChange);
    return () => mql.removeListener(handleChange);
  }, []);

  // Auto-pause active gameplay or active 3-2-1 resume countdown on tab hide / window blur / pagehide
  useEffect(() => {
    const autoPauseIfActive = () => {
      if (inGameRef.current && !isFinishedRef.current) {
        gameEngineRef.current?.pauseRun();
        bgVideoRef.current?.pause();
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        autoPauseIfActive();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', autoPauseIfActive);
    window.addEventListener('pagehide', autoPauseIfActive);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', autoPauseIfActive);
      window.removeEventListener('pagehide', autoPauseIfActive);
    };
  }, []);

  useEffect(() => {
    if (hud.isFinished) {
      if (finishedAtRef.current === 0) {
        finishedAtRef.current = performance.now();
      }
    } else {
      finishedAtRef.current = 0;
    }
  }, [hud.isFinished]);

  // Create the ThorVG renderer ('sw' SwCanvas or 'gl' GlCanvas) on a fresh
  // <canvas key={rendererMode} />. Re-created ONLY when the renderer backend changes.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    let cancelled = false;
    const renderer = new ThorVGRenderer(rendererMode);
    rendererRef.current = renderer;
    setEngineReady(false);

    const { w: initW, h: initH } = measureViewportSize();
    lastSizeRef.current = { w: initW, h: initH };

    renderer
      .init(canvasEl, initW, initH, { skipSplash: splashStartedRef.current })
      .then(() => {
        if (cancelled || !renderer.ready) return;
        const { w, h } = measureViewportSize();
        lastSizeRef.current = { w, h };
        renderer.resize(w, h);
        gameEngineRef.current?.setCinematicCamera(cinematicCameraRef.current);
        gameEngineRef.current?.setSelectedSkin(selectedSkinRef.current);
        gameEngineRef.current?.setAudioOffsetMs(audioOffsetMsRef.current);
        gameEngineRef.current?.setReducedMotion(reducedMotionRef.current);
        gameEngineRef.current?.setVideoBackgroundActive(effectiveVideoBgActiveRef.current);
        gameEngineRef.current?.attachRenderer(renderer, rendererMode, w, h);
        setEngineReady(true);
        setRendererEpoch((n) => n + 1);

        if (!splashStartedRef.current) {
          splashStartedRef.current = true;
          void renderer.playSplash().then(() => {
            setScreen((current) => (current === 'splash' ? 'menu' : current));
          });
        }
      })
      .catch((err) => {
        console.error('ThorVG WASM Renderer initialization error:', err);
        splashStartedRef.current = true;
        setScreen((current) => (current === 'splash' ? 'menu' : current));
      });

    return () => {
      cancelled = true;
      renderer.destroy();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, [rendererMode, measureViewportSize]);

  // Menu background preview loop. Stopped and cleared immediately on 'loading' / 'game'.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer?.ready) return;

    if (screen === 'loading') {
      renderer.clearForTransition();
      return;
    }
    if (screen !== 'menu') return;

    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const speedPx = DIFFICULTY_CONFIG[difficultyRef.current].worldPxPerSec;
      renderer.renderPreviewFrame((now - start) / 1000, speedPx, selectedSkinRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [screen, rendererEpoch]);

  // Responsive viewport resize listener (ResizeObserver + window resize/orientationchange + visualViewport)
  useEffect(() => {
    const syncViewportSize = () => {
      const { w, h } = measureViewportSize();
      const { w: lastW, h: lastH } = lastSizeRef.current;
      if (w === lastW && h === lastH) return;
      lastSizeRef.current = { w, h };
      rendererRef.current?.resize(w, h);
      gameEngineRef.current?.resize(w, h);
    };

    let resizeObserver: ResizeObserver | null = null;
    const shellEl = shellRef.current;
    if (shellEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncViewportSize();
      });
      resizeObserver.observe(shellEl);
    }

    window.addEventListener('resize', syncViewportSize);
    window.addEventListener('orientationchange', syncViewportSize);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', syncViewportSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncViewportSize);
      window.removeEventListener('orientationchange', syncViewportSize);
      visualViewport?.removeEventListener('resize', syncViewportSize);
    };
  }, [measureViewportSize]);

  const handleReturnToMenu = useCallback(() => {
    launchSeqRef.current++;
    finishedAtRef.current = 0;
    inGameRef.current = false;
    effectiveVideoBgActiveRef.current = false;
    if (bgVideoRef.current) {
      bgVideoRef.current.pause();
      syncBgVideoTime(bgVideoRef.current, 0, selectedTrackRef.current.durationSec, 0);
    }
    gameEngineRef.current?.stopRun();
    rendererRef.current?.clearForTransition();
    setHud((prev) => ({
      ...prev,
      isPaused: false,
      resumeCountdown: null,
      userZoom: 1.0,
      isPanned: false,
    }));
    setMenuStep('track');
    setScreen('menu');
  }, []);

  const handleTogglePause = useCallback(() => {
    audioRef.current?.unlockFromGesture();
    gameEngineRef.current?.togglePause();
    if (gameEngineRef.current?.isPaused && bgVideoRef.current) {
      bgVideoRef.current.pause();
      if (effectiveVideoBgActiveRef.current) {
        syncBgVideoTime(
          bgVideoRef.current,
          gameEngineRef.current.getCurrentVideoSyncSec(),
          selectedTrackRef.current.durationSec,
          0.002
        );
      }
    }
  }, []);

  const handlePauseRun = useCallback(() => {
    gameEngineRef.current?.pauseRun();
    if (bgVideoRef.current) {
      bgVideoRef.current.pause();
      if (gameEngineRef.current && effectiveVideoBgActiveRef.current) {
        syncBgVideoTime(
          bgVideoRef.current,
          gameEngineRef.current.getCurrentVideoSyncSec(),
          selectedTrackRef.current.durationSec,
          0.002
        );
      }
    }
  }, []);

  const handleResumeRun = useCallback(() => {
    audioRef.current?.unlockFromGesture();
    void gameEngineRef.current?.resumeRun();
  }, []);

  const handleStepZoom = useCallback((factor: number) => {
    gameEngineRef.current?.zoomByFactor(factor);
  }, []);

  const handleSetZoom = useCallback((zoom: number) => {
    gameEngineRef.current?.setUserZoom(zoom);
  }, []);

  const handleResetView = useCallback(() => {
    gameEngineRef.current?.resetCameraView();
  }, []);

  const handleChangeAudioOffset = useCallback((next: number) => {
    const clamped = saveAudioOffsetMs(next);
    audioOffsetMsRef.current = clamped;
    setAudioOffsetMs(clamped);
    const engine = gameEngineRef.current;
    engine?.setAudioOffsetMs(clamped);
    if (
      engine &&
      bgVideoRef.current &&
      inGameRef.current &&
      selectedTrackRef.current.hasVideo &&
      selectedTrackRef.current.videoUrl
    ) {
      syncBgVideoTime(
        bgVideoRef.current,
        engine.getCurrentVideoSyncSec(),
        selectedTrackRef.current.durationSec,
        0.002
      );
    }
  }, []);

  const handleToggleVideoBg = useCallback(() => {
    const track = selectedTrackRef.current;
    if (!track.hasVideo) return;
    const next = saveVideoBgEnabled(!videoBgEnabledRef.current);
    videoBgEnabledRef.current = next;
    videoPlaybackBlockedRef.current = false;
    setVideoPlaybackBlocked(false);
    setVideoBgEnabled(next);

    const nextEffective = inGameRef.current && Boolean(track.hasVideo && track.videoUrl) && next;
    effectiveVideoBgActiveRef.current = nextEffective;
    const engine = gameEngineRef.current;
    engine?.setVideoBackgroundActive(nextEffective);

    const video = bgVideoRef.current;
    if (!video || !inGameRef.current) return;
    if (!nextEffective || isFinishedRef.current) {
      video.pause();
      return;
    }
    if (isPausedRef.current) {
      video.pause();
      if (engine) {
        syncBgVideoTime(video, engine.getCurrentVideoSyncSec(), track.durationSec, 0.002);
      }
      return;
    }
    if (engine) {
      syncBgVideoTime(video, engine.getCurrentVideoSyncSec(), track.durationSec, 0.05);
    }
    safePlayBgVideo(video);
  }, [safePlayBgVideo]);

  const handleChangeBgmVolume = useCallback((next: number) => {
    const applied = audioRef.current
      ? audioRef.current.setBgmVolume(next)
      : saveBgmVolume(next);
    bgmVolumeRef.current = applied;
    setBgmVolume(applied);
    gameEngineRef.current?.setBgmVolume(applied);
  }, []);

  const handleChangeSfxVolume = useCallback((next: number) => {
    const applied = audioRef.current
      ? audioRef.current.setSfxVolume(next)
      : saveSfxVolume(next);
    sfxVolumeRef.current = applied;
    setSfxVolume(applied);
    gameEngineRef.current?.setSfxVolume(applied);
  }, []);

  const handleToggleReducedMotion = useCallback(() => {
    setReducedMotion((prev) => {
      const next = saveReducedMotion(!prev);
      reducedMotionRef.current = next;
      gameEngineRef.current?.setReducedMotion(next);
      return next;
    });
  }, []);

  const handleToggleCinematicCamera = useCallback(() => {
    const next = gameEngineRef.current
      ? gameEngineRef.current.toggleCinematicCamera()
      : !cinematicCameraRef.current;
    cinematicCameraRef.current = next;
    setCinematicCamera(next);
    try {
      window.localStorage.setItem(CINEMATIC_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Ignore storage access errors.
    }
    setHud((prev) => ({ ...prev, cinematicCamera: next }));
  }, []);

  const handleUploadFile = useCallback(
    async (
      file: File,
      supportedFormats: readonly AudioFormat[]
    ): Promise<TrackMetadata | undefined> => {
      if (!audioRef.current) return undefined;
      const decodedTrack = await audioRef.current.decodeLocalFile(file, supportedFormats);
      const keepIds = [decodedTrack.id, selectedTrackRef.current.id];
      const evictedIds = audioRef.current.evictOldCustomTracks(keepIds);
      const evictedSet = new Set(evictedIds);
      setCustomTracks((prev) => [
        decodedTrack,
        ...prev.filter((item) => item.id !== decodedTrack.id && !evictedSet.has(item.id)),
      ]);
      videoPlaybackBlockedRef.current = false;
      setVideoPlaybackBlocked(false);
      selectedTrackRef.current = decodedTrack;
      setSelectedTrack(decodedTrack);
      return decodedTrack;
    },
    []
  );

  const handleSelectDifficulty = useCallback((nextDiff: DifficultyMode) => {
    setDifficulty(nextDiff);
    gameEngineRef.current?.setDifficulty(nextDiff);
  }, []);

  const handleSelectSkin = useCallback((skinId: CrewmateSkinId) => {
    const saved = saveSelectedSkin(skinId);
    selectedSkinRef.current = saved;
    setSelectedSkin(saved);
    gameEngineRef.current?.setSelectedSkin(saved);
  }, []);

  const handleStartRun = useCallback(() => {
    const engine = gameEngineRef.current;
    if (!engine) return;

    setIsGuideOpen(false);
    audioRef.current?.unlockFromGesture();
    const seq = ++launchSeqRef.current;
    finishedAtRef.current = 0;
    inGameRef.current = false;
    effectiveVideoBgActiveRef.current = false;
    videoPlaybackBlockedRef.current = false;
    setVideoPlaybackBlocked(false);

    const video = bgVideoRef.current;
    if (video && selectedTrack.hasVideo && selectedTrack.videoUrl) {
      video.muted = true;
      if (video.getAttribute('src') !== selectedTrack.videoUrl) {
        video.src = selectedTrack.videoUrl;
      }
      const primePromise = video.play();
      if (primePromise && typeof primePromise.then === 'function') {
        primePromise
          .then(() => {
            if (launchSeqRef.current === seq && !inGameRef.current) {
              video.pause();
              syncBgVideoTime(video, 0, selectedTrack.durationSec, 0);
            }
          })
          .catch((err: unknown) => {
            const errName =
              err instanceof DOMException ? err.name : (err as { name?: string })?.name;
            if (errName === 'AbortError') return;
            // Live phase will retry or fallback cleanly without interrupting preparation
          });
      }
    } else if (video) {
      video.pause();
    }

    rendererRef.current?.clearForTransition();
    engine.setCinematicCamera(cinematicCamera);
    engine.setSelectedSkin(selectedSkinRef.current);
    engine.setAudioOffsetMs(audioOffsetMsRef.current);
    engine.setReducedMotion(reducedMotionRef.current);
    setHud((prev) => ({
      ...INITIAL_HUD,
      grooveHp: 100,
      maxGrooveHp: 100,
      isFailed: false,
      rendererMode,
      difficulty,
      sfxMode: gameEngineRef.current?.getSfxMode() ?? prev.sfxMode ?? 'full',
      activeForm: 'synth',
      cinematicCamera,
      audioOffsetMs: audioOffsetMsRef.current,
    }));
    setLoadingState({ progress: 0.06, stage: 'decoding' });
    setScreen('loading');

    void (async () => {
      try {
        const blueprint = await engine.prepareRun(
          selectedTrack,
          (status) => {
            if (launchSeqRef.current === seq) {
              setLoadingState(status);
            }
          },
          difficulty
        );
        if (launchSeqRef.current !== seq) return;
        let resolvedTrack = selectedTrack;
        if (selectedTrack.isCustom && Number.isFinite(blueprint.bpm) && blueprint.bpm > 0) {
          const detectedBpm = Math.round(blueprint.bpm);
          audioRef.current?.updateCustomTrackBpm(selectedTrack.id, detectedBpm);
          if (detectedBpm !== selectedTrack.bpm) {
            resolvedTrack = { ...selectedTrack, bpm: detectedBpm };
            selectedTrackRef.current = resolvedTrack;
            setCustomTracks((prev) =>
              prev.map((item) =>
                item.id === selectedTrack.id ? { ...item, bpm: detectedBpm } : item
              )
            );
            setSelectedTrack((prev) =>
              prev.id === selectedTrack.id ? { ...prev, bpm: detectedBpm } : prev
            );
          }
        }
        setLoadingState({ progress: 1.0, stage: 'ready', blueprint });

        // Brief hold at 100% so the player can see the pre-computed track waveform minimap
        await new Promise((r) => setTimeout(r, 480));
        if (launchSeqRef.current !== seq) return;

        const shouldActivateVideoBg =
          Boolean(resolvedTrack.hasVideo && resolvedTrack.videoUrl) &&
          videoBgEnabledRef.current &&
          !videoPlaybackBlockedRef.current;
        inGameRef.current = true;
        isPausedRef.current = false;
        isFinishedRef.current = false;
        effectiveVideoBgActiveRef.current = shouldActivateVideoBg;
        engine.setVideoBackgroundActive(shouldActivateVideoBg);
        if (bgVideoRef.current && shouldActivateVideoBg) {
          syncBgVideoTime(bgVideoRef.current, 0, resolvedTrack.durationSec, 0);
          safePlayBgVideo(bgVideoRef.current);
        }

        const runPromise = engine.startRun(resolvedTrack, undefined, difficulty);
        setLaunchKey((k) => k + 1);
        setScreen('game');
        await runPromise;
      } catch (err) {
        console.error('Track blueprint preparation failed:', err);
        if (launchSeqRef.current === seq) {
          inGameRef.current = false;
          effectiveVideoBgActiveRef.current = false;
          bgVideoRef.current?.pause();
          setScreen('menu');
        }
      }
    })();
  }, [cinematicCamera, difficulty, rendererMode, safePlayBgVideo, selectedTrack]);

  const handleStartRunRef = useRef(handleStartRun);
  handleStartRunRef.current = handleStartRun;

  const handleQuickRetry = useCallback(() => {
    const engine = gameEngineRef.current;
    if (!engine) return;
    audioRef.current?.unlockFromGesture();
    launchSeqRef.current++;
    finishedAtRef.current = 0;
    videoPlaybackBlockedRef.current = false;
    setVideoPlaybackBlocked(false);
    if (engine.hasPreparedBlueprint(selectedTrack, difficulty)) {
      engine.setCinematicCamera(cinematicCameraRef.current);
      engine.setSelectedSkin(selectedSkinRef.current);
      engine.setAudioOffsetMs(audioOffsetMsRef.current);
      engine.setReducedMotion(reducedMotionRef.current);
      const shouldActivateVideoBg =
        Boolean(selectedTrack.hasVideo && selectedTrack.videoUrl) && videoBgEnabledRef.current;
      inGameRef.current = true;
      isPausedRef.current = false;
      isFinishedRef.current = false;
      effectiveVideoBgActiveRef.current = shouldActivateVideoBg;
      engine.setVideoBackgroundActive(shouldActivateVideoBg);
      const video = bgVideoRef.current;
      if (video) {
        syncBgVideoTime(video, 0, selectedTrack.durationSec, 0);
        if (shouldActivateVideoBg) {
          safePlayBgVideo(video);
        } else {
          video.pause();
        }
      }
      setLaunchKey((k) => k + 1);
      setScreen('game');
      void engine.restartCurrentRun();
    } else {
      handleStartRun();
    }
  }, [difficulty, handleStartRun, safePlayBgVideo, selectedTrack]);

  const handleQuickRetryRef = useRef(handleQuickRetry);
  handleQuickRetryRef.current = handleQuickRetry;

  // Command-Pattern InputController binding 2-Lane Katana Slasher keyboard & pointer controls once
  useEffect(() => {
    const controller = new InputController({
      isGameActive: () => inGameRef.current,
      isPaused: () => Boolean(gameEngineRef.current?.isPaused),
      isRunFinished: () => isFinishedRef.current,
      onSlashHigh: (ts: number) => {
        gameEngineRef.current?.handleSlashHigh(ts);
      },
      onSlashLow: (ts: number) => {
        gameEngineRef.current?.handleSlashLow(ts);
      },
      onSlashChord: (ts: number) => {
        gameEngineRef.current?.handleSlashChord(ts);
      },
      onLaneHoldChange: (lane: SlashLane | 'chord', held: boolean) => {
        gameEngineRef.current?.setLaneHeld(lane, held);
      },
      onActivateOverdrive: () => {
        gameEngineRef.current?.activateOverdrive();
      },
      onCycleSfxMode: () => {
        const next = gameEngineRef.current?.cycleSfxMode();
        if (next) {
          setHud((prev) => ({ ...prev, sfxMode: next }));
        }
      },
      onToggleCinematicCamera: handleToggleCinematicCamera,
      onToggleVideoBackground: handleToggleVideoBg,
      onTogglePause: handleTogglePause,
      onExitToMenu: handleReturnToMenu,
      onReplayRun: () => {
        if (finishedAtRef.current > 0 && performance.now() - finishedAtRef.current < 550) {
          return;
        }
        void handleStartRunRef.current();
      },
      onQuickRetry: () => {
        handleQuickRetryRef.current();
      },
      onWheelZoom: (factor, canvasX, canvasY) => {
        gameEngineRef.current?.zoomByFactor(factor, canvasX, canvasY);
      },
      onStepZoom: (factor) => {
        gameEngineRef.current?.zoomByFactor(factor);
      },
      onResetZoom: () => {
        gameEngineRef.current?.resetCameraView();
      },
      onPanDelta: (dx, dy) => {
        gameEngineRef.current?.panCamera(dx, dy);
      },
      getTouchSplitYRatio: () => gameEngineRef.current?.getTouchSplitYRatio() ?? 0.6,
    });
    return controller.attach(shellRef.current);
  }, [handleReturnToMenu, handleToggleCinematicCamera, handleTogglePause, handleToggleVideoBg]);

  const handleSwitchRendererAndReplay = useCallback(
    (nextMode: RendererMode) => {
      audioRef.current?.unlockFromGesture();
      gameEngineRef.current?.stopRun();
      setRendererMode(nextMode);
      setTimeout(() => {
        handleStartRun();
      }, 120);
    },
    [handleStartRun]
  );

  return (
    <div
      ref={shellRef}
      className="app-shell"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      onContextMenu={(e) => {
        if (inGame && (!hud.isPaused || Boolean(hud.resumeCountdown)) && !hud.isFinished) {
          e.preventDefault();
        }
      }}
    >
      <video
        ref={bgVideoRef}
        src={activeVideoUrl}
        className={`bg-video-layer${effectiveVideoBgActive ? ' is-active' : ''}`}
        data-testid="bg-video-layer"
        muted
        playsInline
        disablePictureInPicture
        preload="auto"
        aria-hidden="true"
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          const engine = gameEngineRef.current;
          if (inGameRef.current && engine && effectiveVideoBgActiveRef.current) {
            syncBgVideoTime(
              video,
              engine.getCurrentVideoSyncSec(),
              selectedTrackRef.current.durationSec,
              0
            );
            if (!isPausedRef.current && !isFinishedRef.current) {
              safePlayBgVideo(video);
            }
          }
        }}
        onSeeked={(e) => {
          const video = e.currentTarget;
          const engine = gameEngineRef.current;
          if (
            inGameRef.current &&
            isPausedRef.current &&
            !isFinishedRef.current &&
            engine &&
            effectiveVideoBgActiveRef.current
          ) {
            syncBgVideoTime(
              video,
              engine.getCurrentVideoSyncSec(),
              selectedTrackRef.current.durationSec,
              0.005
            );
          }
        }}
        onError={() => {
          if (selectedTrackRef.current.hasVideo && selectedTrackRef.current.videoUrl) {
            videoPlaybackBlockedRef.current = true;
            setVideoPlaybackBlocked(true);
          }
        }}
      />

      {/* Keyed by rendererMode so React cleanly replaces DOM <canvas> on CPU <-> GPU switch */}
      <canvas
        key={rendererMode}
        ref={canvasRef}
        id="tvg-canvas"
        className={`tvg-canvas${inGame && hud.isPaused && !hud.resumeCountdown && !hud.isFinished ? ' paused-inspectable' : ''}`}
      />

      {screen === 'menu' && (
        <StartScreen
          selectedTrack={selectedTrack}
          customTracks={customTracks}
          rendererMode={rendererMode}
          difficulty={difficulty}
          selectedSkin={selectedSkin}
          bgmVolume={bgmVolume}
          sfxVolume={sfxVolume}
          reducedMotion={reducedMotion}
          videoBgEnabled={videoBgEnabled}
          engineReady={engineReady}
          step={menuStep}
          isGuideOpen={isGuideOpen}
          onOpenGuide={handleOpenGuide}
          onCloseGuide={handleCloseGuide}
          onStepChange={setMenuStep}
          onSelectTrack={handleSelectTrack}
          onUploadFile={handleUploadFile}
          onSelectRenderer={setRendererMode}
          onSelectDifficulty={handleSelectDifficulty}
          onSelectSkin={handleSelectSkin}
          onChangeBgmVolume={handleChangeBgmVolume}
          onChangeSfxVolume={handleChangeSfxVolume}
          onToggleReducedMotion={handleToggleReducedMotion}
          onToggleVideoBg={handleToggleVideoBg}
          onStartRun={handleStartRun}
        />
      )}

      {screen === 'loading' && (
        <TrackLoadingModal
          trackTitle={trackTitle(t, selectedTrack)}
          loadingState={loadingState}
        />
      )}

      {inGame && (!hud.isPaused || Boolean(hud.resumeCountdown)) && !hud.isFinished && (
        <InGameHUD
          hud={hud}
          trackTitle={trackTitle(t, selectedTrack)}
          hasVideo={Boolean(selectedTrack.hasVideo)}
          videoBgEnabled={videoBgEnabled}
          onReturnToMenu={handleReturnToMenu}
          onPause={handlePauseRun}
          onStepZoom={handleStepZoom}
          onResetZoom={handleResetView}
          onToggleCinematicCamera={handleToggleCinematicCamera}
          onToggleVideoBg={handleToggleVideoBg}
          onToggleRendererInGame={(nextMode) => setRendererMode(nextMode)}
          onCycleSfxMode={() => {
            const next = gameEngineRef.current?.cycleSfxMode();
            if (next) {
              setHud((prev) => ({ ...prev, sfxMode: next }));
            }
          }}
          onActivateOverdrive={() => {
            gameEngineRef.current?.activateOverdrive();
          }}
        />
      )}

      {inGame && Boolean(hud.isPaused) && !hud.resumeCountdown && !hud.isFinished && (
        <PauseOverlay
          hud={hud}
          trackTitle={trackTitle(t, selectedTrack)}
          audioOffsetMs={audioOffsetMs}
          bgmVolume={bgmVolume}
          sfxVolume={sfxVolume}
          reducedMotion={reducedMotion}
          hasVideo={Boolean(selectedTrack.hasVideo)}
          videoBgEnabled={videoBgEnabled}
          onChangeAudioOffset={handleChangeAudioOffset}
          onChangeBgmVolume={handleChangeBgmVolume}
          onChangeSfxVolume={handleChangeSfxVolume}
          onToggleReducedMotion={handleToggleReducedMotion}
          onToggleVideoBg={handleToggleVideoBg}
          onResume={handleResumeRun}
          onQuickRetry={handleQuickRetry}
          onReturnToMenu={handleReturnToMenu}
          onSetZoom={handleSetZoom}
          onStepZoom={handleStepZoom}
          onResetView={handleResetView}
          onToggleRenderer={(nextMode) => setRendererMode(nextMode)}
        />
      )}

      {inGame && Boolean(hud.resumeCountdown) && !hud.isFinished && (
        <div
          className="resume-countdown-overlay"
          data-testid="resume-countdown-overlay"
          role="status"
          aria-live="assertive"
        >
          <div className="resume-countdown-card">
            <span className="resume-countdown-eyebrow">{t.hud.resumeCountdownLabel}</span>
            <strong
              key={hud.resumeCountdown}
              className="resume-countdown-digit"
              data-testid="resume-countdown-digit"
            >
              {hud.resumeCountdown}
            </strong>
            <small className="resume-countdown-hint">
              {isCoarsePointer ? t.hud.resumeCountdownTouchHint : t.hud.resumeCountdownHint}
            </small>
          </div>
        </div>
      )}

      {inGame && launchKey > 0 && (
        <div key={launchKey} className="game-launch-veil" aria-hidden="true" />
      )}

      {inGame && hud.isFinished && (
        <ResultModal
          hud={hud}
          trackTitle={trackTitle(t, selectedTrack)}
          onReplay={handleStartRun}
          onSwitchRendererAndReplay={handleSwitchRendererAndReplay}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </div>
  );
};

export default App;
