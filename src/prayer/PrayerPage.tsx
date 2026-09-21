import { Bell, BellOff, CalendarDays, Compass, LocateFixed, MapPin, Moon, Search, Settings2, Smartphone, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CalculationMethodChoice, PrayerName, PrayerSettings } from '../core/types';
import { formatHijriDate, formatClock } from '../core/arabic';
import { citiesOfCountry, listCountries, searchCities } from '../geo/cities';
import { adhanPrayers, calculationMethods, formatRemaining, getCalculationMethod } from './prayerCalculations';
import { prayerRepository } from './PrayerRepository';
import { notificationService } from '../notifications/NotificationService';
import { nativeAdhanService } from '../notifications/NativeAdhanService';
import { rescheduleAdhan } from '../notifications/adhanScheduler';
import { adhanSounds, getAdhanPreviewUrl } from '../audio/adhanSounds';
import { getAdhanSettings, saveAdhanSettings } from '../settings/adhanSettings';

const prayerNames: PrayerName[] = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];

export function PrayerPage() {
  const [settings, setSettings] = useState<PrayerSettings>(() => prayerRepository.getSettings());
  const [tick, setTick] = useState(() => new Date());
  const [permissionMessage, setPermissionMessage] = useState('');
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [adhanSoundId, setAdhanSoundId] = useState(() => getAdhanSettings().soundId);
  const [previewingSound, setPreviewingSound] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const location = useMemo(() => prayerRepository.getLocation(), [settings, pickerOpen]);
  const minuteKey = Math.floor(tick.getTime() / 60_000);
  const times = useMemo(() => prayerRepository.getTodayTimes(tick), [location, minuteKey]);
  const next = useMemo(() => prayerRepository.getNextPrayer(tick), [location, minuteKey]);
  const method = getCalculationMethod(location.method);

  const save = (nextSettings: PrayerSettings) => {
    prayerRepository.saveSettings(nextSettings);
    setSettings(nextSettings);
  };

  const useMyLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('تحديد الموقع غير مدعوم على هذا الجهاز. اختر مدينتك يدويًا من القائمة.');
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const resolved = prayerRepository.refreshAutoLocation({ coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude } });
        setSettings(prayerRepository.getSettings());
        save({ ...prayerRepository.getSettings(), locationMode: 'auto', coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude }, resolved: { ...resolved, updatedAt: new Date().toISOString() } });
        setPermissionMessage(`تم تحديد الموقع: ${resolved.name} — ${resolved.countryAr}`);
        setLocationBusy(false);
      },
      () => {
        setError('لم نحصل على إذن الموقع. لا مشكلة — المواقيت تعمل بالمدينة المكتشفة تلقائيًا من منطقة الجهاز الزمنية، أو اختر مدينتك يدويًا.');
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 30 * 60 * 1000 }
    );
  };

  const requestNotifications = async () => {
    const nativePerm = await nativeAdhanService.requestPermission().catch(() => 'unsupported' as const);
    const permission = nativePerm !== 'unsupported' ? nativePerm : await notificationService.requestPermission();
    if (permission === 'granted') {
      save({ ...settings, notificationsEnabled: true });
      const msg = await rescheduleAdhan().catch(() => 'تم تفعيل الإشعارات.');
      setPermissionMessage(msg || 'تم تفعيل الإشعارات. دقة التنبيه في الخلفية تعتمد على نظام التشغيل وإعدادات البطارية.');
    } else if (permission === 'unsupported') {
      setPermissionMessage('الإشعارات غير مدعومة في هذا المتصفح. على أندرويد/iOS ثبّت التطبيق للحصول على تنبيهات النظام.');
    } else {
      save({ ...settings, notificationsEnabled: false });
      setPermissionMessage('لم يتم منح إذن الإشعارات. سيظل التطبيق يعمل بدون تنبيهات.');
    }
  };

  const changeAdhanSound = async (soundId: string) => {
    setAdhanSoundId(soundId);
    saveAdhanSettings({ ...getAdhanSettings(), soundId });
    if (settings.notificationsEnabled) {
      const msg = await rescheduleAdhan().catch(() => '');
      if (msg) setPermissionMessage(msg);
    }
  };

  const previewAdhan = (soundId: string) => {
    const url = getAdhanPreviewUrl(soundId, 'الظهر');
    const audio = new Audio(url);
    setPreviewingSound(soundId);
    audio.onended = () => setPreviewingSound(null);
    audio.onerror = () => setPreviewingSound(null);
    void audio.play().catch(() => setPreviewingSound(null));
  };

  const toggleAdhan = async (name: PrayerName, checked: boolean) => {
    const nextSettings = { ...settings, adhanEnabled: { ...settings.adhanEnabled, [name]: checked } };
    save(nextSettings);
    if (nextSettings.notificationsEnabled) {
      const msg = await rescheduleAdhan().catch(() => '');
      if (msg) setPermissionMessage(msg);
    }
  };

  return (
    <div className="page-grid">
      <section className="hero-card compact">
        <div className="hero-topline">
          <MapPin size={18} />
          {location.name} — {location.countryAr}
          {location.source === 'gps' ? ' (من موقعك)' : location.source === 'manual' ? ' (اختيار يدوي)' : ' (تلقائي من منطقة الجهاز)'}
        </div>
        <h1>الصلاة القادمة: {next.name}</h1>
        <div className="countdown">{formatRemaining(next.time, tick)}</div>
        <p>
          {formatClock(next.time, location.timezone)} بتوقيت {location.name}
        </p>
        <div className="inline-actions">
          <button className="primary-button" onClick={useMyLocation} disabled={locationBusy}>
            <LocateFixed size={18} /> {locationBusy ? 'جارٍ التحديد…' : 'تحديد موقعي الآن'}
          </button>
          <button className="secondary-button" onClick={() => setPickerOpen(true)}>
            <Search size={18} /> اختيار مدينة (كل الدول)
          </button>
          <button className="secondary-button" onClick={() => setSettingsOpen((value) => !value)}>
            <Settings2 size={18} /> طريقة الحساب
          </button>
        </div>
        {permissionMessage && <p className="state-note inverse">{permissionMessage}</p>}
        {error && <p className="error-note">{error}</p>}
      </section>

      <section className="card">
        <div className="section-heading">
          <h2>مواقيت اليوم</h2>
          <span className="muted">
            <CalendarDays size={14} /> {formatHijriDate(tick, location.timezone, settings.hijriOffsetDays)}
          </span>
        </div>
        <div className="prayer-times-list roomy">
          {times.map((item) => {
            const isNext = item.name === next.name;
            const isCurrent = item.status === 'current';
            return (
              <div className={`prayer-time ${isNext ? 'is-next' : ''} ${isCurrent ? 'is-current' : ''}`} key={item.name}>
                <span className="prayer-name">
                  {item.name}
                  {isNext && <small>القادمة</small>}
                  {isCurrent && <small>الوقت الحالي</small>}
                </span>
                <strong dir="ltr">{formatClock(item.time, location.timezone)}</strong>
              </div>
            );
          })}
        </div>
        <p className="source-note">
          طريقة الحساب المستخدمة: {method.label} — المنطقة الزمنية: {location.timezone}. المواقيت تُحسب على الجهاز بدون إنترنت، وتُعرض بتوقيت المدينة المختارة لا بتوقيت جهازك.
        </p>
      </section>

      {settingsOpen && (
        <section className="card settings-panel">
          <div className="section-heading">
            <h2>طريقة الحساب والمدينة</h2>
            <button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="إغلاق"><X size={18} /></button>
          </div>
          <label>
            طريقة الحساب
            <select value={settings.calculationMethod} onChange={(event) => save({ ...settings, calculationMethod: event.target.value as CalculationMethodChoice })}>
              <option value="auto">تلقائي حسب الدولة ({getCalculationMethod(location.method).shortLabel})</option>
              {calculationMethods.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            مذهب حساب العصر
            <select value={settings.madhhab} onChange={(event) => save({ ...settings, madhhab: event.target.value as PrayerSettings['madhhab'] })}>
              <option value="shafi">شافعي / مالكي / حنبلي</option>
              <option value="hanafi">حنفي</option>
            </select>
          </label>
          <label>
            إزاحة التاريخ الهجري (أيام)
            <input type="number" min={-2} max={2} value={settings.hijriOffsetDays} onChange={(event) => save({ ...settings, hijriOffsetDays: Number(event.target.value) })} />
          </label>
          <h3>تعديل يدوي بالدقائق</h3>
          <div className="offset-grid">
            {prayerNames.map((name) => (
              <label key={name}>
                {name}
                <input type="number" value={settings.offsets[name]} onChange={(event) => save({ ...settings, offsets: { ...settings.offsets, [name]: Number(event.target.value) } })} />
              </label>
            ))}
          </div>
          <div className="inline-actions">
            <button className="secondary-button" onClick={() => save({ ...settings, offsets: Object.fromEntries(prayerNames.map((name) => [name, 0])) as Record<PrayerName, number> })}>
              تصفير كل الإزاحات
            </button>
            <button className="secondary-button" onClick={() => { const resolved = prayerRepository.refreshAutoLocation(); setSettings(prayerRepository.getSettings()); setPermissionMessage(`تم تحديث الموقع تلقائيًا: ${resolved.name} — ${resolved.countryAr}`); }}>
              <Compass size={18} /> إعادة اكتشاف الموقع
            </button>
          </div>
        </section>
      )}

      <section className="card settings-panel">
        <h2>الأذان والتنبيهات</h2>
        <p className="muted">
          لا يحاول التطبيق تجاوز قيود أندرويد أو iOS: دقة التنبيه في الخلفية تعتمد على صلاحيات النظام وتوفير البطارية وقيود Exact Alarms.
        </p>
        <div className="inline-actions">
          <button className="primary-button" onClick={requestNotifications}>
            {settings.notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />} {settings.notificationsEnabled ? 'الإشعارات مفعّلة' : 'تفعيل إذن الإشعارات'}
          </button>
        </div>
        <label>
          تنبيه قبل الصلاة بالدقائق
          <input type="number" min={0} max={60} value={settings.prePrayerMinutes} onChange={(event) => save({ ...settings, prePrayerMinutes: Number(event.target.value) })} />
        </label>
        <div className="toggles-list">
          {adhanPrayers.map((name) => (
            <label key={name} className="toggle-row">
              <span>{name}</span>
              <input type="checkbox" checked={settings.adhanEnabled[name]} onChange={(event) => void toggleAdhan(name, event.target.checked)} />
            </label>
          ))}
        </div>
        <label className="toggle-row">
          <span><Moon size={18} /> وضع صامت (بدون صوت أذان)</span>
          <input type="checkbox" checked={settings.silentMode} onChange={(event) => save({ ...settings, silentMode: event.target.checked })} />
        </label>
        <label className="toggle-row">
          <span><Smartphone size={18} /> اهتزاز</span>
          <input type="checkbox" checked={settings.vibration} onChange={(event) => save({ ...settings, vibration: event.target.checked })} />
        </label>
      </section>

      {pickerOpen && (
        <CityPickerSheet
          onClose={() => setPickerOpen(false)}
          currentCityId={location.cityId}
          onPick={(cityId) => {
            const nextSettings = { ...settings, locationMode: 'manual' as const, cityId, coordinates: null, resolved: null };
            save(nextSettings);
            setPickerOpen(false);
            setPermissionMessage('تم تغيير المدينة. يمكنك الرجوع للتحديد التلقائي في أي وقت.');
          }}
          onUseAuto={() => {
            const resolved = prayerRepository.refreshAutoLocation({ coordinates: null });
            save({ ...prayerRepository.getSettings(), locationMode: 'auto', resolved: { ...resolved, updatedAt: new Date().toISOString() } });
            setPickerOpen(false);
            setPermissionMessage(`تم الرجوع للتحديد التلقائي: ${resolved.name} — ${resolved.countryAr}`);
          }}
        />
      )}
    </div>
  );
}

function CityPickerSheet({ onPick, onUseAuto, onClose, currentCityId }: { onPick: (cityId: string) => void; onUseAuto: () => void; onClose: () => void; currentCityId: string }) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const countries = useMemo(() => listCountries(), []);
  const results = useMemo(() => (country ? searchCities(query, { countryCode: country, limit: 60 }) : searchCities(query, { limit: 60 })), [country, query]);
  const capitalCities = useMemo(() => (country ? citiesOfCountry(country).slice(0, 60) : []), [country]);

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="اختيار المدينة" onClick={onClose}>
      <div className="bottom-sheet city-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2>اختيار المدينة — كل الدول</h2>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </div>

        <button className="primary-button" onClick={onUseAuto}>
          <LocateFixed size={18} /> تحديد تلقائي (منطقة الجهاز الزمنية / GPS)
        </button>

        <div className="search-box">
          <Search size={18} />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم المدينة أو الدولة…" />
        </div>

        <label>
          الدولة
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="">كل الدول ({countries.length})</option>
            {countries.map((item) => (
              <option key={item.code} value={item.code}>{item.ar} ({item.cityCount})</option>
            ))}
          </select>
        </label>

        <div className="city-list">
          {(query || !country ? results : capitalCities).map((city) => (
            <button key={city.id} className={city.id === currentCityId ? 'active' : ''} onClick={() => onPick(city.id)}>
              <span>
                <strong>{city.nameAr || city.name}</strong>
                {city.nameAr && <small> {city.name}</small>}
              </span>
              <small>{city.countryAr} · {city.timezone}</small>
            </button>
          ))}
          {!(query || !country ? results : capitalCities).length && <p className="muted">لا نتائج. جرّب اسمًا آخر أو اختر دولة من القائمة.</p>}
        </div>

        {!query && country && (
          <p className="source-note">المعروض أكبر مدن {countries.find((item) => item.code === country)?.ar}. اكتب في البحث للوصول لأي مدينة أخرى في الدولة.</p>
        )}
        <p className="source-note">
          قاعدة المدن مدمجة في التطبيق وتعمل بدون إنترنت (المصدر: GeoNames بترخيص CC BY 4.0) وتشمل جميع الدول.
        </p>
      </div>
    </div>
  );
}
