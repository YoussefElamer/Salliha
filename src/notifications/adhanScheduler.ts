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
  const upcomingToday = today.filter((t) => t.time.getTime() > now.getTime());
  const times: PrayerTime[] = upcomingToday.length > 0 ? upcomingToday : tomorrow.slice(0, 3);
  // إذا كان الوقت بعد العشاء، نجدول فجر الغد فقط
  const toSchedule = upcomingToday.length > 0 ? upcomingToday : [tomorrow.find((t) => t.name === 'الفجر')!].filter(Boolean);
  // لكن الأفضل جدولة كل صلوات الغد أيضًا لتغطية اليوم كاملاً عند فتح الصباح
  const allToSchedule = now.getHours() < 12 ? [...upcomingToday, ...tomorrow.filter((t) => t.name !== 'الشروق').slice(0, 2)] : toSchedule;

  const result = await nativeAdhanService.scheduleDaily(allToSchedule as PrayerTime[], {
    prePrayerMinutes: settings.prePrayerMinutes,
    enabled: settings.adhanEnabled as Record<string, boolean>,
    silentMode: settings.silentMode,
    adhanSoundId: settings.adhanSoundId,
  });
  return result.message;
}

export async function cancelAdhan(): Promise<void> {
  await nativeAdhanService.cancelAll();
}
