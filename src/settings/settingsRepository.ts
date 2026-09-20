import type { AppSettings } from '../core/types';
import { storage } from '../core/storage';
import { defaultSettings } from './defaults';

export interface SettingsRepository {
  getSettings(): AppSettings;
  saveSettings(settings: AppSettings): void;
  updateSettings(updater: (settings: AppSettings) => AppSettings): AppSettings;
  exportLocalBackup(): string;
  importLocalBackup(payload: string): AppSettings;
}

const SETTINGS_KEY = 'settings:v1';

function mergeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...settings,
    prayer: {
      ...defaultSettings.prayer,
      ...(settings.prayer ?? {}),
      offsets: { ...defaultSettings.prayer.offsets, ...(settings.prayer?.offsets ?? {}) },
      adhanEnabled: { ...defaultSettings.prayer.adhanEnabled, ...(settings.prayer?.adhanEnabled ?? {}) }
    }
  };
}

export class LocalSettingsRepository implements SettingsRepository {
  getSettings(): AppSettings {
    return mergeSettings(storage.get<Partial<AppSettings>>(SETTINGS_KEY, defaultSettings));
  }

  saveSettings(settings: AppSettings): void {
    storage.set(SETTINGS_KEY, settings);
  }

  updateSettings(updater: (settings: AppSettings) => AppSettings): AppSettings {
    const next = updater(this.getSettings());
    this.saveSettings(next);
    return next;
  }

  exportLocalBackup(): string {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      bookmarks: storage.get('bookmarks:v1', []),
      readingPosition: storage.get('reading-position:v1', null),
      memorization: storage.get('memorization:v1', null),
      dhikrCounters: storage.get('dhikr-counters:v1', {})
    };
    return JSON.stringify(backup, null, 2);
  }

  importLocalBackup(payload: string): AppSettings {
    const parsed = JSON.parse(payload) as { settings?: Partial<AppSettings>; bookmarks?: unknown; readingPosition?: unknown; memorization?: unknown; dhikrCounters?: unknown };
    if (!parsed.settings) throw new Error('ملف النسخة الاحتياطية لا يحتوي على إعدادات صحيحة.');
    const settings = mergeSettings(parsed.settings);
    this.saveSettings(settings);
    if (parsed.bookmarks) storage.set('bookmarks:v1', parsed.bookmarks);
    if (parsed.readingPosition) storage.set('reading-position:v1', parsed.readingPosition);
    if (parsed.memorization) storage.set('memorization:v1', parsed.memorization);
    if (parsed.dhikrCounters) storage.set('dhikr-counters:v1', parsed.dhikrCounters);
    return settings;
  }
}

export const settingsRepository = new LocalSettingsRepository();
