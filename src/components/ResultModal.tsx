import React from 'react';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { useI18n } from '../i18n/I18nProvider';
import {
  FORM_CONFIG,
  type HUDTelemetry,
  type JudgmentTelemetry,
  type RendererMode,
  type ResultRank,
} from '../types/game';

interface ResultModalProps {
  hud: HUDTelemetry;
  trackTitle: string;
  onReplay: () => void;
  onSwitchRendererAndReplay: (nextMode: RendererMode) => void;
  onReturnToMenu: () => void;
}

const RANK_COLORS: Record<ResultRank, string> = {
  S: '#FFE600',
  A: '#05D5FF',
  B: '#34D399',
  C: '#FF2A6D',
};

const EMPTY_TELEMETRY: JudgmentTelemetry = {
  criticalCount: 0,
  fastCount: 0,
  slowCount: 0,
  timedHitCount: 0,
  meanSignedDeltaMs: 0,
};

function formatSignedMs(value: number): string {
  if (!Number.isFinite(value)) return '0.0ms';
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded) < 1e-6) return '0.0ms';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}ms`;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  hud,
  trackTitle,
  onReplay,
  onSwitchRendererAndReplay,
  onReturnToMenu,
}) => {
  const { t, format } = useI18n();
  const isCoarsePointer = useCoarsePointer();
  const formCfg = FORM_CONFIG[hud.activeForm];
  const nextMode: RendererMode = hud.rendererMode === 'sw' ? 'gl' : 'sw';
  const isFailed = Boolean(hud.isFailed);
  const rank: ResultRank = hud.rank ?? 'S';
  const displayRank = isFailed ? 'F' : rank;
  const rankColor = isFailed ? '#FF2A6D' : RANK_COLORS[rank];
  const accuracy = (hud.accuracy ?? 100).toFixed(1);
  const counts = hud.judgmentCounts ?? { perfect: 0, great: 0, good: 0, miss: 0 };
  const telemetry = hud.judgmentTelemetry ?? EMPTY_TELEMETRY;
  const showSyncHint =
    telemetry.timedHitCount >= 1 && Math.abs(telemetry.meanSignedDeltaMs) >= 15;
  const suggestMs = Math.min(
    150,
    Math.max(15, Math.round(Math.abs(telemetry.meanSignedDeltaMs) / 5) * 5)
  );
  const syncHintText = showSyncHint
    ? format(
        telemetry.meanSignedDeltaMs > 0
          ? isCoarsePointer
            ? t.result.syncHintLateTouch
            : t.result.syncHintLate
          : isCoarsePointer
            ? t.result.syncHintEarlyTouch
            : t.result.syncHintEarly,
        { ms: suggestMs }
      )
    : '';
  const judgedHits = counts.perfect + counts.great + counts.good;
  const expectedTargets = hud.totalOrbs ?? 0;
  const allTargetsCleared =
    expectedTargets > 0
      ? (hud.orbsCollected ?? judgedHits) >= expectedTargets && judgedHits >= expectedTargets
      : judgedHits > 0;
  const isNoMiss = !isFailed && counts.miss === 0 && allTargetsCleared;
  const failedProgressPct = Math.min(99, Math.max(0, Math.round(hud.progress * 100)));

  return (
    <div className="result-modal-backdrop">
      <div
        className={`result-modal-card${isFailed ? ' is-failed' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-modal-title"
        style={{ borderColor: isFailed ? '#FF2A6D' : formCfg.colorHex }}
      >
        {isFailed ? (
          <span className="result-badge failed" data-testid="result-failed-badge">
            ⚠️ {t.result.failedBadge}
          </span>
        ) : (
          <span className="result-badge">{t.result.badge}</span>
        )}
        <h2 id="result-modal-title">{trackTitle}</h2>

        {!isFailed && (hud.isNewRecord || isNoMiss) && (
          <div className="result-honors-row">
            {hud.isNewRecord && (
              <span className="result-new-record-pill">
                {format(t.result.newRecord, {
                  delta: Math.max(0, hud.scoreDelta ?? hud.score).toLocaleString(),
                })}
              </span>
            )}
            {isNoMiss && <span className="result-nomiss-pill">{t.result.noMissClear}</span>}
          </div>
        )}

        <p className="result-engine-tag">
          {t.result.renderedVia}{' '}
          <strong>{hud.rendererMode === 'sw' ? t.result.cpuEngine : t.result.gpuEngine}</strong>
        </p>

        {/* Hero Rank & Accuracy Showcase */}
        <div className={`result-rank-hero${isFailed ? ' failed' : ''}`}>
          <div className="rank-emblem-box">
            <small>{t.result.rank}</small>
            <strong className="rank-emblem" style={{ color: rankColor }}>
              {displayRank}
            </strong>
          </div>
          <div className="rank-accuracy-box">
            <div className="rank-accuracy-top">
              <small>{t.result.accuracy}</small>
              {isFailed && (
                <span className="failed-progress-pill" data-testid="result-failed-progress">
                  {format(t.result.failedProgress, { pct: failedProgressPct })}
                </span>
              )}
            </div>
            <strong style={{ color: rankColor }}>
              {format(t.result.accuracyValue, { value: accuracy })}
            </strong>
            <span className="judgment-breakdown-bar">
              {format(t.result.judgmentBreakdown, {
                perfect: counts.perfect,
                great: counts.great,
                good: counts.good,
                miss: counts.miss,
              })}
            </span>
            <div className="result-timing-telemetry-row" data-testid="result-timing-telemetry">
              <span className="result-telemetry-chip tone-gold" data-testid="result-critical-stat">
                {format(t.result.criticalStat, { count: telemetry.criticalCount })}
              </span>
              <span className="result-telemetry-chip tone-cyan" data-testid="result-fast-slow-stat">
                {format(t.result.fastSlowStat, {
                  fast: telemetry.fastCount,
                  slow: telemetry.slowCount,
                })}
              </span>
              <span
                className="result-telemetry-chip tone-neutral"
                data-testid="result-mean-delta-stat"
              >
                {format(t.result.meanDeltaStat, {
                  value:
                    telemetry.timedHitCount > 0
                      ? formatSignedMs(telemetry.meanSignedDeltaMs)
                      : '0.0ms',
                })}
              </span>
            </div>
            {showSyncHint && (
              <div className="result-sync-hint-pill" data-testid="result-sync-offset-hint">
                {syncHintText}
              </div>
            )}
          </div>
        </div>

        <div className="result-stats-grid">
          <div className="stat-item">
            <small>{t.result.finalScore}</small>
            <strong>{hud.score.toLocaleString()}</strong>
          </div>
          <div className="stat-item">
            <small>{t.result.maxCombo}</small>
            <strong style={{ color: formCfg.colorHex }}>x{hud.maxCombo}</strong>
          </div>
          <div className="stat-item">
            <small>{t.result.orbs}</small>
            <strong>
              {format(t.result.orbsValue, {
                collected: hud.orbsCollected ?? 0,
                total: hud.totalOrbs ?? 0,
              })}
            </strong>
          </div>
          <div className="stat-item">
            <small>{t.result.stars}</small>
            <strong style={{ color: '#FFE600' }}>
              {format(t.result.starsValue, {
                collected: hud.starsCollected ?? 0,
                total: hud.totalStars ?? 3,
              })}
            </strong>
          </div>
          <div className="stat-item">
            <small>{t.result.dives}</small>
            <strong>{format(t.result.divesValue, { count: hud.gimmicksTriggered ?? 0 })}</strong>
          </div>
          <div className="stat-item">
            <small>{t.result.traps}</small>
            <strong>{format(t.result.trapsValue, { count: hud.trapsDestroyed })}</strong>
          </div>
        </div>

        <div className="result-actions">
          <button
            type="button"
            data-testid="result-replay-btn"
            className="primary-btn"
            onClick={onReplay}
          >
            {isFailed
              ? isCoarsePointer
                ? t.result.instantRetryTouch
                : t.result.instantRetry
              : t.result.replay}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => onSwitchRendererAndReplay(nextMode)}
          >
            {nextMode === 'gl' ? t.result.compareGpu : t.result.compareCpu}
          </button>
          <button type="button" className="ghost-btn" onClick={onReturnToMenu}>
            {t.result.backToMenu}
          </button>
        </div>
      </div>
    </div>
  );
};
