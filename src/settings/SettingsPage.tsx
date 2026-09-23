import { Bell, Check, Download, Gauge, Info, LocateFixed, Monitor, Moon, Palette, Play, RotateCcw, ShieldCheck, Sun, Trash2, Type, Upload, Vibrate, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AppRoute, RouteParams } from '../app/navigation';
import type { AppSettings, ThemeMode } from '../core/types';
import { storage } from '../core/storage';
import { getGeoMetadata, listCountries } from '../geo/cities';
import { reciters } from '../audio/reciters';
import { prayerRepository } from '../prayer/PrayerRepository';
import { adhkarRepository } from '../adhkar/AdhkarRepository';
import { settingsRepository } from './settingsRepository';
import { APP_VERSION } from './defaults';
import { quranRepository } from '../quran/QuranRepository';
import { adhanSounds, getAdhanSound } from '../audio/adhanSounds';
import { getAdhanSettings, saveAdhanSettings } from './adhanSettings';
import { useAdhan } from '../audio/AdhanProvider';
import { requestPreciseLocation } from '../geo/nativeLocation';
import { rescheduleAdhan } from '../notifications/adhanScheduler';

const themes: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'فاتح', icon: Sun },
  { id: 'dark', label: 'داكن', icon: Moon },
  { id: 'system', label: 'حسب النظام', icon: Monitor }
];

export function SettingsPage({
  settings,
  setSettings,
  navigate
}: {
  settings: AppSettings;
  setSettings: (updater: (settings: AppSettings) => AppSettings) => void;
  navigate: (route: AppRoute, params?: RouteParams) => void;
}) {
  const [message, setMessage] = useState('');
  const [adhanSoundId, setAdhanSoundId] = useState(() => getAdhanSettings().soundId);
  const [locationBusy, setLocationBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const geo = getGeoMetadata();
  const location = prayerRepository.getLocation();
  const { isPlaying, soundId: activePlayingSoundId, toggleAdhan } = useAdhan();

  const handleSoundChange = async (newSoundId: string) => {
    setAdhanSoundId(newSoundId);
    saveAdhanSettings({ ...getAdhanSettings(), soundId: newSoundId });
    const selected = getAdhanSound(newSoundId);
    setMessage(`تم اختيار صوت الأذان: ${selected.name}`);
    if (settings.prayer.notificationsEnabled) {
      await rescheduleAdhan().catch(() => {});
    }
  };

  const handleRequestLocation = () => {
    setLocationBusy(true);
    setMessage('جارٍ طلب صلاحية الموقع…');
    void requestPreciseLocation().then((result) => {
      setLocationBusy(false);
      setMessage(result.message);
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

  const exportBackup = () => {
    const blob = new Blob([settingsRepository.exportLocalBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salliha-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage('تم تصدير نسخة احتياطية من إعداداتك وعلاماتك وعدّاداتك.');
  };

  const importBackup = async (file: File) => {
    try {
      settingsRepository.importLocalBackup(await file.text());
      setMessage('تم استيراد النسخة الاحتياطية. أعد تشغيل التطبيق لتظهر كل البيانات.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر استيراد الملف.');
    }
  };

  return (
    <div className="page-grid">
      <section className="card full-span settings-panel">
        <h1>الإعدادات</h1>
        <p className="muted">
          كل الإعدادات متاحة داخل التطبيق مباشرة — لا حاجة لحذف التطبيق أو الانتظار. الإصدار {APP_VERSION}.
        </p>
        {message && <p className="state-note">{message}</p>}
      </section>

      <section className="card settings-panel">
        <h2><Palette size={18} /> المظهر والخطوط</h2>
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
        <label>
          حجم الخط العام: {Math.round(settings.fontScale * 100)}%
          <input type="range" min="0.85" max="1.4" step="0.05" value={settings.fontScale} onChange={(event) => setSettings((current) => ({ ...current, fontScale: Number(event.target.value) }))} />
        </label>
        <label>
          حجم خط المصحف: {Math.round(settings.reading.quranFontScale * 100)}%
          <input
            type="range"
            min="0.85"
            max="2.2"
            step="0.05"
            value={settings.reading.quranFontScale}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                quranFontScale: Number(event.target.value),
                reading: { ...current.reading, quranFontScale: Number(event.target.value) }
              }))
            }
          />
        </label>
        <label>
          خط المصحف
          <select
            value={settings.reading.quranFontFamily}
            onChange={(event) => setSettings((current) => ({ ...current, reading: { ...current.reading, quranFontFamily: event.target.value as AppSettings['reading']['quranFontFamily'] } }))}
          >
            <option value="amiriQuran">أميري قرآن — خط المصحف</option>
            <option value="notoNaskh">Noto Naskh — نسخ عربي</option>
          </select>
        </label>
        <label>
          طريقة عرض المصحف
          <select
            value={settings.reading.viewMode}
            onChange={(event) => setSettings((current) => ({ ...current, reading: { ...current.reading, viewMode: event.target.value as AppSettings['reading']['viewMode'] } }))}
          >
            <option value="flow">صفحة متصلة (مصحف)</option>
            <option value="ayahList">آية في كل سطر</option>
          </select>
        </label>
        <p className="source-note"><Type size={14} /> الخطوط مدمجة داخل التطبيق (Amiri Quran و Cairo بترخيص SIL OFL) ولذلك لا تظهر مربعات فارغة بدل الحروف.</p>
      </section>

      <section className="card settings-panel">
        <h2><Gauge size={18} /> التلاوة والصوت</h2>
        <label>
          القارئ الافتراضي
          <select
            value={settings.playback.reciterId}
            onChange={(event) =>
              setSettings((current) => ({ ...current, defaultReciterId: event.target.value, playback: { ...current.playback, reciterId: event.target.value } }))
            }
          >
            {reciters.map((reciter) => (
              <option key={reciter.id} value={reciter.id}>{reciter.name}</option>
            ))}
          </select>
        </label>
        <label>
          وضع التشغيل الافتراضي
          <select
            value={settings.playback.mode}
            onChange={(event) => setSettings((current) => ({ ...current, playback: { ...current.playback, mode: event.target.value as AppSettings['playback']['mode'] } }))}
          >
            <option value="ayah">آية بآية (التحكم الدقيق)</option>
            <option value="surah">السورة كاملة (ملف واحد)</option>
          </select>
        </label>
        <label>
          جودة الصوت
          <select value={settings.playback.bitrate} onChange={(event) => setSettings((current) => ({ ...current, playback: { ...current.playback, bitrate: Number(event.target.value) } }))}>
            <option value={128}>128 kbps</option>
            <option value={64}>64 kbps (توفير بيانات)</option>
          </select>
        </label>
        <label className="toggle-row">
          <span>الاستمرار إلى السورة التالية تلقائيًا</span>
          <input
            type="checkbox"
            checked={settings.playback.autoPlayNextSurah}
            onChange={(event) => setSettings((current) => ({ ...current, playback: { ...current.playback, autoPlayNextSurah: event.target.checked } }))}
          />
        </label>
        <button className="secondary-button" onClick={() => navigate('audio')}>
          فتح صفحة التلاوة والتحميل
        </button>
      </section>

      <section className="card settings-panel">
        <h2><Bell size={18} /> الصلاة والأذان</h2>
        <p className="muted">
          الموقع الحالي: {location.name} — {location.countryAr} ({location.timezone}) {location.source === 'gps' ? '· عبر GPS' : '· عبر المنطقة الزمنية (تقريبي)'} · طريقة الحساب: {settings.prayer.calculationMethod === 'auto' ? `تلقائية (${location.method})` : location.method}
        </p>

        {location.source === 'timezone' && (
          <div className="location-prompt-card" style={{ marginBottom: '0.8rem' }}>
            <div className="location-prompt-header">
              <LocateFixed size={18} />
              <span>طلب صلاحية الموقع لتحديد دقيق</span>
            </div>
            <p className="location-prompt-text">
              الموقع الحالي يعتمد على توقيت الجهاز فقط. اضغط أدناه لطلب صلاحية الموقع وحساب مواقيت الصلاة بإحداثياتك بدقة.
            </p>
            <button className="primary-button" onClick={handleRequestLocation} disabled={locationBusy}>
              <LocateFixed size={16} /> {locationBusy ? 'جارٍ طلب الصلاحية…' : 'طلب إذن الموقع وتحديده بدقة'}
            </button>
          </div>
        )}

        <label>
          صوت الأذان والمؤذن
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={adhanSoundId}
              onChange={(e) => void handleSoundChange(e.target.value)}
              style={{ flex: 1 }}
            >
              {adhanSounds.map((sound) => (
                <option key={sound.id} value={sound.id}>
                  {sound.name}
                </option>
              ))}
            </select>
            <button
              className={`adhan-preview-btn ${isPlaying && activePlayingSoundId === adhanSoundId ? 'playing' : ''}`}
              onClick={() => toggleAdhan(adhanSoundId, 'الظهر')}
              type="button"
              aria-label="تجربة صوت الأذان"
            >
              {isPlaying && activePlayingSoundId === adhanSoundId ? <VolumeX size={16} /> : <Play size={16} />}
              <span>{isPlaying && activePlayingSoundId === adhanSoundId ? 'إيقاف' : 'تجربة'}</span>
            </button>
          </div>
        </label>

        <div className="inline-actions">
          <button className="secondary-button" onClick={() => navigate('prayer')}>
            فتح صفحة المواقيت والإشعارات
          </button>
          {location.source !== 'timezone' && (
            <button className="secondary-button" onClick={handleRequestLocation} disabled={locationBusy}>
              <LocateFixed size={16} /> {locationBusy ? 'جارٍ التحديث…' : 'تحديث الموقع بدقة'}
            </button>
          )}
        </div>

        <label className="toggle-row">
          <span><Vibrate size={18} /> اهتزاز عند العدّ والأذكار</span>
          <input
            type="checkbox"
            checked={settings.adhkar.hapticFeedback}
            onChange={(event) => setSettings((current) => ({ ...current, adhkar: { ...current.adhkar, hapticFeedback: event.target.checked } }))}
          />
        </label>
        <p className="source-note">
          قاعدة المدن المدمجة: {listCountries().length} دولة و{geo.fields.length ? 'آلاف' : ''} المدن ({geo.minimumPopulation.toLocaleString('ar-EG')}+ نسمة للعواصم والمدن الكبرى). المصدر: {geo.sourceName}.
        </p>
      </section>

      <section className="card settings-panel">
        <h2><ShieldCheck size={18} /> الخصوصية</h2>
        <ul className="check-list">
          <li>لا إعلانات ولا اشتراكات ولا مشتريات داخل التطبيق.</li>
          <li>الموقع يُستخدم فقط لحساب المواقيت، وبتصريح منك، ويُحسب محليًا.</li>
          <li>البحث في القرآن والأذكار يجري بالكامل على الجهاز — لا تُرسل أي كلمات للإنترنت.</li>
          <li>لا توجد ميزات أساسية خلف تسجيل دخول.</li>
        </ul>
      </section>

      <section className="card settings-panel">
        <h2><Download size={18} /> البيانات والنسخ الاحتياطي</h2>
        <div className="inline-actions">
          <button className="secondary-button" onClick={exportBackup}><Download size={18} /> تصدير نسخة احتياطية</button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={18} /> استيراد نسخة</button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => event.target.files?.[0] && void importBackup(event.target.files[0])} />
        </div>
        <div className="inline-actions">
          <button
            className="secondary-button"
            onClick={() => {
              if (!window.confirm('سيتم تصفير كل عدّادات الأذكار وسجل الإنجاز. متابعة؟')) return;
              adhkarRepository.resetAllCounters();
              setMessage('تم تصفير عدّادات الأذكار.');
            }}
          >
            <RotateCcw size={18} /> تصفير عدّادات الأذكار
          </button>
          <button
            className="secondary-button"
            onClick={async () => {
              if (!('caches' in window)) {
                setMessage('التخزين المؤقت غير مدعوم هنا.');
                return;
              }
              if (!window.confirm('سيتم حذف التلاوات المحمّلة على الجهاز (تحتاج إنترنت لإعادة تحميلها). متابعة؟')) return;
              const names = await caches.keys();
              await Promise.all(names.filter((name) => name === 'salliha-audio-v1').map((name) => caches.delete(name)));
              storage.set('downloads:v1', []);
              setMessage('تم حذف التلاوات المحمّلة.');
            }}
          >
            <Trash2 size={18} /> حذف التلاوات المحمّلة
          </button>
        </div>
        <button
          className="secondary-button danger"
          onClick={() => {
            if (!window.confirm('إعادة التطبيق لحالته الأولى ستحذف العلامات وآخر قراءة والإعدادات. متابعة؟')) return;
            for (const key of ['settings:v1', 'bookmarks:v1', 'reading-position:v1', 'dhikr-progress:v1', 'dhikr-counters:v1', 'playback-snapshot:v1', 'tafsir-cache:v1', 'downloads:v1', 'memorization:v1', 'hifz:plans:v1', 'hifz:progress:v1', 'opendua-catalogue:v1']) {
              storage.remove(key);
            }
            window.location.reload();
          }}
        >
          <Trash2 size={18} /> إعادة ضبط التطبيق بالكامل
        </button>
      </section>

      <section className="card settings-panel">
        <h2><Info size={18} /> عن التطبيق</h2>
        <p className="muted">
          صليها — تطبيق إسلامي مجاني بلا إعلانات: مصحف كامل مُتحقَّق منه، مواقيت صلاة لكل دول العالم بدون إنترنت، أذكار بعدّاد سهل، وتلاوات لأشهر القرّاء.
        </p>
        <ul className="check-list">
          <li>نص القرآن: {quranRepository.getMetadata().sourceName} v{quranRepository.getMetadata().sourceVersion} — مع تحقق SHA-256 عند البناء.</li>
          <li>الأذكار: {adhkarRepository.getMetadata().sourceName} — {adhkarRepository.getMetadata().license}.</li>
          <li>المدن والمواقيت: {geo.sourceName} — {geo.license}.</li>
          <li>التلاوات: AlQuran.cloud / Islamic Network CDN — بث مباشر دون إعادة توزيع الملفات.</li>
        </ul>
        <button
          className="secondary-button"
          onClick={() => {
            setSettings((current) => ({ ...current, onboardingComplete: false }));
          }}
        >
          <Check size={18} /> عرض شاشة البداية مرة أخرى
        </button>
      </section>
    </div>
  );
}
