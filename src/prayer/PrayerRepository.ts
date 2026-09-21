import type { PrayerSettings, PrayerTime, ResolvedLocation } from '../core/types';
import { defaultSettings } from '../settings/defaults';
import { settingsRepository } from '../settings/settingsRepository';
import { deviceTimeZone, getCityById, nearestCity, resolveAutoLocation, resolveCalculationMethod } from '../geo/cities';
import { calculatePrayerTimes, getNextPrayer, zonedDateKey } from './prayerCalculations';

export interface PrayerRepository {
  getSettings(): PrayerSettings;
  saveSettings(settings: PrayerSettings): void;
  /** الموقع الفعلي المستخدم في الحساب (تلقائي أو يدوي) — بدون شبكة. */
  getLocation(): ResolvedLocation;
  refreshAutoLocation(options?: { coordinates?: { latitude: number; longitude: number } | null }): ResolvedLocation;
  getTodayTimes(now?: Date): PrayerTime[];
  getTomorrowTimes(now?: Date): PrayerTime[];
  getNextPrayer(now?: Date): PrayerTime;
}

export class LocalPrayerRepository implements PrayerRepository {
  private cachedLocation: ResolvedLocation | null = null;

  getSettings(): PrayerSettings {
    return settingsRepository.getSettings().prayer ?? defaultSettings.prayer;
  }

  saveSettings(settings: PrayerSettings): void {
    settingsRepository.updateSettings((current) => ({ ...current, prayer: settings }));
    this.cachedLocation = null;
  }

  /**
   * يحلّ الموقع المستخدم في الحساب:
   *  - الوضع التلقائي: مدينة الجهاز (GPS إن توفّر، وإلا أكبر مدينة في المنطقة الزمنية للجهاز).
   *  - الوضع اليدوي: المدينة المختارة من قاعدة البيانات، أو إحداثيات يدوية محفوظة.
   */
  getLocation(): ResolvedLocation {
    if (this.cachedLocation) return this.cachedLocation;
    const settings = this.getSettings();
    const manualCity = settings.cityId ? getCityById(settings.cityId) : null;

    if (settings.locationMode === 'manual' && (manualCity || settings.coordinates)) {
      const method = resolveCalculationMethod(settings.calculationMethod, manualCity?.countryCode, manualCity);
      if (manualCity) {
        this.cachedLocation = {
          cityId: manualCity.id,
          name: manualCity.nameAr || manualCity.name,
          countryCode: manualCity.countryCode,
          countryAr: manualCity.countryAr,
          latitude: settings.coordinates?.latitude ?? manualCity.latitude,
          longitude: settings.coordinates?.longitude ?? manualCity.longitude,
          timezone: manualCity.timezone,
          method,
          source: 'manual'
        };
        return this.cachedLocation;
      }
      const nearest = settings.coordinates
        ? nearestCity(settings.coordinates.latitude, settings.coordinates.longitude, { minPopulation: 0 })
        : null;
      this.cachedLocation = {
        cityId: 'custom',
        name: 'موقعي المحدد',
        countryCode: nearest?.city.countryCode ?? '',
        countryAr: nearest?.city.countryAr ?? 'موقع مخصص',
        latitude: settings.coordinates?.latitude ?? 0,
        longitude: settings.coordinates?.longitude ?? 0,
        timezone: nearest?.city.timezone ?? deviceTimeZone(),
        method: resolveCalculationMethod(settings.calculationMethod, nearest?.city.countryCode, nearest?.city),
        source: 'manual'
      };
      return this.cachedLocation;
    }

    if (settings.resolved) {
      this.cachedLocation = { ...settings.resolved, source: settings.resolved.source === 'manual' ? 'manual' : settings.resolved.source };
      return this.cachedLocation;
    }

    return this.refreshAutoLocation({ coordinates: settings.coordinates });
  }

  /** يعيد حساب الموقع التلقائي ويحفظه في الإعدادات. */
  refreshAutoLocation(options: { coordinates?: { latitude: number; longitude: number } | null } = {}): ResolvedLocation {
    const settings = this.getSettings();
    const coordinates = options.coordinates ?? settings.coordinates;
    const resolved = resolveAutoLocation({ coordinates: coordinates ?? null, timeZone: deviceTimeZone() });
    const fallback: ResolvedLocation = resolved ?? {
      cityId: '',
      name: 'مكة المكرمة',
      countryCode: 'SA',
      countryAr: 'السعودية',
      latitude: 21.3891,
      longitude: 39.8579,
      timezone: 'Asia/Riyadh',
      method: 'ummAlQura',
      source: 'timezone'
    };
    const withMethod: ResolvedLocation = {
      ...fallback,
      method: resolveCalculationMethod(settings.calculationMethod, fallback.countryCode, getCityById(fallback.cityId))
    };
    this.cachedLocation = withMethod;
    settingsRepository.updateSettings((current) => ({
      ...current,
      prayer: {
        ...current.prayer,
        coordinates: coordinates ?? null,
        timezone: withMethod.timezone,
        cityId: current.prayer.locationMode === 'manual' ? current.prayer.cityId : withMethod.cityId,
        resolved: { ...withMethod, updatedAt: new Date().toISOString() }
      }
    }));
    return withMethod;
  }

  private calculateForDate(date: Date, now: Date): PrayerTime[] {
    const settings = this.getSettings();
    const location = this.getLocation();
    return calculatePrayerTimes({
      date,
      latitude: location.latitude,
      longitude: location.longitude,
      timeZone: location.timezone,
      method: location.method,
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

  /** مفتاح اليوم المحلي للمدينة — يستخدم لتحديث المواقيت عند تغيّر اليوم لا كل ثانية. */
  getDayKey(now = new Date()): string {
    return zonedDateKey(now, this.getLocation().timezone);
  }
}

export const prayerRepository = new LocalPrayerRepository();
