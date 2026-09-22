import { Bell, Check, Languages, LocateFixed, MapPin, Palette, ShieldCheck, Sun, Volume2 } from 'lucide-react';
import { useState } from 'react';
import type { AppSettings, ThemeMode } from '../core/types';
import { deviceTimeZone, listCountries, searchCities } from '../geo/cities';
import { prayerRepository } from '../prayer/PrayerRepository';
import { nativeAdhanService } from '../notifications/NativeAdhanService';
import { rescheduleAdhan } from '../notifications/adhanScheduler';
import { requestPreciseLocation } from '../geo/nativeLocation';

const themes: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'فاتح', icon: Sun },
  { id: 'dark', label: 'داكن', icon: Palette },
  { id: 'system', label: 'حسب النظام', icon: Palette }
];

export function Onboarding({
  settings,
  setSettings,
  finish
}: {
  settings: AppSettings;
  setSettings: (updater: (settings: AppSettings) => AppSettings) => void;
  finish: () => void;
}) {
  const [query, setQuery] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [permissionMessage, setPermissionMessage] = useState('');
  const detected = prayerRepository.getLocation();
  const results = query.trim().length >= 2 ? searchCities(query, { limit: 12 }) : [];

  const requestLocation = () => {
    setLocationMessage('جارٍ طلب إذن الموقع…');
    void requestPreciseLocation().then((result) => {
      setLocationMessage(result.message);
      if (result.ok) {
        const resolved = prayerRepository.getLocation();
        setSettings((current) => ({
          ...current,
          prayer: {
            ...current.prayer,
            locationMode: 'auto',
            coordinates: { latitude: resolved.latitude, longitude: resolved.longitude },
            resolved: { ...resolved, updatedAt: new Date().toISOString() }
          }
        }));
      }
    });
  };

  const requestNotifications = async () => {
    setPermissionMessage('جارٍ طلب إذن الإشعارات…');
    const permission = await nativeAdhanService.requestPermission().catch(() => 'unsupported' as const);
    if (permission === 'granted') {
      setSettings((current) => ({ ...current, prayer: { ...current.prayer, notificationsEnabled: true } }));
      await rescheduleAdhan().catch(() => {});
      setPermissionMessage('تم السماح بالإشعارات. يمكنك تعديل صوت الأذان ومواعيده من صفحة الصلاة.');
    } else {
      setPermissionMessage(permission === 'unsupported' ? 'الإشعارات غير متاحة في هذه البيئة. ثبّت التطبيق على الهاتف لتفعيل أذان النظام.' : 'لم يتم منح إذن الإشعارات. يمكنك تفعيله لاحقًا من صفحة الصلاة.');
    }
  };

  const useMyLocation = () => {
    setLocationMessage('جارٍ طلب إذن الموقع من النظام…');
    void requestPreciseLocation().then((result) => {
      setLocationMessage(result.message);
      if (result.ok) {
        const resolved = prayerRepository.getLocation();
        setSettings((current) => ({
          ...current,
          prayer: {
            ...current.prayer,
            locationMode: 'auto',
            coordinates: { latitude: resolved.latitude, longitude: resolved.longitude },
            resolved: { ...resolved, updatedAt: new Date().toISOString() }
          }
        }));
      }
    });
  };

  return (
    <main className="onboarding" dir="rtl">
      <section className="onboarding-card">
        <div className="brand-mark big">ص</div>
        <h1>صليها — Salliha</h1>
        <p className="muted">قرآن كامل، مواقيت صلاة لكل دول العالم بدون إنترنت، أذكار بعدّاد سهل، وتلاوات لأشهر القرّاء — بلا إعلانات.</p>

        <div className="onboarding-block">
          <h2><MapPin size={18} /> مدينتك</h2>
          <p className="muted">
            اكتشفنا مدينتك تلقائيًا من منطقة الجهاز الزمنية: <strong>{detected.name} — {detected.countryAr}</strong> ({detected.timezone}).
          </p>
          <div className="inline-actions">
            <button className="secondary-button" onClick={useMyLocation}><LocateFixed size={18} /> استخدام موقعي بدقة</button>
            <button className="secondary-button" onClick={() => { const resolved = prayerRepository.refreshAutoLocation({ coordinates: null }); setLocationMessage(`تم الاعتماد على المنطقة الزمنية: ${resolved.name} — ${resolved.countryAr}`); }}>
              <ShieldCheck size={18} /> الاعتماد على منطقة الجهاز
            </button>
          </div>
          <div className="search-box">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="أو ابحث عن مدينتك… (كل الدول)" />
          </div>
          {results.length > 0 && (
            <div className="city-list compact">
              {results.map((city) => (
                <button
                  key={city.id}
                  onClick={() => {
                    setSettings((current) => ({ ...current, prayer: { ...current.prayer, locationMode: 'manual', cityId: city.id, coordinates: null, resolved: null } }));
                    setLocationMessage(`تم اختيار ${city.nameAr || city.name} — ${city.countryAr}`);
                    setQuery('');
                  }}
                >
                  <span><strong>{city.nameAr || city.name}</strong></span>
                  <small>{city.countryAr}</small>
                </button>
              ))}
            </div>
          )}
          {locationMessage && <p className="state-note">{locationMessage}</p>}
          <p className="source-note">قاعدة المدن المدمجة تشمل {listCountries().length} دولة وتعمل بدون إنترنت. المنطقة الزمنية لجهازك: {deviceTimeZone()}.</p>
        </div>

        <div className="onboarding-block">
          <h2><Palette size={18} /> المظهر</h2>
          <div className="segmented">
            {themes.map((theme) => {
              const Icon = theme.icon;
              return (
                <button key={theme.id} className={settings.theme === theme.id ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, theme: theme.id }))}>
                  <Icon size={16} /> {theme.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="onboarding-block">
          <h2><Languages size={18} /> اللغة</h2>
          <select value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value as AppSettings['language'] }))}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="permission-note">
          <ShieldCheck /> الصلاحيات اختيارية: الموقع لحساب المواقيت بدقة، والإشعارات لتشغيل تنبيه/أذان الصلاة في الوقت المحدد. يمكنك رفض أي صلاحية واختيار المدينة يدويًا.
        </div>

        <div className="onboarding-block">
          <h2><LocateFixed size={18} /> صلاحية الموقع</h2>
          <p className="muted">اضغط مرة واحدة للسماح للتطبيق باستخدام موقعك الحالي لحساب المواقيت. لا يتم رفع إحداثياتك إلى خادم.</p>
          <button className="secondary-button" onClick={requestLocation}><LocateFixed size={18} /> السماح بتحديد موقعي</button>
        </div>

        <div className="onboarding-block">
          <h2><Bell size={18} /> صلاحية الإشعارات والأذان</h2>
          <p className="muted">على الهاتف نستخدم إشعارات النظام المجدولة حتى يعمل التنبيه بعد إغلاق التطبيق. لا يمكن للتطبيق تجاوز إعدادات النظام أو البطارية.</p>
          <button className="secondary-button" onClick={() => void requestNotifications()}><Bell size={18} /> السماح بالإشعارات والأذان</button>
        </div>

        <div className="permission-note"><Volume2 /> بعد الدخول يمكنك اختيار صوت الأذان من مكتبة الأصوات وتجربته قبل اعتماده.</div>
        {permissionMessage && <p className="state-note">{permissionMessage}</p>}

        <div className="inline-actions onboarding-actions">
          <button className="primary-button" onClick={finish}><Check /> ابدأ الاستخدام</button>
          <button className="secondary-button" onClick={finish}>تخطي</button>
        </div>
      </section>
    </main>
  );
}
