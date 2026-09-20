import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { AdhkarPage } from '../adhkar/AdhkarPage';
import { AudioPage } from '../audio/AudioPage';
import { AudioProvider } from '../audio/AudioProvider';
import { HomePage } from '../home/HomePage';
import { Onboarding } from '../onboarding/Onboarding';
import { PrayerPage } from '../prayer/PrayerPage';
import { ProfilePage } from '../profile/ProfilePage';
import { QuranPage } from '../quran/QuranPage';
import { SearchPage } from '../search/SearchPage';
import { SettingsPage } from '../settings/SettingsPage';
import { useSettings } from '../settings/useSettings';
import { mainNavItems, moreNavItems, type AppRoute } from './navigation';

export function App() {
  const { settings, setSettings } = useSettings();
  const [route, setRoute] = useState<AppRoute>('home');

  if (!settings.onboardingComplete) {
    return <Onboarding settings={settings} setSettings={setSettings} finish={() => setSettings((current) => ({ ...current, onboardingComplete: true }))} />;
  }

  return (
    <AudioProvider defaultReciterId={settings.defaultReciterId}>
      <div className="app-shell">
        <header className="app-header">
          <button className="brand" onClick={() => setRoute('home')} aria-label="صَلِّها الرئيسية">
            <span className="brand-mark">ص</span>
            <span><strong>صَلِّها</strong><small>Salliha</small></span>
          </button>
          <div className="trust-pill"><ShieldCheck size={16} /> مجاني بلا إعلانات — القرآن متحقق</div>
        </header>
        <div className="layout">
          <nav className="side-nav" aria-label="التنقل الرئيسي">
            {[...mainNavItems, ...moreNavItems, { route: 'space' as AppRoute, label: 'مساحتي', icon: ShieldCheck }].map((item) => {
              const Icon = item.icon;
              return <button className={route === item.route ? 'active' : ''} key={item.route} onClick={() => setRoute(item.route)}><Icon size={20} /> {item.label}</button>;
            })}
          </nav>
          <main className="content" tabIndex={-1}>{renderRoute(route, setRoute, settings, setSettings)}</main>
        </div>
        <nav className="bottom-nav" aria-label="التنقل السريع">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return <button className={route === item.route ? 'active' : ''} key={item.route} onClick={() => setRoute(item.route)}><Icon size={20} /><span>{item.label}</span></button>;
          })}
        </nav>
      </div>
    </AudioProvider>
  );
}

function renderRoute(route: AppRoute, navigate: (route: AppRoute) => void, settings: ReturnType<typeof useSettings>['settings'], setSettings: ReturnType<typeof useSettings>['setSettings']) {
  switch (route) {
    case 'home': return <HomePage navigate={navigate} />;
    case 'quran': return <QuranPage />;
    case 'prayer': return <PrayerPage />;
    case 'audio': return <AudioPage />;
    case 'adhkar': return <AdhkarPage />;
    case 'search': return <SearchPage navigate={navigate} />;
    case 'space': return <ProfilePage />;
    case 'settings': return <SettingsPage settings={settings} setSettings={setSettings} />;
    default: return <HomePage navigate={navigate} />;
  }
}
