import { Bell, Check, Languages, LocateFixed, MapPin, Palette, Play, ShieldCheck, Sun, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import type { AppSettings, ThemeMode } from '../core/types';
import { deviceTimeZone, listCountries, searchCities } from '../geo/cities';
import { prayerRepository } from '../prayer/PrayerRepository';
import { nativeAdhanService } from '../notifications/NativeAdhanService';
import { rescheduleAdhan } from '../notifications/adhanScheduler';
import { requestPreciseLocation } from '../geo/nativeLocation';
import { adhanSounds, getAdhanSound } from '../audio/adhanSounds';
import { getAdhanSettings, saveAdhanSettings } from '../settings/adhanSettings';
import { useAdhan } from '../audio/AdhanProvider';

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
  const [locationBusy, setLocationBusy] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState(() => getAdhanSettings().soundId);

  const { isPlaying, soundId: activePlayingSoundId, toggleAdhan } = useAdhan();

  const detected = prayerRepository.getLocation();
  const results = query.trim().length >= 2 ? searchCities(query, { limit: 12 }) : [];

  const handleRequestLocation = async () => {
    setLocationBusy(true);
    setLocationMessage('جارٍ طلب صلاحية الموقع من النظام وتحديده…');
    const result = await requestPreciseLocation();
    setLocationBusy(false);
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
  };

  const requestNotifications = async () => {
    setPermissionMessage('جارٍ طلب إذن الإشعارات…');
    const permission = await nativeAdhanService.requestPermission().catch(() => 'unsupported' as const);
    if (permission === 'granted') {
      setSettings((current) => ({ ...current, prayer: { ...current.prayer, notificationsEnabled: true } }));
      await rescheduleAdhan().catch(() => {});
      setPermissionMessage('تم السماح بالإشعارات. سيتم تنبيهك بالأذان في أوقات الصلاة.');
    } else {
      setPermissionMessage(permission === 'unsupported' ? 'الإشعارات غير متاحة في هذه البيئة. ثبّت التطبيق على الهاتف لتفعيل أذان النظام.' : 'لم يتم منح إذن الإشعارات. يمكنك تفعيله لاحقًا من صفحة الصلاة.');
    }
  };

  const handleSoundSelect = (soundId: string) => {
    setSelectedSoundId(soundId);
    saveAdhanSettings({ ...getAdhanSettings(), soundId });
  };

  const handleFinish = async () => {
    // إذا لم يكن قد تم طلب إذن الموقع بعد وكان الوضع تلقائيًا، نحاول طلبه قبل الإنهاء
    if (detected.source === 'timezone' && settings.prayer.locationMode === 'auto') {
      try {
        await requestPreciseLocation();
      } catch {
        // إذا تعذر لا نعطل المستخدم
      }
    }
    finish();
  };

  return (
    <main className="onboarding" dir="rtl">
      <section className="onboarding-card">
        <div className="brand-mark big">ص</div>
        <h1>صليها — Salliha</h1>
        <p className="muted">قرآن كامل، مواقيت صلاة لكل دول العالم بدون إنترنت، أذكار بعدّاد سهل، وتلاوات لأشهر القرّاء — بلا إعلانات.</p>

        {/* خطوة 1: الموقع والمدينة */}
        <div className="onboarding-block">
          <h2><MapPin size={18} /> الموقع والمدينة</h2>
          <p className="muted">
            المدينة الحالية: <strong>{detected.name} — {detected.countryAr}</strong> {detected.source === 'gps' ? '(محدد بدقة GPS)' : '(تلقائي من منطقة الجهاز الزمنية)'}.
          </p>
          <div className="inline-actions">
            <button className="primary-button" onClick={() => void handleRequestLocation()} disabled={locationBusy}>
              <LocateFixed size={18} /> {locationBusy ? 'جارٍ طلب الإذن…' : 'طلب إذن موقعي وتحديده بدقة'}
            </button>
            <button className="secondary-button" onClick={() => { const resolved = prayerRepository.refreshAutoLocation({ coordinates: null }); setLocationMessage(`تم الاعتماد على المنطقة الزمنية: ${resolved.name} — ${resolved.countryAr}`); }}>
              <ShieldCheck size={18} /> الاعتماد على منطقة الجهاز
            </button>
          </div>
          <div className="search-box">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="أو ابحث عن مدينتك يدويًا… (كل الدول)" />
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

        {/* خطوة 2: اختيار صوت الأذان */}
        <div className="onboarding-block">
          <h2><Volume2 size={18} /> صوت الأذان والمؤذن</h2>
          <p className="muted">اختر صوت المؤذن المفضل وتفضل بتجربته قبل البدء:</p>
          <div className="adhan-sounds-grid">
            {adhanSounds.map((sound) => {
              const isSelected = sound.id === selectedSoundId;
              const isPlayingThis = isPlaying && activePlayingSoundId === sound.id;
              return (
                <div
                  key={sound.id}
                  className={`adhan-sound-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSoundSelect(sound.id)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="adhan-sound-main">
                    <div className="adhan-radio-mark" aria-hidden="true">
                      {isSelected && <span className="adhan-radio-inner" />}
                    </div>
                    <div className="adhan-sound-details">
                      <span className="adhan-sound-title">
                        {sound.name}
                        {isSelected && <span className="adhan-active-badge">المختار</span>}
                      </span>
                      <small className="adhan-sound-desc">{sound.nameEn}</small>
                    </div>
                  </div>
                  <div className="adhan-sound-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`adhan-preview-btn ${isPlayingThis ? 'playing' : ''}`}
                      onClick={() => toggleAdhan(sound.id, 'الظهر')}
                      type="button"
                      aria-label={isPlayingThis ? 'إيقاف' : 'تجربة'}
                    >
                      {isPlayingThis ? <VolumeX size={16} /> : <Play size={16} />}
                      <span>{isPlayingThis ? 'إيقاف' : 'استماع'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* خطوة 3: صلاحية الإشعارات */}
        <div className="onboarding-block">
          <h2><Bell size={18} /> تنبيهات وأذان الصلوات</h2>
          <p className="muted">اسمح بالإشعارات لتشغيل تنبيه وأذان الصلاة في الوقت المحدد بدقة.</p>
          <button className="secondary-button" onClick={() => void requestNotifications()}><Bell size={18} /> السماح بالإشعارات والأذان</button>
          {permissionMessage && <p className="state-note">{permissionMessage}</p>}
        </div>

        {/* خطوة 4: المظهر واللغة */}
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
          <ShieldCheck /> الصلاحيات اختيارية: الموقع لحساب المواقيت بدقة، والإشعارات لتشغيل تنبيه/أذان الصلاة في الوقت المحدد. يمكنك رفض أي صلاحية واختيار المدينة يدويًا في أي وقت.
        </div>

        <div className="inline-actions onboarding-actions">
          <button className="primary-button" onClick={() => void handleFinish()}><Check /> ابدأ الاستخدام</button>
          <button className="secondary-button" onClick={finish}>تخطي</button>
        </div>
      </section>
    </main>
  );
}
