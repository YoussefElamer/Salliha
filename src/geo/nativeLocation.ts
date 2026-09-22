import { Capacitor } from '@capacitor/core';
import { prayerRepository } from '../prayer/PrayerRepository';

export async function requestPreciseLocation(): Promise<{ ok: boolean; message: string }> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const current = await Geolocation.checkPermissions();
      if (current.location !== 'granted') {
        const requested = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (requested.location !== 'granted') {
          return { ok: false, message: 'لم يتم السماح بالموقع. افتح إعدادات التطبيق واسمح بالموقع أثناء استخدام التطبيق.' };
        }
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
        enableLocationFallback: true
      });
      const resolved = prayerRepository.refreshAutoLocation({
        coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }
      });
      return { ok: true, message: `تم تحديد موقعك: ${resolved.name} — ${resolved.countryAr}` };
    }

    if (!navigator.geolocation) {
      return { ok: false, message: 'تحديد الموقع غير مدعوم هنا. اختر مدينتك يدويًا.' };
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      });
    });
    const resolved = prayerRepository.refreshAutoLocation({
      coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }
    });
    return { ok: true, message: `تم تحديد موقعك: ${resolved.name} — ${resolved.countryAr}` };
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return {
      ok: false,
      message: code.includes('OS-PLUG-GLOC-0007')
        ? 'خدمة الموقع في الهاتف مغلقة. فعّل الموقع من إعدادات الجهاز ثم جرّب مرة أخرى.'
        : 'تعذر الحصول على موقعك. تأكد من تشغيل الموقع والسماح للتطبيق به، أو اختر مدينتك يدويًا.'
    };
  }
}
