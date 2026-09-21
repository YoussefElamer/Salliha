import { Compass, LocateFixed, Navigation, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { calculateQibla, directionLabel, normalizeHeading } from './qibla';
import { prayerRepository } from '../prayer/PrayerRepository';

export function QiblaPage() {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied'>('idle');
  const location = prayerRepository.getLocation();
  const coordinates = { latitude: location.latitude, longitude: location.longitude };

  const qibla = useMemo(
    () => calculateQibla(coordinates.latitude, coordinates.longitude),
    [coordinates.latitude, coordinates.longitude]
  );

  useEffect(() => {
    const onOrientation = (event: DeviceOrientationEvent) => {
      const webkit = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const value = typeof webkit.webkitCompassHeading === 'number'
        ? webkit.webkitCompassHeading
        : typeof event.alpha === 'number' ? normalizeHeading(360 - event.alpha) : null;
      if (value !== null && Number.isFinite(value)) setHeading(normalizeHeading(value));
    };
    window.addEventListener('deviceorientation', onOrientation, true);
    return () => window.removeEventListener('deviceorientation', onOrientation, true);
  }, []);

  const requestCompass = async () => {
    const DeviceOrientationEventWithPermission = (window.DeviceOrientationEvent) as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      const result = await DeviceOrientationEventWithPermission.requestPermission().catch(() => 'denied' as const);
      setPermission(result);
    } else {
      setPermission('granted');
    }
  };

  const relativeAngle = heading === null ? qibla : normalizeHeading(qibla - heading);

  return (
    <div className="page-grid">
      <section className="hero-card qibla-hero">
        <div className="hero-topline"><Compass size={18} /> القبلة</div>
        <h1>اتجاه القبلة</h1>
        <p className="hero-sub">اتجاه الكعبة من موقعك الحالي: {Math.round(qibla)}° — {directionLabel(qibla)}</p>
        <div className="qibla-compass" aria-label={`اتجاه القبلة ${Math.round(qibla)} درجة`}>
          <div className="qibla-ring">
            <span className="compass-north">ش</span>
            <span className="compass-east">ق</span>
            <span className="compass-south">ج</span>
            <span className="compass-west">غ</span>
            <div className="qibla-arrow" style={{ transform: `translate(-50%, -100%) rotate(${relativeAngle}deg)` }}>
              <Navigation size={54} fill="currentColor" />
            </div>
            <div className="qibla-center"><Compass size={26} /></div>
          </div>
        </div>
        <p className="state-note">
          {heading === null
            ? 'فعّل بوصلة الهاتف للحصول على اتجاه حي. إذا لم تتوفر البوصلة، استخدم زاوية القبلة الظاهرة.'
            : `وجّه السهم إلى القبلة — انحراف الهاتف الحالي محسوب تلقائيًا.`}
        </p>
        <div className="inline-actions">
          <button className="primary-button" onClick={() => void requestCompass()}>
            <LocateFixed size={18} /> {permission === 'granted' ? 'إعادة معايرة البوصلة' : 'تفعيل البوصلة'}
          </button>
          <button className="secondary-button" onClick={() => window.location.reload()}>
            <RefreshCw size={18} /> تحديث
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading"><h2>موقع الحساب</h2><LocateFixed size={20} /></div>
        <p className="muted">{location.name} — {location.countryAr}</p>
        <p className="muted">الإحداثيات: {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}</p>
        <p className="muted">زاوية القبلة: {Math.round(qibla)}° ({directionLabel(qibla)})</p>
      </section>
    </div>
  );
}
