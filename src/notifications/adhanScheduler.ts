import type { PrayerTime, PrayerSettings } from '../core/types';
import { prayerRepository } from '../prayer/PrayerRepository';
import { nativeAdhanService } from './NativeAdhanService';

/**
 * أداة جدولة يومية تُستدعى عند:
 * - تغيير إعدادات الصلاة
 * - فتح التطبيق (لجدولة اليوم + الغد)
 * - منح إذن الإشعارات
 *
 * لا تعد بضمان Exact — تعرض رسالة القيود دائمًا.
 */
export async function rescheduleAdhan(opts?: { now?: Date }): Promise<string> {
  const settings: PrayerSettings = prayerRepository.getSettings();
  if (!settings.notificationsEnabled) {
    await nativeAdhanService.cancelAll();
    return 'التنبيهات معطلة — تم إلغاء أي جدولة سابقة.';
  }
  const now = opts?.now ?? new Date();
  const today = prayerRepository.getTodayTimes(now);
  const tomorrow = prayerRepository.getTomorrowTimes(now);
  // جدولة اليوم المتبقي + الفجر غدًا على الأقل
  const upcomingToday = today.filter((t) => t.time.getTime() > now.getTime() && t.name !== 'الشروق');
  const upcomingTomorrow = tomorrow.filter((t) => t.name !== 'الشروق');
  const allToSchedule: PrayerTime[] = [...upcomingToday, ...upcomingTomorrow];

  const result = await nativeAdhanService.scheduleDaily(allToSchedule as PrayerTime[], {
    prePrayerMinutes: settings.prePrayerMinutes,
    enabled: settings.adhanEnabled as Record<string, boolean>,
    silentMode: settings.silentMode,
  });
  return result.message;
}

export async function cancelAdhan(): Promise<void> {
  await nativeAdhanService.cancelAll();
}
