import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadGuideDismissed, saveGuideDismissed } from '../engine/recordsStore';
import { useCoarsePointer } from '../hooks/useCoarsePointer';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGE_LABELS, type Lang, type Messages } from '../i18n/messages';

const LANGS: Lang[] = ['en', 'ko'];

export type GuideDiagramKind = 'laneSlash' | 'chordHold' | 'hazardDodge' | 'modeOverdrive';

interface GuideIllustrationProps {
  kind: GuideDiagramKind;
  svg: Messages['guide']['svg'];
}

const GuideIllustration: React.FC<GuideIllustrationProps> = ({ kind, svg }) => {
  return (
    <svg
      viewBox="0 0 280 88"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className="guide-card-svg"
      data-testid={`guide-svg-${kind}`}
    >
      {/* Shared Cyber Stage Lane Lines */}
      <line x1="6" y1="26" x2="274" y2="26" stroke="#05D5FF" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="6" y1="62" x2="274" y2="62" stroke="#FF2A6D" strokeOpacity="0.34" strokeWidth="1.2" />
      <line x1="6" y1="76" x2="274" y2="76" stroke="#05D5FF" strokeOpacity="0.4" strokeWidth="1.4" />

      {kind === 'laneSlash' && (
        <g>
          {/* Sync Pillar & Dual Neon Reticles */}
          <line x1="56" y1="26" x2="56" y2="62" stroke="#9BE8FF" strokeOpacity="0.45" strokeWidth="1.4" />
          <polygon
            points="56,12 70,26 56,40 42,26"
            fill="#05D5FF"
            fillOpacity="0.14"
            stroke="#05D5FF"
            strokeWidth="2"
          />
          <polygon
            points="56,17 65,26 56,35 47,26"
            fill="none"
            stroke="#CCF8FF"
            strokeWidth="1.2"
          />
          <polygon
            points="56,48 69,55 69,69 56,76 43,69 43,55"
            fill="#FF2A6D"
            fillOpacity="0.14"
            stroke="#FF2A6D"
            strokeWidth="2"
          />

          {/* Mini Crewmate + Katana Slash Arc on 2F */}
          <rect x="20" y="17" width="14" height="17" rx="6" fill="#FF3B5C" stroke="#FFFFFF" strokeWidth="1.1" />
          <rect x="25" y="20" width="9" height="5" rx="2.5" fill="#7CF3FF" />
          <path
            d="M 32 34 Q 56 8 79 20"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 30 36 Q 56 11 81 22"
            fill="none"
            stroke="#05D5FF"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Incoming 2F Cyan Dart Drone */}
          <line x1="146" y1="26" x2="88" y2="26" stroke="#05D5FF" strokeWidth="1.6" strokeDasharray="3 3" />
          <polygon points="88,26 95,22 95,30" fill="#05D5FF" />
          <polygon
            points="146,26 168,16 162,26 168,36"
            fill="#05D5FF"
            stroke="#E8FCFF"
            strokeWidth="1.4"
          />
          <text x="180" y="29" fill="#8CEEFF" fontSize="9.5" fontWeight="800" fontFamily="monospace">
            {svg.highLane}
          </text>

          {/* Incoming 1F Crimson Hex Core */}
          <line x1="194" y1="62" x2="88" y2="62" stroke="#FF2A6D" strokeWidth="1.6" strokeDasharray="3 3" />
          <polygon points="88,62 95,58 95,66" fill="#FF2A6D" />
          <polygon
            points="206,51 217,56 217,68 206,73 195,68 195,56"
            fill="#FF2A6D"
            stroke="#FFD6E4"
            strokeWidth="1.4"
          />
          <circle cx="206" cy="62" r="3.5" fill="#FFF0F5" />
          <text x="220" y="65" fill="#FF98B8" fontSize="9.5" fontWeight="800" fontFamily="monospace">
            {svg.lowLane}
          </text>
        </g>
      )}

      {kind === 'chordHold' && (
        <g>
          {/* Left: Linked Twin Gold Cross Cores */}
          <rect x="61" y="24" width="6" height="38" rx="3" fill="#FFE600" fillOpacity="0.38" />
          <line x1="64" y1="24" x2="64" y2="62" stroke="#FFF8B8" strokeWidth="2.2" />
          <circle cx="64" cy="24" r="12" fill="#FFE600" stroke="#FFFBE0" strokeWidth="1.6" />
          <circle cx="64" cy="62" r="12" fill="#FFE600" stroke="#FFFBE0" strokeWidth="1.6" />
          <circle cx="64" cy="24" r="5" fill="#070914" />
          <circle cx="64" cy="62" r="5" fill="#070914" />

          {/* Cross Katana Cleave */}
          <line x1="42" y1="14" x2="86" y2="72" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="86" y1="14" x2="42" y2="72" stroke="#FFE600" strokeWidth="2" strokeLinecap="round" />
          <text x="20" y="46" fill="#FFE600" fontSize="9" fontWeight="900" fontFamily="monospace">
            {svg.dual}
          </text>

          {/* Divider */}
          <line x1="114" y1="12" x2="114" y2="74" stroke="#24385E" strokeWidth="1" />

          {/* Right: Hold Ribbon Tail Note */}
          <rect
            x="144"
            y="36"
            width="108"
            height="16"
            rx="8"
            fill="#05D5FF"
            fillOpacity="0.22"
            stroke="#05D5FF"
            strokeWidth="1.6"
          />
          <line x1="154" y1="44" x2="242" y2="44" stroke="#BDF8FF" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="144" cy="44" r="10" fill="#05D5FF" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="252" cy="44" r="7" fill="#34D399" stroke="#E6FFF5" strokeWidth="1.4" />
          <text x="156" y="27" fill="#9BF2FF" fontSize="9.5" fontWeight="800" fontFamily="monospace">
            {svg.holdRibbon}
          </text>
        </g>
      )}

      {kind === 'hazardDodge' && (
        <g>
          {/* Left: 1F Spinning Red Sawblade + 2F Cyan Vault Arc */}
          <g transform="translate(86,62)">
            <polygon
              points="0,-14 4,-9 10,-10 9,-4 14,0 9,4 10,10 4,9 0,14 -4,9 -10,10 -9,4 -14,0 -9,-4 -10,-10 -4,-9"
              fill="#FF2A6D"
              stroke="#FFD1DF"
              strokeWidth="1.2"
            />
            <circle cx="0" cy="0" r="4.5" fill="#070914" />
          </g>
          <path
            d="M 32 62 Q 84 6 128 24"
            fill="none"
            stroke="#05D5FF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <polygon points="131,25 122,20 124,29" fill="#05D5FF" />
          <text x="54" y="21" fill="#7CF3FF" fontSize="9" fontWeight="800" fontFamily="monospace">
            {svg.safeJump}
          </text>

          {/* Right: 2F Sky Mine + 1F Safe Duck Arc */}
          <g transform="translate(206,26)">
            <polygon
              points="0,-13 3.5,-6 11,-9 6,-2 13,0 6,2 11,9 3.5,6 0,13 -3.5,6 -11,9 -6,2 -13,0 -6,-2 -11,-9 -3.5,-6"
              fill="#FF2A6D"
              stroke="#FFE0EA"
              strokeWidth="1.1"
            />
            <circle cx="0" cy="0" r="4" fill="#FFE600" />
          </g>
          <path
            d="M 156 28 Q 202 74 252 60"
            fill="none"
            stroke="#34D399"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <polygon points="255,59 246,56 248,65" fill="#34D399" />
          <text x="180" y="72" fill="#74F2C0" fontSize="9" fontWeight="800" fontFamily="monospace">
            {svg.safeDuck}
          </text>
        </g>
      )}

      {kind === 'modeOverdrive' && (
        <g>
          {/* Left Box: Casual No-Fail Shield */}
          <rect
            x="12"
            y="12"
            width="112"
            height="64"
            rx="5"
            fill="#00F5A0"
            fillOpacity="0.09"
            stroke="#00F5A0"
            strokeOpacity="0.65"
            strokeWidth="1.4"
          />
          <path
            d="M 34 24 L 46 29 L 46 41 C 46 49 40 55 34 58 C 28 55 22 49 22 41 L 22 29 Z"
            fill="#00F5A0"
            fillOpacity="0.24"
            stroke="#00F5A0"
            strokeWidth="1.8"
          />
          <polyline
            points="29,41 33,45 40,36"
            fill="none"
            stroke="#E6FFF6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="54" y="38" fill="#74FFD0" fontSize="9.5" fontWeight="900" fontFamily="monospace">
            {svg.casualTitle}
          </text>
          <text x="54" y="51" fill="#D9FFF2" fontSize="8.5" fontWeight="700" fontFamily="monospace">
            {svg.casualSub}
          </text>

          {/* Top-Right Box: 100% Overdrive Bar */}
          <rect
            x="134"
            y="12"
            width="134"
            height="29"
            rx="4"
            fill="#FFE600"
            fillOpacity="0.1"
            stroke="#FFE600"
            strokeOpacity="0.65"
            strokeWidth="1.3"
          />
          <text x="142" y="24" fill="#FFE600" fontSize="8.5" fontWeight="900" fontFamily="monospace">
            {svg.overdrive}
          </text>
          <rect x="142" y="29" width="118" height="6" rx="3" fill="#1C2742" />
          <rect x="142" y="29" width="118" height="6" rx="3" fill="#FFE600" />

          {/* Bottom-Right Box: 20x Pure Vector Zoom */}
          <rect
            x="134"
            y="47"
            width="134"
            height="29"
            rx="4"
            fill="#05D5FF"
            fillOpacity="0.1"
            stroke="#05D5FF"
            strokeOpacity="0.6"
            strokeWidth="1.3"
          />
          <circle cx="151" cy="61" r="7" fill="none" stroke="#05D5FF" strokeWidth="1.8" />
          <line x1="156" y1="66" x2="162" y2="72" stroke="#05D5FF" strokeWidth="2" strokeLinecap="round" />
          <text x="169" y="64" fill="#B8F6FF" fontSize="9" fontWeight="800" fontFamily="monospace">
            {svg.zoom}
          </text>
        </g>
      )}
    </svg>
  );
};

interface BeginnerGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const BeginnerGuideModal: React.FC<BeginnerGuideModalProps> = ({ open, onClose }) => {
  const { lang, setLang, t } = useI18n();
  const isCoarsePointer = useCoarsePointer();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [dismissChecked, setDismissChecked] = useState<boolean>(() => loadGuideDismissed());

  useEffect(() => {
    if (!open) return;
    setDismissChecked(loadGuideDismissed());

    const prevFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    closeBtnRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (prevFocused && prevFocused !== document.body && prevFocused.isConnected) {
        prevFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const c = t.guide.cards;
  const cards: ReadonlyArray<{
    id: GuideDiagramKind;
    accentClass: string;
    step: string;
    title: string;
    chips: readonly { text: string; tone: 'cyan' | 'crimson' | 'gold' | 'emerald' }[];
    desc: string;
  }> = [
    {
      id: 'laneSlash',
      accentClass: 'tone-cyan',
      step: c.slash.step,
      title: c.slash.title,
      chips: [
        { text: isCoarsePointer ? c.slash.chipHighTouch : c.slash.chipHigh, tone: 'cyan' },
        { text: isCoarsePointer ? c.slash.chipLowTouch : c.slash.chipLow, tone: 'crimson' },
      ],
      desc: c.slash.desc,
    },
    {
      id: 'chordHold',
      accentClass: 'tone-gold',
      step: c.chord.step,
      title: c.chord.title,
      chips: [
        { text: isCoarsePointer ? c.chord.chipChordTouch : c.chord.chipChord, tone: 'gold' },
        { text: c.chord.chipHold, tone: 'cyan' },
      ],
      desc: c.chord.desc,
    },
    {
      id: 'hazardDodge',
      accentClass: 'tone-crimson',
      step: c.dodge.step,
      title: c.dodge.title,
      chips: [
        { text: c.dodge.chipSaw, tone: 'cyan' },
        { text: c.dodge.chipMine, tone: 'emerald' },
      ],
      desc: c.dodge.desc,
    },
    {
      id: 'modeOverdrive',
      accentClass: 'tone-emerald',
      step: c.modes.step,
      title: c.modes.title,
      chips: [
        { text: c.modes.chipCasual, tone: 'emerald' },
        { text: isCoarsePointer ? c.modes.chipBoostTouch : c.modes.chipBoost, tone: 'gold' },
      ],
      desc: c.modes.desc,
    },
  ];

  return createPortal(
    <div
      className="guide-modal-backdrop"
      data-testid="beginner-guide-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beginner-guide-title"
        className="guide-modal-shell"
        data-testid="beginner-guide-modal"
      >
        <div className="guide-modal-card">
          <header className="guide-modal-header">
            <div className="guide-modal-title-group">
              <span className="guide-modal-badge">{t.guide.badge}</span>
              <h2 id="beginner-guide-title" className="guide-modal-title">
                {t.guide.title}
              </h2>
              <p className="guide-modal-subtitle">{t.guide.subtitle}</p>
            </div>
            <div className="guide-modal-header-actions">
              <div
                className="lang-toggle"
                role="group"
                aria-label={t.menu.language}
                data-testid="guide-lang-toggle"
              >
                {LANGS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    lang={code}
                    className={`lang-btn ${lang === code ? 'active' : ''}`}
                    data-testid={`guide-lang-btn-${code}`}
                    aria-pressed={lang === code}
                    onClick={() => setLang(code)}
                  >
                    {LANGUAGE_LABELS[code]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="guide-icon-close-btn"
                data-testid="guide-close-icon-btn"
                aria-label={t.guide.closeAria}
                onClick={onClose}
              >
                ✕
              </button>
            </div>
          </header>

          <div className="guide-modal-body" data-testid="guide-modal-body">
            <div className="guide-cards-grid">
              {cards.map((card) => (
                <article
                  key={card.id}
                  className={`guide-step-card ${card.accentClass}`}
                  data-testid={`guide-card-${card.id}`}
                >
                  <div className="guide-card-head">
                    <span className="guide-step-pill">{card.step}</span>
                    <strong className="guide-card-title">{card.title}</strong>
                  </div>
                  <GuideIllustration kind={card.id} svg={t.guide.svg} />
                  <div className="guide-chip-row">
                    {card.chips.map((chip) => (
                      <span key={chip.text} className={`guide-key-chip chip-${chip.tone}`}>
                        {chip.text}
                      </span>
                    ))}
                  </div>
                  <p className="guide-card-desc">{card.desc}</p>
                </article>
              ))}
            </div>
          </div>

          <footer className="guide-modal-footer">
            <label className="guide-dismiss-check">
              <input
                type="checkbox"
                data-testid="guide-dismiss-checkbox"
                checked={dismissChecked}
                onChange={(e) => {
                  const next = e.target.checked;
                  setDismissChecked(next);
                  saveGuideDismissed(next);
                }}
              />
              <span>{t.guide.dismissLabel}</span>
            </label>
            <button
              ref={closeBtnRef}
              type="button"
              className="guide-close-btn"
              data-testid="guide-close-btn"
              onClick={onClose}
            >
              {t.guide.closeBtn}
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
};
