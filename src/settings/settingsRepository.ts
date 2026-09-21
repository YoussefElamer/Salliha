import type { AppSettings } from '../core/types';
import { storage } from '../core/storage';
import { APP_VERSION, defaultSettings, legacyCityIds, SETTINGS_VERSION } from './defaults';

export interface SettingsRepository {
  getSettings(): AppSettings;
  saveSettings(settings: AppSettings): void;
  updateSettings(updater: (settings: AppSettings) => AppSettings): AppSettings;
  resetSettings(): AppSettings;
  exportLocalBackup(): string;
  importLocalBackup(payload: string): AppSettings;
}

const SETTINGS_KEY = 'settings:v1';
export const EXPORTED_KEYS = [
  'bookmarks:v1',
  'reading-position:v1',
  'memorization:v1',
  'dhikr-progress:v1',
  'dhikr-counters:v1',
  'playback-snapshot:v1',
  'downloads:v1',
  'stats:v1',
  'salliha:reciter'
];

/**
 * يدمج الإعدادات المحفوظة مع الافتراضية، ويتعامل مع الترقية من الإصدار الأول:
 * معرّفات المدن القديمة (makkah, cairo…) تُترجم إلى GeoNames، والمدينة اليدوية
 * تتحول إلى وضع «تحديد تلقائي» حتى لا تبقى المواقيت على مدينة لا يقصدها المستخدم.
 */
function mergeSettings(settings: Partial<AppSettings> & { version?: number }): AppSettings {
  const savedVersion = typeof settings.version === 'number' ? settings.version : 1;
  const savedPrayer = (settings.prayer ?? {}) as Partial<AppSettings['prayer']> & { cityId?: string };
  const translatedCityId = savedPrayer.cityId ? legacyCityIds[savedPrayer.cityId] ?? savedPrayer.cityId : '';
  const hadManualLegacyCity = savedVersion < SETTINGS_VERSION && Boolean(savedPrayer.cityId);

  const prayer: AppSettings['prayer'] = {
    ...defaultSettings.prayer,
    ...savedPrayer,
    cityId: translatedCityId,
    locationMode: hadManualLegacyCity ? 'auto' : savedPrayer.locationMode ?? defaultSettings.prayer.locationMode,
    offsets: { ...defaultSettings.prayer.offsets, ...(savedPrayer.offsets ?? {}) },
    adhanEnabled: { ...defaultSettings.prayer.adhanEnabled, ...(savedPrayer.adhanEnabled ?? {}) },
    calculationMethod: savedPrayer.calculationMethod ?? defaultSettings.prayer.calculationMethod,
    resolved: savedPrayer.resolved ?? null
  };

  const merged: AppSettings = {
    ...defaultSettings,
    ...settings,
    prayer,
    playback: {
      ...defaultSettings.playback,
      ...(settings.playback ?? {}),
      reciterId: settings.playback?.reciterId ?? settings.defaultReciterId ?? defaultSettings.playback.reciterId,
      range: settings.playback?.range ?? null
    },
    reading: {
      ...defaultSettings.reading,
      ...(settings.reading ?? {}),
      quranFontScale: settings.reading?.quranFontScale ?? settings.quranFontScale ?? defaultSettings.reading.quranFontScale
    },
    adhkar: { ...defaultSettings.adhkar, ...(settings.adhkar ?? {}) },
    quranFontScale: settings.reading?.quranFontScale ?? settings.quranFontScale ?? defaultSettings.quranFontScale,
    onboardingVersion: typeof settings.onboardingVersion === 'number' ? settings.onboardingVersion : defaultSettings.onboardingVersion,
    defaultReciterId: settings.playback?.reciterId ?? settings.defaultReciterId ?? defaultSettings.defaultReciterId
  };

  return merged;
}

export class LocalSettingsRepository implements SettingsRepository {
  getSettings(): AppSettings {
    return mergeSettings(storage.get<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings));
  }

  saveSettings(settings: AppSettings): void {
    storage.set(SETTINGS_KEY, { ...settings, version: SETTINGS_VERSION, appVersion: APP_VERSION, quranFontScale: settings.reading.quranFontScale, defaultReciterId: settings.playback.reciterId });
  }

  updateSettings(updater: (settings: AppSettings) => AppSettings): AppSettings {
    const next = updater(this.getSettings());
    this.saveSettings(next);
    return next;
  }

  resetSettings(): AppSettings {
    this.saveSettings(defaultSettings);
    return this.getSettings();
  }

  exportLocalBackup(): string {
    const backup: Record<string, unknown> = {
      version: SETTINGS_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings()
    };
    for (const key of EXPORTED_KEYS.filter((item) => !item.startsWith('salliha:'))) {
      const value = storage.get<unknown>(key, null);
      if (value !== null) backup[key] = value;
    }
    backup['salliha:reciter'] = window.localStorage.getItem('salliha:reciter');
    return JSON.stringify(backup, null, 2);
  }

  importLocalBackup(payload: string): AppSettings {
    const parsed = JSON.parse(payload) as Record<string, unknown> & { settings?: Partial<AppSettings> };
    if (!parsed.settings) throw new Error('ملف النسخة الاحتياطية لا يحتوي على إعدادات صحيحة.');
    const settings = mergeSettings(parsed.settings);
    this.saveSettings(settings);
    for (const key of EXPORTED_KEYS.filter((item) => !item.startsWith('salliha:'))) {
      if (parsed[key] !== undefined && parsed[key] !== null) storage.set(key, parsed[key]);
    }
    if (typeof parsed['salliha:reciter'] === 'string') window.localStorage.setItem('salliha:reciter', parsed['salliha:reciter'] as string);
    return settings;
  }
}

export const settingsRepository = new LocalSettingsRepository();
