import { Capacitor } from '@capacitor/core';
import { prayerRepository } from '../prayer/PrayerRepository';

export type LocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

/**
 * يتحقق من حالة إذن الموقع الحالية دون إظهار نافذة الطلب إن أمكن.
 */
export async function checkLocationPermissionState(): Promise<LocationPermissionState> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const current = await Geolocation.checkPermissions();
      if (current.location === 'granted' || current.coarseLocation === 'granted') {
        return 'granted';
      }
      if (current.location === 'denied' && current.coarseLocation === 'denied') {
        return 'denied';
      }
      return 'prompt';
    }

    if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions?.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return (result.state as LocationPermissionState) || 'prompt';
    }

    return typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unsupported';
  } catch {
    return 'prompt';
  }
}

/**
 * يطلب إذن الموقع بدقة مع fallback تلقائي للدقة التقريبية في حال فشل الـ GPS.
 */
export async function requestPreciseLocation(): Promise<{ ok: boolean; message: string }> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      let current = await Geolocation.checkPermissions();

      const isGranted = (status: { location?: string; coarseLocation?: string }) =>
        status.location === 'granted' || status.coarseLocation === 'granted';

      if (!isGranted(current)) {
        // نطلب كل أذونات الموقع المتاحة (الدقيقة والتقريبية) لدعم مختلف إصدارات أندرويد
        const requested = await Geolocation.requestPermissions();
        if (!isGranted(requested)) {
          return {
            ok: false,
            message: 'لم يتم السماح بالموقع. افتح إعدادات التطبيق في هاتفك واسمح بصلاحية الموقع أثناء استخدام التطبيق.'
          };
        }
      }

      // محاولة الحصول على الموقع بدقة عالية أولاً، مع fallback للدقة التقريبية
      let position;
      try {
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30000,
          enableLocationFallback: true
        });
      } catch {
        // في حال تعذر GPS (مثلاً في مكان مغلق)، نجرب بالشبكة/الدقة التقريبية
        position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
          enableLocationFallback: true
        });
      }

      const resolved = prayerRepository.refreshAutoLocation({
        coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }
      });
      return { ok: true, message: `تم تحديد موقعك بدقة: ${resolved.name} — ${resolved.countryAr}` };
    }

    // متصفح / PWA
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { ok: false, message: 'تحديد الموقع التلقائي غير مدعوم في هذا المتصفح. يمكنك اختيار مدينتك يدويًا من القائمة.' };
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      // محاولة دقيقة أولاً
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(err);
            return;
          }
          // إذا كان مهلة أو غير متوفر، نجرب بالدقة التقريبية
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 30000
        }
      );
    });

    const resolved = prayerRepository.refreshAutoLocation({
      coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }
    });
    return { ok: true, message: `تم تحديد موقعك بدقة: ${resolved.name} — ${resolved.countryAr}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const isDenied = (error as GeolocationPositionError)?.code === 1 || message.includes('denied');
    if (isDenied) {
      return {
        ok: false,
        message: 'تم رفض إذن الموقع. يمكنك السماح به من إعدادات المتصفح/الجهاز، أو اختيار مدينتك يدويًا.'
      };
    }

    return {
      ok: false,
      message: message.includes('OS-PLUG-GLOC-0007')
        ? 'خدمة الموقع (GPS) في الهاتف مغلقة. يرجى تفعيل الموقع من شريط الإعدادات السريعة ثم إعادة المحاولة.'
        : 'تعذر استقبال إشارة الموقع في الوقت الحالي. تأكد من تفعيل الموقع، أو اختر مدينتك يدويًا.'
    };
  }
}
