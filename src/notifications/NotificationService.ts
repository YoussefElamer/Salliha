import type { PrayerTime } from '../core/types';

export interface NotificationService {
  permissionState(): NotificationPermission | 'unsupported';
  requestPermission(): Promise<NotificationPermission | 'unsupported'>;
  notifyPrayer(prayer: PrayerTime): Promise<void>;
}

export class BrowserNotificationService implements NotificationService {
  permissionState(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (this.permissionState() === 'unsupported') return 'unsupported';
    return Notification.requestPermission();
  }

  async notifyPrayer(prayer: PrayerTime): Promise<void> {
    if (this.permissionState() !== 'granted') return;
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    const title = `حان وقت ${prayer.name}`;
    const options: NotificationOptions = {
      body: 'تنبيه محلي من صَلِّها. قد تختلف دقة الخلفية حسب قيود النظام والمتصفح.',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      dir: 'rtl',
      lang: 'ar'
    };
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  }
}

export const notificationService = new BrowserNotificationService();
