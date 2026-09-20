import type { PrayerSettings, PrayerTime } from '../core/types';
import { defaultSettings } from '../settings/defaults';
import { settingsRepository } from '../settings/settingsRepository';
import { getCityById } from './cities';
import { calculatePrayerTimes, getNextPrayer } from './prayerCalculations';

export interface PrayerRepository {
  getSettings(): PrayerSettings;
  saveSettings(settings: PrayerSettings): void;
  getTodayTimes(now?: Date): PrayerTime[];
  getTomorrowTimes(now?: Date): PrayerTime[];
  getNextPrayer(now?: Date): PrayerTime;
}

export class LocalPrayerRepository implements PrayerRepository {
  getSettings(): PrayerSettings {
    return settingsRepository.getSettings().prayer ?? defaultSettings.prayer;
  }

  saveSettings(settings: PrayerSettings): void {
    settingsRepository.updateSettings((current) => ({ ...current, prayer: settings }));
  }

  private calculateForDate(date: Date, now = new Date()): PrayerTime[] {
    const settings = this.getSettings();
    const city = getCityById(settings.cityId);
    const coordinates = settings.coordinates ?? { latitude: city.latitude, longitude: city.longitude };
    return calculatePrayerTimes({
      date,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      timeZone: city.timezone,
      method: settings.calculationMethod,
      madhhab: settings.madhhab,
      offsets: settings.offsets,
      now
    });
  }

  getTodayTimes(now = new Date()): PrayerTime[] {
    return this.calculateForDate(now, now);
  }

  getTomorrowTimes(now = new Date()): PrayerTime[] {
    return this.calculateForDate(new Date(now.getTime() + 24 * 60 * 60 * 1000), now);
  }

  getNextPrayer(now = new Date()): PrayerTime {
    return getNextPrayer(this.getTodayTimes(now), this.getTomorrowTimes(now), now);
  }
}

export const prayerRepository = new LocalPrayerRepository();
