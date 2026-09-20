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
    root.style.setProperty('--quran-font-scale', String(settings.quranFontScale));
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
  }, [settings]);

  const updateSettings = useCallback((updater: (settings: AppSettings) => AppSettings) => {
    const next = settingsRepository.updateSettings(updater);
    setSettings(next);
    return next;
  }, []);

  return { settings, setSettings: updateSettings };
}
