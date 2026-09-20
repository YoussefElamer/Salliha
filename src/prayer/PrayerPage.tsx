import { Bell, BellOff, LocateFixed, Moon, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { PrayerName, PrayerSettings } from '../core/types';
import { formatClock, formatDuration } from '../core/arabic';
import { cityPresets, getCityById } from './cities';
import { calculationMethods } from './prayerCalculations';
import { prayerRepository } from './PrayerRepository';
import { notificationService } from '../notifications/NotificationService';

const prayerNames: PrayerName[] = ['الفجر', 'الشروق', 'الظهر', 'العصر', 'المغرب', 'العشاء'];

export function PrayerPage() {
  const [settings, setSettings] = useState<PrayerSettings>(() => prayerRepository.getSettings());
  const [now, setNow] = useState(new Date());
  const [permissionMessage, setPermissionMessage] = useState('');
  const [error, setError] = useState('');
  const times = useMemo(() => prayerRepository.getTodayTimes(now), [settings, now]);
  const next = useMemo(() => prayerRepository.getNextPrayer(now), [settings, now]);
  const city = getCityById(settings.cityId);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const save = (nextSettings: PrayerSettings) => {
    prayerRepository.saveSettings(nextSettings);
    setSettings(nextSettings);
  };

  const requestLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('تحديد الموقع غير مدعوم. اختر مدينتك يدويًا.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => save({ ...settings, coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude } }),
      () => setError('تعذر تحديد الموقع. يمكنك اختيار المدينة يدويًا بدون تعطيل التطبيق.'),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60 * 60 * 1000 }
    );
  };

  const requestNotifications = async () => {
    const permission = await notificationService.requestPermission();
    if (permission === 'granted') {
      save({ ...settings, notificationsEnabled: true });
      setPermissionMessage('تم تفعيل الإشعارات. دقة التنبيه في الخلفية تعتمد على نظام التشغيل والمتصفح.');
    } else if (permission === 'unsupported') {
      setPermissionMessage('الإشعارات غير مدعومة في هذا المتصفح.');
    } else {
      save({ ...settings, notificationsEnabled: false });
      setPermissionMessage('لم يتم منح إذن الإشعارات. سيظل التطبيق يعمل بدون تنبيهات.');
    }
  };

  return (
    <div className="page-grid two-columns">
      <section className="hero-card compact">
        <div className="hero-topline"><LocateFixed size={18} /> {settings.coordinates ? 'موقع محدد بإذن المستخدم' : `${city.name} — اختيار يدوي`}</div>
        <h1>{next.name}</h1>
        <div className="countdown">{formatDuration(next.time.getTime() - now.getTime())}</div>
        <p>متبقي على الصلاة — {formatClock(next.time)}</p>
      </section>

      <section className="card">
        <h2>مواقيت اليوم</h2>
        <div className="prayer-times-list roomy">
          {times.map((item) => <div className={`prayer-time ${item.name === next.name ? 'is-next' : ''}`} key={item.name}><span>{item.name}</span><strong>{formatClock(item.time)}</strong></div>)}
        </div>
      </section>

      <section className="card settings-panel">
        <h2>إعدادات الحساب</h2>
        <label>المدينة</label>
        <select value={settings.cityId} onChange={(event) => save({ ...settings, cityId: event.target.value, coordinates: null })}>
          {cityPresets.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.country}</option>)}
        </select>
        <button className="secondary-button" onClick={requestLocation}><LocateFixed size={18} /> استخدام موقعي بإذن</button>
        <label>طريقة الحساب</label>
        <select value={settings.calculationMethod} onChange={(event) => save({ ...settings, calculationMethod: event.target.value as PrayerSettings['calculationMethod'] })}>
          {calculationMethods.map((method) => <option value={method.id} key={method.id}>{method.label}</option>)}
        </select>
        <label>مذهب العصر</label>
        <select value={settings.madhhab} onChange={(event) => save({ ...settings, madhhab: event.target.value as PrayerSettings['madhhab'] })}>
          <option value="shafi">شافعي / مالكي / حنبلي</option>
          <option value="hanafi">حنفي</option>
        </select>
        <h3>تعديل يدوي بالدقائق</h3>
        <div className="offset-grid">
          {prayerNames.map((name) => <label key={name}>{name}<input type="number" value={settings.offsets[name]} onChange={(event) => save({ ...settings, offsets: { ...settings.offsets, [name]: Number(event.target.value) } })} /></label>)}
        </div>
        {error && <p className="error-note">{error}</p>}
      </section>

      <section className="card settings-panel">
        <h2>الأذان والتنبيهات</h2>
        <p className="muted">لا يحاول التطبيق تجاوز قيود Android أو iOS أو المتصفح. التنبيهات الدقيقة في الخلفية تعتمد على صلاحيات النظام، البطارية، وقيود Exact Alarms.</p>
        <button className="primary-button" onClick={requestNotifications}>{settings.notificationsEnabled ? <Bell /> : <BellOff />} إذن الإشعارات</button>
        {permissionMessage && <p className="state-note">{permissionMessage}</p>}
        <label>تنبيه قبل الصلاة بالدقائق</label>
        <input type="number" value={settings.prePrayerMinutes} onChange={(event) => save({ ...settings, prePrayerMinutes: Number(event.target.value) })} />
        <div className="toggles-list">
          {prayerNames.filter((name) => name !== 'الشروق').map((name) => (
            <label key={name} className="toggle-row">
              <span>{name}</span>
              <input type="checkbox" checked={settings.adhanEnabled[name]} onChange={(event) => save({ ...settings, adhanEnabled: { ...settings.adhanEnabled, [name]: event.target.checked } })} />
            </label>
          ))}
        </div>
        <label className="toggle-row"><span><Moon size={18} /> وضع Silent</span><input type="checkbox" checked={settings.silentMode} onChange={(event) => save({ ...settings, silentMode: event.target.checked })} /></label>
        <label className="toggle-row"><span><Smartphone size={18} /> اهتزاز</span><input type="checkbox" checked={settings.vibration} onChange={(event) => save({ ...settings, vibration: event.target.checked })} /></label>
      </section>
    </div>
  );
}
