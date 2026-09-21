import { useCallback, useEffect, useState } from 'react';
import type { AppSettings } from '../core/types';
import { settingsRepository } from './settingsRepository';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => settingsRepository.getSettings());

  useEffect(() => {
    const root = document.documentElement;
    root.lang = settings.language;
    root.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    root.style.setProperty('--font-scale', String(settings.fontScale));
    root.style.setProperty('--quran-font-scale', String(settings.reading.quranFontScale ?? settings.quranFontScale));
    root.style.setProperty('--quran-line-height', String(settings.reading.quranLineHeight ?? 2.5));
    root.style.setProperty('--quran-font-family', settings.reading.quranFontFamily === 'notoNaskh' ? '"Noto Naskh Arabic", serif' : '"Amiri Quran", "Noto Naskh Arabic", serif');
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1715' : '#f6f2e9');
  }, [settings]);

  const updateSettings = useCallback((updater: (settings: AppSettings) => AppSettings) => {
    const next = settingsRepository.updateSettings(updater);
    setSettings(next);
    return next;
  }, []);

  return { settings, setSettings: updateSettings };
}
