import type { PrayerTime } from '../core/types';
import { getAdhanSettings } from '../settings/adhanSettings';
import { getAdhanSoundForPrayer } from '../audio/adhanSounds';

/**
 * NativeAdhanService — جدولة الأذان عبر Capacitor Local Notifications مع fallback للمتصفح.
 *
 * لا يضمن Exact Alarms على كل جهاز — يعرض قيود النظام بوضوح.
 * - Android: قد تُمنع التنبيهات الدقيقة بسبب Battery Optimization / Doze. نطلب permission ونرشد المستخدم.
 * - iOS: حد أقصى 64 تنبيه مجدول، ودقة الخلفية محدودة.
 * - Web/PWA: fallback إلى BrowserNotificationService (عرض فقط عند فتح التطبيق أو Service Worker إن سمح المتصفح).
 */
export interface AdhanScheduleResult {
  scheduled: number;
  platform: 'capacitor' | 'web' | 'unsupported';
  message: string;
}

export interface NativeAdhanService {
  isSupported(): boolean;
  isCapacitor(): boolean;
  requestPermission(): Promise<NotificationPermission | 'unsupported'>;
  scheduleDaily(times: PrayerTime[], opts: { prePrayerMinutes: number; enabled: Record<string, boolean>; silentMode: boolean }): Promise<AdhanScheduleResult>;
  cancelAll(): Promise<void>;
  getPending(): Promise<Array<{ id: string; title: string; scheduleAt: string }>>;
}

class CapacitorAdhanService implements NativeAdhanService {
  isSupported(): boolean { return true; }
  isCapacitor(): boolean { return true; }

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    try {
      const mod = await import('@capacitor/local-notifications');
      const result = await mod.LocalNotifications.requestPermissions();
      const granted = (result as { display?: string }).display === 'granted';
      if (!granted) return 'denied';
      const exact = await mod.LocalNotifications.checkExactNotificationSetting().catch(() => ({ value: 'granted' }));
      if ((exact as { value?: string }).value === 'denied') {
        await mod.LocalNotifications.changeExactNotificationSetting().catch(() => {});
      }
      return 'granted';
    } catch {
      // fallback to web permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.requestPermission();
      }
      return 'unsupported';
    }
  }

  async scheduleDaily(times: PrayerTime[], opts: { prePrayerMinutes: number; enabled: Record<string, boolean>; silentMode: boolean }): Promise<AdhanScheduleResult> {
    try {
      const mod = await import('@capacitor/local-notifications');
      const LN = mod.LocalNotifications;

      await LN.createChannel({
        id: `adhan-${getAdhanSettings().soundId}`,
        name: 'أذان صليها',
        description: 'تنبيهات مواقيت الصلاة بصوت الأذان المختار',
        importance: 5,
        visibility: 1,
        sound: getAdhanSoundForPrayer(getAdhanSettings().soundId, 'الظهر')
      }).catch(() => {});

      // Cancel previous
      const pending = await LN.getPending().catch(() => ({ notifications: [] as Array<{ id: number }> }));
      if ((pending as { notifications: Array<{ id: number }> }).notifications.length > 0) {
        await LN.cancel({ notifications: (pending as { notifications: Array<{ id: number }> }).notifications.map((n) => ({ id: n.id })) }).catch(() => {});
      }

      const notifications: Array<{ title: string; body: string; id: number; schedule: { at: string }; sound?: string; smallIcon?: string }> = [];
      let idCounter = 1000;
      for (const prayer of times) {
        if (prayer.name === 'الشروق') continue;
        if (!opts.enabled[prayer.name]) continue;
        const prayerTime = prayer.time.getTime();
        // Pre-prayer reminder
        if (opts.prePrayerMinutes > 0) {
          const preAt = new Date(prayerTime - opts.prePrayerMinutes * 60_000);
          if (preAt.getTime() > Date.now()) {
            notifications.push({
              title: `تذكير: ${prayer.name} بعد ${opts.prePrayerMinutes} دقائق`,
              body: opts.silentMode ? 'الوضع الصامت مفعّل — تنبيه صامت.' : `حان وقت الاستعداد لصلاة ${prayer.name}.`,
              id: idCounter++,
              schedule: { at: preAt.toISOString() },
              smallIcon: 'ic_stat_icon',
              channelId: `adhan-${getAdhanSettings().soundId}`,
              isExactNotification: true,
              allowWhileIdle: true,
            });
          }
        }
        // Main adhan — only if future
        if (prayerTime > Date.now()) {
          notifications.push({
            title: `حان وقت ${prayer.name}`,
            body: opts.silentMode ? 'الوضع الصامت مفعّل.' : `حان وقت صلاة ${prayer.name} — صَلِّها.`,
            id: idCounter++,
            schedule: { at: new Date(prayerTime).toISOString() },
            sound: opts.silentMode ? undefined : getAdhanSoundForPrayer(getAdhanSettings().soundId, prayer.name),
            smallIcon: 'ic_stat_icon',
          });
        }
      }

      // iOS limit 64 — we schedule only today + tomorrow (max ~10)
      const toSchedule = notifications.slice(0, 20);
      if (toSchedule.length > 0) {
        await LN.schedule({ notifications: toSchedule as unknown as Parameters<typeof LN.schedule>[0]['notifications'] });
      }

      return {
        scheduled: toSchedule.length,
        platform: 'capacitor',
        message: toSchedule.length === 0
          ? 'لا توجد صلوات قادمة للجدولة.'
          : `تمت جدولة ${toSchedule.length} تنبيهًا بالأذان المختار. على Android قد تحتاج للسماح بالإشعارات الدقيقة وإلغاء تحسين البطارية. على iOS يعتمد التشغيل على صلاحيات النظام.`,
      };
    } catch (error) {
      return {
        scheduled: 0,
        platform: 'unsupported',
        message: error instanceof Error ? error.message : 'تعذر جدولة الأذان عبر النظام.',
      };
    }
  }

  async cancelAll(): Promise<void> {
    try {
      const mod = await import('@capacitor/local-notifications');
      const pending = await mod.LocalNotifications.getPending().catch(() => ({ notifications: [] as Array<{ id: number }> }));
      const ids = (pending as { notifications: Array<{ id: number }> }).notifications.map((n) => ({ id: n.id }));
      if (ids.length > 0) await mod.LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) as unknown as Parameters<typeof mod.LocalNotifications.cancel>[0]['notifications'] });
    } catch { /* ignore */ }
  }

  async getPending(): Promise<Array<{ id: string; title: string; scheduleAt: string }>> {
    try {
      const mod = await import('@capacitor/local-notifications');
      const pending = await mod.LocalNotifications.getPending() as unknown as { notifications: Array<{ id: number; title: string; schedule?: { at: string } }> };
      return pending.notifications.map((n) => ({ id: String(n.id), title: n.title, scheduleAt: n.schedule?.at ?? '' }));
    } catch {
      return [];
    }
  }
}

class WebFallbackAdhanService implements NativeAdhanService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }
  isCapacitor(): boolean { return false; }

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    return Notification.requestPermission();
  }

  async scheduleDaily(_times: PrayerTime[], _opts: { prePrayerMinutes: number; enabled: Record<string, boolean>; silentMode: boolean }): Promise<AdhanScheduleResult> {
    // Web لا يستطيع جدولة في الخلفية بدقة — نعرض رسالة صادقة
    return {
      scheduled: 0,
      platform: 'web',
      message: 'المتصفح لا يدعم جدولة الأذان الدقيقة في الخلفية. سيعمل التنبيه فقط عند فتح التطبيق (أو عبر Service Worker بشكل محدود). للتنبيه الدقيق ثبّت التطبيق على Android واسمح بالإشعارات.',
    };
  }

  async cancelAll(): Promise<void> { /* nothing to cancel on web */ }
  async getPending(): Promise<Array<{ id: string; title: string; scheduleAt: string }>> { return []; }
}

function detectCapacitor(): boolean {
  try {
    // @ts-ignore
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  } catch { return false; }
}

export function createAdhanService(): NativeAdhanService {
  if (detectCapacitor()) return new CapacitorAdhanService();
  return new WebFallbackAdhanService();
}

export const nativeAdhanService = createAdhanService();

// Helper for testing — export inner classes
export const __testing = { CapacitorAdhanService, WebFallbackAdhanService };
