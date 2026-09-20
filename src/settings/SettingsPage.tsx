import { Moon, Sun } from 'lucide-react';
import type { AppSettings } from '../core/types';

export function SettingsPage({ settings, setSettings }: { settings: AppSettings; setSettings: (updater: (settings: AppSettings) => AppSettings) => void }) {
  return (
    <div className="page-grid two-columns">
      <section className="card settings-panel">
        <h1>الإعدادات</h1>
        <label>اللغة</label>
        <select value={settings.language} onChange={(event) => setSettings((current) => ({ ...current, language: event.target.value as AppSettings['language'] }))}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
        <label>المظهر</label>
        <div className="segmented">
          <button className={settings.theme === 'light' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, theme: 'light' }))}><Sun /> فاتح</button>
          <button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, theme: 'dark' }))}><Moon /> داكن</button>
          <button className={settings.theme === 'system' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, theme: 'system' }))}>النظام</button>
        </div>
        <label>حجم الخط العام</label>
        <input type="range" min="0.85" max="1.4" step="0.05" value={settings.fontScale} onChange={(event) => setSettings((current) => ({ ...current, fontScale: Number(event.target.value) }))} />
        <label>حجم خط المصحف</label>
        <input type="range" min="0.8" max="1.8" step="0.05" value={settings.quranFontScale} onChange={(event) => setSettings((current) => ({ ...current, quranFontScale: Number(event.target.value) }))} />
      </section>
      <section className="card">
        <h2>الخصوصية</h2>
        <ul className="check-list">
          <li>لا إعلانات، لا اشتراكات، لا مشتريات داخل التطبيق.</li>
          <li>الموقع يستخدم فقط لمواقيت الصلاة وبعد إذن المستخدم.</li>
          <li>العلامات وآخر قراءة والإعدادات محفوظة محليًا.</li>
          <li>لا توجد ميزات أساسية خلف تسجيل الدخول.</li>
        </ul>
      </section>
    </div>
  );
}
