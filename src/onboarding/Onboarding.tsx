import { Bell, Check, LocateFixed, Moon } from 'lucide-react';
import type { AppSettings } from '../core/types';
import { cityPresets } from '../prayer/cities';

export function Onboarding({ settings, setSettings, finish }: { settings: AppSettings; setSettings: (updater: (settings: AppSettings) => AppSettings) => void; finish: () => void }) {
  return (
    <main className="onboarding" dir="rtl">
      <section className="onboarding-card">
        <div className="brand-mark">ص</div>
        <h1>صَلِّها — Salliha</h1>
        <p>تطبيق مجاني بالكامل، بلا إعلانات، يحافظ على خصوصيتك ويعمل Offline قدر الإمكان.</p>
        <div className="onboarding-steps">
          <label>١. اللغة<select value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value as AppSettings['language'] }))}><option value="ar">العربية</option><option value="en">English</option></select></label>
          <label>٢. المدينة اليدوية<select value={settings.prayer.cityId} onChange={(event) => setSettings((current) => ({ ...current, prayer: { ...current.prayer, cityId: event.target.value } }))}>{cityPresets.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
          <div className="permission-note"><LocateFixed /> الموقع اختياري، ويطلب فقط عند إعداد مواقيت الصلاة.</div>
          <div className="permission-note"><Bell /> الإشعارات اختيارية ويمكن تفعيلها لاحقًا.</div>
          <label>٣. المظهر<select value={settings.theme} onChange={(event) => setSettings((current) => ({ ...current, theme: event.target.value as AppSettings['theme'] }))}><option value="system">حسب النظام</option><option value="light">فاتح</option><option value="dark">داكن</option></select></label>
          <div className="permission-note"><Moon /> وضع القراءة الداكن متاح من الإعدادات.</div>
        </div>
        <button className="primary-button" onClick={finish}><Check /> الدخول للتطبيق</button>
      </section>
    </main>
  );
}
