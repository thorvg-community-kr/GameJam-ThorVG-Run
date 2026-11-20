import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANG,
  MESSAGES,
  formatMessage,
  type Lang,
  type MessageParams,
  type Messages,
} from './messages';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Messages;
  format: (template: string, params?: MessageParams) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const LANG_STORAGE_KEY = 'thorvg_run:lang:v1';

function loadInitialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ko') {
      return saved;
    }
  } catch {
    // Ignore storage access errors (e.g. private browsing / restricted context).
  }
  return DEFAULT_LANG;
}

/**
 * Provides the active language. Defaults to `DEFAULT_LANG` (`'en'`) when unset,
 * and restores/persists `'en' | 'ko'` only when explicitly switched by the user.
 */
export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Lang>(() => loadInitialLang());
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Ignore storage access errors.
    }
  }, []);
  const t = MESSAGES[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.app.title;
  }, [lang, t]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t, format: formatMessage }),
    [lang, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return ctx;
}
