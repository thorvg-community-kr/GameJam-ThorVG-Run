import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLoadError,
  MAX_UPLOAD_MB,
  MIN_TRACK_SECONDS,
  buildAcceptAttribute,
  detectSupportedAudioFormats,
  formatLabels,
  type AudioFormat,
} from '../audio/audioFormats';
import { BUILT_IN_TRACKS } from '../audio/proceduralTracks';
import { getTrackRecord } from '../engine/recordsStore';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { trackArtist, trackTitle } from '../i18n/display';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGE_LABELS, type Lang } from '../i18n/messages';
import {
  CREWMATE_SKIN_CONFIG,
  CREWMATE_SKIN_ORDER,
  DIFFICULTY_CONFIG,
  type CrewmateSkinId,
  type DifficultyMode,
  type RendererMode,
  type TrackMetadata,
} from '../types/game';
import { BeginnerGuideModal } from './BeginnerGuideModal';
import { MenuTooltipPortal, useMenuTooltip, type MenuTooltipData } from './MenuTooltip';
import { HudVectorIcon, SkinVectorPreview } from './SkinVectorPreview';

export type MenuStep = 'setup' | 'track';

interface StartScreenProps {
  selectedTrack: TrackMetadata;
  customTracks: TrackMetadata[];
  rendererMode: RendererMode;
  difficulty: DifficultyMode;
  selectedSkin: CrewmateSkinId;
  engineReady: boolean;
  step: MenuStep;
  isGuideOpen: boolean;
  onOpenGuide: () => void;
  onCloseGuide: () => void;
  onStepChange: (step: MenuStep) => void;
  onSelectTrack: (track: TrackMetadata) => void;
  onUploadFile: (file: File, supportedFormats: readonly AudioFormat[]) => Promise<void>;
  onSelectRenderer: (mode: RendererMode) => void;
  onSelectDifficulty: (difficulty: DifficultyMode) => void;
  onSelectSkin: (skin: CrewmateSkinId) => void;
  onStartRun: () => void;
}

const LANGS: Lang[] = ['en', 'ko'];
const DIFFICULTY_MODES: DifficultyMode[] = ['casual', 'standard'];

export const StartScreen: React.FC<StartScreenProps> = ({
  selectedTrack,
  customTracks,
  rendererMode,
  difficulty,
  selectedSkin,
  engineReady,
  step,
  isGuideOpen,
  onOpenGuide,
  onCloseGuide,
  onStepChange,
  onSelectTrack,
  onUploadFile,
  onSelectRenderer,
  onSelectDifficulty,
  onSelectSkin,
  onStartRun,
}) => {
  const { lang, setLang, t, format } = useI18n();
  const isCoarsePointer = useCoarsePointer();
  const ctrlGuide = isCoarsePointer ? t.menu.controlsTouch : t.menu.controls;
  const stepBodyRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const { activeTip, activeTipId, showTip, toggleTouchTip, hideTip } = useMenuTooltip();

  useEffect(() => {
    if (stepBodyRef.current) {
      stepBodyRef.current.scrollTop = 0;
    }
  }, [step]);

  useEffect(() => {
    hideTip();
  }, [step, lang, hideTip]);

  useEffect(() => {
    if (isGuideOpen) {
      hideTip();
    }
  }, [isGuideOpen, hideTip]);

  // Formats this browser can decode. Drives the hint, the picker filter, and validation.
  const supportedFormats = useMemo(() => detectSupportedAudioFormats(), []);
  const supportedList = supportedFormats.length > 0 ? formatLabels(supportedFormats) : '—';
  const acceptAttr = useMemo(() => buildAcceptAttribute(supportedFormats), [supportedFormats]);

  const bindHoverTip = (tip: MenuTooltipData) => ({
    'aria-describedby': activeTipId(tip.id),
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch') return;
      showTip(e.currentTarget, tip);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch') return;
      hideTip();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(':focus-visible')) {
        showTip(e.currentTarget, tip);
      }
    },
    onBlur: () => {
      if (activeTip?.id === tip.id) {
        hideTip();
      }
    },
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (step !== 'track') {
      onStepChange('track');
    }
    const file = files[0]!;
    const extraNote = files.length > 1 ? ` ${t.upload.firstOnly}` : '';
    setUploadStatus(format(t.upload.analyzing, { name: file.name }));
    try {
      await onUploadFile(file, supportedFormats);
      setUploadStatus(format(t.upload.loaded, { name: file.name }) + extraNote);
    } catch (err) {
      const code = err instanceof AudioLoadError ? err.code : 'decode_failed';
      setUploadStatus(
        format(t.upload.errors[code], {
          list: supportedList,
          minSeconds: MIN_TRACK_SECONDS,
          maxMb: MAX_UPLOAD_MB,
        }) + extraNote
      );
    }
  };

  const allTracks = [...BUILT_IN_TRACKS, ...customTracks];
  const equippedSkinCfg = CREWMATE_SKIN_CONFIG[selectedSkin];
  const currentTrackTitle = trackTitle(t, selectedTrack);

  const introTip: MenuTooltipData = {
    id: 'intro-info',
    title: t.menu.introTipTitle,
    body: t.menu.introTipBody,
  };

  const stepSetupTip: MenuTooltipData = {
    id: 'step-setup',
    title: t.menu.stepSetupTitle,
    body: t.menu.stepSetupTip,
  };

  const stepTrackTip: MenuTooltipData = {
    id: 'step-track',
    title: t.menu.stepTrackTitle,
    body: t.menu.stepTrackTip,
  };

  const rendererOptions: ReadonlyArray<{
    mode: RendererMode;
    icon: 'cpu' | 'gpu';
    testId: string;
    title: string;
    desc: string;
    tip: MenuTooltipData;
  }> = [
    {
      mode: 'sw',
      icon: 'cpu',
      testId: 'renderer-option-sw',
      title: t.menu.rendererCpuTitle,
      desc: t.menu.rendererCpuDesc,
      tip: {
        id: 'renderer-sw',
        title: t.menu.rendererCpuTitle,
        body: t.menu.rendererCpuTip,
        meta: t.menu.rendererCpuDesc,
        accentHex: '#05D5FF',
      },
    },
    {
      mode: 'gl',
      icon: 'gpu',
      testId: 'renderer-option-gl',
      title: t.menu.rendererGpuTitle,
      desc: t.menu.rendererGpuDesc,
      tip: {
        id: 'renderer-gl',
        title: t.menu.rendererGpuTitle,
        body: t.menu.rendererGpuTip,
        meta: t.menu.rendererGpuDesc,
        accentHex: '#FF2A6D',
      },
    },
  ];

  const editSetupTip: MenuTooltipData = {
    id: 'edit-setup',
    title: t.menu.editSetupBtn,
    body: t.menu.editSetupTip,
  };

  const uploadSummaryBody =
    supportedFormats.length > 0
      ? format(t.upload.compactHint, {
          list: supportedList,
          maxMb: MAX_UPLOAD_MB,
          minSeconds: MIN_TRACK_SECONDS,
        })
      : t.upload.noneSupported;

  const uploadDropzoneTip: MenuTooltipData = {
    id: 'upload-dropzone',
    title: t.upload.tipTitle,
    body: uploadSummaryBody,
  };

  const uploadInfoTip: MenuTooltipData = {
    id: 'upload-info',
    title: t.upload.tipTitle,
    body: uploadSummaryBody,
  };

  const resonanceInfoTip: MenuTooltipData = {
    id: 'resonance-info',
    title: t.menu.resonanceTipTitle,
    body: t.menu.resonanceTipBody,
    accentHex: '#FFE600',
  };

  const controlPills: ReadonlyArray<{
    id: string;
    toneClass: string;
    tag: string;
    keyText: string;
    desc: string;
    detail: string;
    accentHex: string;
  }> = [
    {
      id: 'ctrl-high',
      toneClass: 'tone-cyan',
      tag: ctrlGuide.highTag,
      keyText: ctrlGuide.highKey,
      desc: ctrlGuide.highDesc,
      detail: ctrlGuide.highDetail,
      accentHex: '#05D5FF',
    },
    {
      id: 'ctrl-low',
      toneClass: 'tone-crimson',
      tag: ctrlGuide.lowTag,
      keyText: ctrlGuide.lowKey,
      desc: ctrlGuide.lowDesc,
      detail: ctrlGuide.lowDetail,
      accentHex: '#FF2A6D',
    },
    {
      id: 'ctrl-chord',
      toneClass: 'tone-gold',
      tag: ctrlGuide.chordTag,
      keyText: ctrlGuide.chordKey,
      desc: ctrlGuide.chordDesc,
      detail: ctrlGuide.chordDetail,
      accentHex: '#FFE600',
    },
    {
      id: 'ctrl-util',
      toneClass: 'tone-neutral',
      tag: ctrlGuide.utilTag,
      keyText: ctrlGuide.utilKey,
      desc: ctrlGuide.utilDesc,
      detail: ctrlGuide.utilDetail,
      accentHex: '#34D399',
    },
  ];

  return (
    <div
      className="start-screen-backdrop"
      onScrollCapture={hideTip}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Top Cyberpunk Arcade Hero HUD Bar */}
      <header className="hero-top-bar" data-testid="hero-top-bar">
        <div className="hero-brand-cluster">
          <div className="hero-eyebrow-row">
            <span className="badge-version">{t.menu.versionBadge}</span>
            <span
              className={`hero-engine-chip ${rendererMode === 'gl' ? 'is-gpu' : 'is-cpu'}`}
              aria-hidden="true"
            >
              {rendererMode === 'sw' ? 'SWCANVAS' : 'GLCANVAS'}
            </span>
          </div>
          <div className="hero-title-row">
            <h1 className="title-logo">
              THORVG <span className="title-logo-accent">RUN</span>
            </h1>
            <button
              type="button"
              className="menu-info-badge hero-info-btn"
              data-testid="menu-intro-info-btn"
              aria-label={t.menu.introTipTitle}
              {...bindHoverTip(introTip)}
              onClick={(e) => toggleTouchTip(e, introTip)}
            >
              ⓘ
            </button>
          </div>
          <p className="subtitle">{t.menu.subtitle}</p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="hero-guide-btn"
            data-testid="menu-guide-btn"
            onClick={onOpenGuide}
          >
            ? {t.menu.guideBtn}
          </button>
          <div className="lang-toggle" role="group" aria-label={t.menu.language}>
            {LANGS.map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                className={`lang-btn ${lang === code ? 'active' : ''}`}
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
              >
                {LANGUAGE_LABELS[code]}
              </button>
            ))}
          </div>
          <a
            href="https://github.com/OSSCA-thorvg/GameJam-ThorVG-Run"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            {t.menu.github}
          </a>
        </div>
      </header>

      {/* Bottom / Corner Angled Cut-Corner Cyberpunk Command Dock */}
      <div
        className={`cyber-dock-shell${isDragging ? ' dragging' : ''}`}
        data-testid="cyber-dock-shell"
      >
        <div
          className={`start-card${isDragging ? ' dragging' : ''}`}
          data-testid="start-card"
          data-menu-step={step}
          data-engine-ready={engineReady ? 'true' : 'false'}
        >
          <nav className="menu-stepper" data-testid="menu-stepper" aria-label={t.menu.stepperLabel}>
            <button
              type="button"
              data-testid="menu-step-setup"
              aria-current={step === 'setup' ? 'step' : undefined}
              className={`menu-step-tab${step === 'setup' ? ' active' : ' completed'}`}
              {...bindHoverTip(stepSetupTip)}
              onClick={() => onStepChange('setup')}
            >
              <span className="menu-step-num" aria-hidden="true">
                {step === 'track' ? '✓' : '01'}
              </span>
              <span className="menu-step-copy">
                <strong>{t.menu.stepSetupTitle}</strong>
              </span>
              <span className="step-summary-tag" aria-hidden="true">
                {rendererMode === 'sw' ? 'SW' : 'GL'} · {t.skins[selectedSkin].name}
              </span>
            </button>

            <button
              type="button"
              data-testid="menu-step-track"
              aria-current={step === 'track' ? 'step' : undefined}
              className={`menu-step-tab${step === 'track' ? ' active' : ''}`}
              {...bindHoverTip(stepTrackTip)}
              onClick={() => onStepChange('track')}
            >
              <span className="menu-step-num" aria-hidden="true">
                02
              </span>
              <span className="menu-step-copy">
                <strong>{t.menu.stepTrackTitle}</strong>
              </span>
              <span className="step-summary-tag" aria-hidden="true">
                {currentTrackTitle}
              </span>
            </button>
          </nav>

          <div ref={stepBodyRef} className="menu-step-body" data-step={step}>
            {step === 'setup' ? (
              <>
                {/* 1. Select Renderer Backend */}
                <section className="menu-section">
                  <h2>{t.menu.rendererSection}</h2>
                  <div className="renderer-radio-group">
                    {rendererOptions.map((opt) => (
                      <label
                        key={opt.mode}
                        data-testid={opt.testId}
                        data-mode={opt.mode}
                        className={`renderer-option${rendererMode === opt.mode ? ' selected' : ''}`}
                        onPointerEnter={(e) => {
                          if (e.pointerType === 'touch') return;
                          showTip(e.currentTarget, opt.tip);
                        }}
                        onPointerLeave={(e) => {
                          if (e.pointerType === 'touch') return;
                          hideTip();
                        }}
                      >
                        <input
                          type="radio"
                          name="renderer"
                          checked={rendererMode === opt.mode}
                          aria-describedby={activeTipId(opt.tip.id)}
                          onChange={() => onSelectRenderer(opt.mode)}
                          onFocus={(e) => {
                            if (
                              e.currentTarget.matches(':focus-visible') &&
                              e.currentTarget.parentElement
                            ) {
                              showTip(e.currentTarget.parentElement, opt.tip);
                            }
                          }}
                          onBlur={() => {
                            if (activeTip?.id === opt.tip.id) {
                              hideTip();
                            }
                          }}
                        />
                        <span className="renderer-icon-frame">
                          <HudVectorIcon kind={opt.icon} size={18} />
                        </span>
                        <div className="renderer-info">
                          <strong>{opt.title}</strong>
                          <span>{opt.desc}</span>
                        </div>
                        <span className="renderer-led" aria-hidden="true" />
                        <span className="menu-hover-cue" aria-hidden="true">
                          ⓘ
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                {/* 2. Crewmate Vector Suit Showcase (4-Col Desktop / 2x2 Mobile with Pure SVG Previews) */}
                <section className="menu-section">
                  <h2>{t.menu.skinSection}</h2>
                  <div className="skin-tabs" role="radiogroup" aria-label={t.menu.skinSection}>
                    {CREWMATE_SKIN_ORDER.map((skinKey) => {
                      const isEquipped = selectedSkin === skinKey;
                      const skinCfg = CREWMATE_SKIN_CONFIG[skinKey];
                      const skinInfo = t.skins[skinKey];
                      const skinTip: MenuTooltipData = {
                        id: `skin-${skinKey}`,
                        title: skinInfo.name,
                        body: skinInfo.detail,
                        meta: isEquipped ? t.menu.skinEquipped : t.menu.skinPreviewHint,
                        accentHex: skinCfg.accentHex,
                      };
                      return (
                        <button
                          key={skinKey}
                          type="button"
                          role="radio"
                          aria-checked={isEquipped}
                          data-testid={`skin-tab-${skinKey}`}
                          data-skin={skinKey}
                          className={`skin-tab${isEquipped ? ' active' : ''}`}
                          style={
                            isEquipped
                              ? {
                                  borderColor: skinCfg.accentHex,
                                  boxShadow: `inset 0 0 18px ${skinCfg.accentHex}26, 0 0 14px ${skinCfg.accentHex}28`,
                                }
                              : undefined
                          }
                          {...bindHoverTip(skinTip)}
                          onClick={() => onSelectSkin(skinKey)}
                        >
                          <div className="skin-card-top">
                            <small
                              className={`skin-status-pill ${isEquipped ? 'equipped' : 'available'}`}
                              style={
                                isEquipped
                                  ? { backgroundColor: skinCfg.accentHex, color: '#070914' }
                                  : undefined
                              }
                            >
                              {isEquipped ? t.menu.skinEquipped : skinInfo.badge}
                            </small>
                            <span className="menu-hover-cue" aria-hidden="true">
                              ⓘ
                            </span>
                          </div>
                          <div className="skin-card-main">
                            <div className="skin-preview-frame">
                              <SkinVectorPreview skinId={skinKey} active={isEquipped} />
                            </div>
                            <div className="skin-card-copy">
                              <strong style={{ color: skinCfg.accentHex }}>{skinInfo.name}</strong>
                              <span className="skin-summary-text">{skinInfo.summary}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <div className="dock-track-grid">
                {/* Left Column: Track Bay + Sibling Custom Audio Dropzone */}
                <div className="dock-col-tracks">
                  <section className="menu-section menu-track-section">
                    <div className="track-section-header">
                      <h2>{t.menu.trackSection}</h2>
                      <span className="track-count-pill">
                        {format(t.menu.trackCountSummary, { count: allTracks.length })}
                      </span>
                    </div>

                    <div className="track-list" data-testid="menu-track-list">
                      {allTracks.map((track) => {
                        const isSelected = selectedTrack.id === track.id;
                        const title = trackTitle(t, track);
                        const rec = getTrackRecord(track, difficulty);
                        const trackTip: MenuTooltipData = {
                          id: `track-${track.id}`,
                          title,
                          body: `${trackArtist(t, track)} · ${format(
                            track.isCustom ? t.menu.trackTipCustom : t.menu.trackTipBuiltIn,
                            { seconds: track.durationSec }
                          )}`,
                          meta: rec
                            ? `${t.difficulties[difficulty].shortName} · ${format(
                                t.menu.bestRecord,
                                {
                                  rank: rec.bestRank,
                                  score: rec.bestScore.toLocaleString(),
                                }
                              )} · ★${rec.bestStars}/3${
                                rec.noMissCleared ? ` · ${t.menu.noMissBadge}` : ''
                              }`
                            : format(t.menu.trackNoRecord, {
                                mode: t.difficulties[difficulty].shortName,
                              }),
                          accentHex: '#05D5FF',
                        };
                        return (
                          <button
                            key={track.id}
                            type="button"
                            data-testid={`track-item-${track.id}`}
                            className={`track-item${isSelected ? ' selected' : ''}`}
                            {...bindHoverTip(trackTip)}
                            onClick={() => onSelectTrack(track)}
                          >
                            <span className="track-icon">
                              <HudVectorIcon
                                kind={track.isCustom ? 'customTrack' : 'track'}
                                size={17}
                              />
                            </span>
                            <div className="track-meta">
                              <strong>{title}</strong>
                              <span>
                                {format(t.menu.trackMeta, {
                                  artist: trackArtist(t, track),
                                  seconds: track.durationSec,
                                })}
                              </span>
                            </div>
                            {rec && (
                              <div className="track-record-badges">
                                <span className="pb-pill">
                                  {format(t.menu.bestRecord, {
                                    rank: rec.bestRank,
                                    score: rec.bestScore.toLocaleString(),
                                  })}
                                </span>
                                <span className="pb-stars-pill">★ {rec.bestStars}/3</span>
                                {rec.noMissCleared && (
                                  <span className="pb-nomiss-pill">{t.menu.noMissBadge}</span>
                                )}
                              </div>
                            )}
                            {isSelected && <span className="selected-pill">{t.menu.selected}</span>}
                            <span className="menu-hover-cue" aria-hidden="true">
                              ⓘ
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="upload-dropzone-row">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={acceptAttr}
                        tabIndex={-1}
                        aria-hidden="true"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          void handleFiles(e.target.files);
                          // Allow re-selecting the same file after an error.
                          e.target.value = '';
                        }}
                      />
                      <div
                        className="upload-dropzone"
                        data-testid="menu-upload-dropzone"
                        role="button"
                        tabIndex={0}
                        {...bindHoverTip(uploadDropzoneTip)}
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <span className="upload-dropzone-left">
                          <HudVectorIcon kind="plus" size={14} />
                          <span className="upload-dropzone-title">{t.upload.dropzone}</span>
                        </span>
                        <span className="upload-dropzone-sub">{t.upload.dropzoneSub}</span>
                      </div>
                      <button
                        type="button"
                        className="menu-info-badge upload-format-btn"
                        data-testid="menu-upload-info-btn"
                        aria-label={t.upload.tipTitle}
                        {...bindHoverTip(uploadInfoTip)}
                        onClick={(e) => toggleTouchTip(e, uploadInfoTip)}
                      >
                        {t.upload.formatBadge}
                      </button>
                    </div>
                    {uploadStatus && <small className="upload-status">{uploadStatus}</small>}
                  </section>
                </div>

                {/* Right Column: Play Mode Switch + Loadout Summary + 2x2 Controls Matrix */}
                <div className="dock-col-ops">
                  <div className="menu-mode-loadout-bar" data-testid="menu-mode-loadout-bar">
                    <div
                      className="difficulty-tabs"
                      role="radiogroup"
                      aria-label={t.menu.difficultySection}
                    >
                      {DIFFICULTY_MODES.map((modeKey) => {
                        const accent = DIFFICULTY_CONFIG[modeKey].colorHex;
                        const info = t.difficulties[modeKey];
                        const active = difficulty === modeKey;
                        const modeRec = getTrackRecord(selectedTrack, modeKey);
                        const diffTip: MenuTooltipData = {
                          id: `difficulty-${modeKey}`,
                          title: info.tipTitle,
                          body: info.tipBody,
                          meta: modeRec
                            ? `${format(t.menu.bestRecord, {
                                rank: modeRec.bestRank,
                                score: modeRec.bestScore.toLocaleString(),
                              })} · ★${modeRec.bestStars}/3`
                            : info.tag,
                          accentHex: accent,
                        };
                        return (
                          <button
                            key={modeKey}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            data-testid={`difficulty-tab-${modeKey}`}
                            data-difficulty={modeKey}
                            className={`difficulty-tab${active ? ' active' : ''}`}
                            style={{
                              borderColor: active ? accent : undefined,
                              boxShadow: active ? `inset 0 0 14px ${accent}22` : undefined,
                            }}
                            {...bindHoverTip(diffTip)}
                            onClick={() => onSelectDifficulty(modeKey)}
                          >
                            <span
                              className="difficulty-title-wrap"
                              style={{ color: active ? accent : '#dce8ff' }}
                            >
                              <HudVectorIcon kind={modeKey} size={14} />
                              <strong>{info.shortName}</strong>
                            </span>
                            <small className="difficulty-speed-pill">{info.tag}</small>
                          </button>
                        );
                      })}
                    </div>

                    <div className="menu-loadout-summary" data-testid="menu-loadout-summary">
                      <span className="loadout-chip">
                        <HudVectorIcon kind={rendererMode === 'sw' ? 'cpu' : 'gpu'} size={13} />
                        <span>
                          {rendererMode === 'sw' ? t.menu.loadoutCpuShort : t.menu.loadoutGpuShort}
                        </span>
                      </span>
                      <span
                        className="loadout-chip skin-chip"
                        style={{
                          borderColor: `${equippedSkinCfg.accentHex}66`,
                          color: equippedSkinCfg.accentHex,
                        }}
                      >
                        ✦ {t.skins[selectedSkin].name}
                      </span>
                      <button
                        type="button"
                        className="loadout-edit-btn"
                        data-testid="menu-edit-setup-btn"
                        {...bindHoverTip(editSetupTip)}
                        onClick={() => onStepChange('setup')}
                      >
                        <HudVectorIcon kind="gear" size={13} />
                        <span>{t.menu.editSetupBtn}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2-Lane Core Controls Guide */}
                  <div className="menu-controls-wrap">
                    <div className="controls-header-row">
                      <h3 className="controls-guide-title">{t.menu.controlsSectionTitle}</h3>
                      <div className="controls-header-actions">
                        <button
                          type="button"
                          className="menu-info-badge"
                          data-testid="menu-controls-guide-btn"
                          onClick={onOpenGuide}
                        >
                          ? {t.menu.guideBtn}
                        </button>
                        <button
                          type="button"
                          className="menu-info-badge"
                          data-testid="menu-resonance-info-btn"
                          aria-label={t.menu.resonanceTipTitle}
                          {...bindHoverTip(resonanceInfoTip)}
                          onClick={(e) => toggleTouchTip(e, resonanceInfoTip)}
                        >
                          {t.menu.resonanceBadge}
                        </button>
                      </div>
                    </div>
                    <div className="controls-pill-grid" data-testid="menu-controls-guide">
                      {controlPills.map((pill) => {
                        const pillTip: MenuTooltipData = {
                          id: pill.id,
                          title: `${pill.tag} · ${pill.desc}`,
                          body: pill.detail,
                          meta: pill.keyText,
                          accentHex: pill.accentHex,
                        };
                        return (
                          <div
                            key={pill.id}
                            tabIndex={0}
                            className={`control-guide-pill ${pill.toneClass}`}
                            {...bindHoverTip(pillTip)}
                            onClick={(e) => toggleTouchTip(e, pillTip)}
                          >
                            <div className="control-pill-top">
                              <span className="control-lane-tag">{pill.tag}</span>
                              <strong>{pill.keyText}</strong>
                            </div>
                            <small>{pill.desc}</small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {step === 'setup' ? (
            <footer className="start-footer">
              <button
                type="button"
                className="menu-next-btn"
                data-testid="menu-next-step-btn"
                onClick={() => onStepChange('track')}
              >
                {t.menu.nextToTrackBtn}
              </button>
            </footer>
          ) : (
            <footer className="start-footer start-footer-dual">
              <button
                type="button"
                className="menu-prev-btn"
                data-testid="menu-prev-step-btn"
                onClick={() => onStepChange('setup')}
              >
                {t.menu.prevToSetupBtn}
              </button>
              <button
                type="button"
                className="start-run-btn"
                data-testid="start-run-btn"
                disabled={!engineReady}
                onClick={onStartRun}
              >
                {engineReady ? t.menu.start : t.menu.initializing}
              </button>
            </footer>
          )}
        </div>
      </div>
      <MenuTooltipPortal activeTip={activeTip} hideTip={hideTip} />
      <BeginnerGuideModal open={isGuideOpen} onClose={onCloseGuide} />
    </div>
  );
};
