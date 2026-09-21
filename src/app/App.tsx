import { Download, Moon, Settings, ShieldCheck, Smartphone, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdhkarPage } from '../adhkar/AdhkarPage';
import { AudioPage } from '../audio/AudioPage';
import { AudioProvider } from '../audio/AudioProvider';
import { HomePage } from '../home/HomePage';
import { Onboarding } from '../onboarding/Onboarding';
import { PrayerPage } from '../prayer/PrayerPage';
import { ProfilePage } from '../profile/ProfilePage';
import { QuranPage } from '../quran/QuranPage';
import { scheduleSearchWarmUp } from '../quran/QuranRepository';
import { SearchPage } from '../search/SearchPage';
import { SettingsPage } from '../settings/SettingsPage';
import { HifzPage } from '../hifz/HifzPage';
import { StatsPage } from '../stats/StatsPage';
import { useSettings } from '../settings/useSettings';
import { getGeoMetadata } from '../geo/cities';
import { mainNavItems, moreNavItems, type AppRoute, type RouteState } from './navigation';
import { playBuiltInChime } from '../notifications/adhanSounds';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ROUTE_PARAM_ROUTES: AppRoute[] = ['home', 'quran', 'prayer', 'audio', 'adhkar', 'search', 'space', 'settings', 'hifz', 'stats'];

/** يقرأ ?route=quran من رابط التثبيت (اختصارات المانيفست) لعرض القسم المطلوب مباشرة. */
function initialRoute(): RouteState {
  try {
    const requested = new URL(window.location.href).searchParams.get('route');
    if (requested && (ROUTE_PARAM_ROUTES as string[]).includes(requested)) {
      const surah = Number(new URL(window.location.href).searchParams.get('surah'));
      return { route: requested as AppRoute, params: Number.isFinite(surah) && surah > 0 ? { surahId: surah, ayahNumber: 1 } : undefined };
    }
  } catch {
    // تجاهل أي رابط غير صالح.
  }
  return { route: 'home' };
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** يشغّل صوت «صَلِّ على محمد ﷺ» كل فترة مختارة أثناء فتح التطبيق. */
function useSalawatReminder(salawat: { enabled: boolean; intervalMinutes: number }): void {
  useEffect(() => {
    if (!salawat.enabled) return;
    const minutes = Math.min(180, Math.max(1, salawat.intervalMinutes || 15));
    const play = () => {
      try {
        const audio = new Audio('/sounds/salawat.mp3');
        const attempt = audio.play();
        if (attempt) attempt.catch(() => playBuiltInChime());
      } catch {
        playBuiltInChime();
      }
    };
    const timer = window.setInterval(play, minutes * 60_000);
    return () => window.clearInterval(timer);
  }, [salawat.enabled, salawat.intervalMinutes]);
}

export function App() {
  const { settings, setSettings } = useSettings();
  const [route, setRoute] = useState<RouteState>(() => initialRoute());
  const [moreOpen, setMoreOpen] = useState(false);
  const [installHint, setInstallHint] = useState(() => !isStandaloneDisplay());
  const installPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [installPromptReady, setInstallPromptReady] = useState(false);
  const [installMessage, setInstallMessage] = useState('');

  useSalawatReminder(settings.salawat);

  useEffect(() => {
    scheduleSearchWarmUp();
  }, []);

  // زر التثبيت: يظهر تلقائيًا على Android/Chrome، وإلا نعرض خطوات الإضافة اليدوية.
  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as BeforeInstallPromptEvent;
      setInstallPromptReady(true);
    };
    const onInstalled = () => {
      setInstallHint(false);
      setInstallMessage('تم تثبيت التطبيق — ستجد أيقونة «صليها» على شاشة جهازك.');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const requestInstall = async () => {
    const prompt = installPromptRef.current;
    if (!prompt) {
      setInstallMessage('افتح قائمة المتصفح ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» لتظهر الأيقونة على جهازك.');
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setInstallMessage(choice.outcome === 'accepted' ? 'تم بدء التثبيت…' : 'يمكنك التثبيت في أي وقت من نفس الزر.');
  };

  const navigate = useCallback((nextRoute: AppRoute, params?: RouteState['params']) => {
    setRoute({ route: nextRoute, params });
    setMoreOpen(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, []);

  if (!settings.onboardingComplete) {
    return <Onboarding settings={settings} setSettings={setSettings} finish={() => setSettings((current) => ({ ...current, onboardingComplete: true, onboardingVersion: 2 }))} />;
  }

  const toggleTheme = () => {
    setSettings((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }));
  };

  return (
    <AudioProvider>
      <div className="app-shell">
        <header className="app-header">
          <button className="brand" onClick={() => navigate('home')} aria-label="صليها — الرئيسية">
            <span className="brand-mark" aria-hidden="true">ص</span>
            <span className="brand-text">
              <strong>صليها</strong>
              <small>Salliha</small>
            </span>
          </button>
          <div className="header-actions">
            <button className="icon-button" onClick={toggleTheme} aria-label="تبديل المظهر">
              {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" onClick={() => navigate('settings')} aria-label="الإعدادات">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="layout">
          <nav className="side-nav" aria-label="التنقل الرئيسي">
            {[...mainNavItems, ...moreNavItems].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.route} className={route.route === item.route ? 'active' : ''} onClick={() => navigate(item.route)}>
                  <Icon size={20} /> {item.label}
                </button>
              );
            })}
            <div className="side-nav-note">
              <ShieldCheck size={16} /> يعمل بدون إنترنت — {getGeoMetadata().countryCount} دولة و{getGeoMetadata().cityCount} مدينة داخل التطبيق.
            </div>
          </nav>

          <main className="content" tabIndex={-1}>
            {renderRoute(route, navigate, settings, setSettings)}
          </main>
        </div>

        {installHint && (
          <div className="install-hint card">
            <Smartphone size={18} />
            <span>
              ثبّت «صليها» ليصبح لها أيقونة على شاشة جهازك، ويُفتح بدون شريط المتصفح.
              {installMessage ? ` ${installMessage}` : ''}
            </span>
            <div className="inline-actions">
              <button className="primary-button" onClick={() => void requestInstall()}>
                <Download size={18} /> {installPromptReady ? 'تثبيت التطبيق' : 'كيف أثبّت؟'}
              </button>
              <button className="icon-button" onClick={() => setInstallHint(false)} aria-label="إخفاء التنبيه">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <nav className="bottom-nav" aria-label="التنقل السريع">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.route} className={route.route === item.route ? 'active' : ''} onClick={() => navigate(item.route)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button className={moreNavItems.some((item) => item.route === route.route) ? 'active' : ''} onClick={() => setMoreOpen(true)}>
            <ShieldCheck size={20} />
            <span>المزيد</span>
          </button>
        </nav>

        {moreOpen && (
          <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="المزيد" onClick={() => setMoreOpen(false)}>
            <div className="bottom-sheet more-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="section-heading">
                <h2>المزيد</h2>
                <button className="icon-button" onClick={() => setMoreOpen(false)} aria-label="إغلاق">
                  <X size={20} />
                </button>
              </div>
              <div className="more-grid">
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.route} onClick={() => navigate(item.route)}>
                      <Icon size={22} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AudioProvider>
  );
}

function renderRoute(route: RouteState, navigate: (route: AppRoute, params?: RouteState['params']) => void, settings: ReturnType<typeof useSettings>['settings'], setSettings: ReturnType<typeof useSettings>['setSettings']) {
  switch (route.route) {
    case 'home':
      return <HomePage navigate={navigate} />;
    case 'quran':
      return <QuranPage target={route.params?.surahId ? { surahId: route.params.surahId, ayahNumber: route.params.ayahNumber ?? 1 } : null} />;
    case 'prayer':
      return <PrayerPage />;
    case 'audio':
      return <AudioPage />;
    case 'adhkar':
      return <AdhkarPage />;
    case 'search':
      return <SearchPage navigate={navigate} onOpenAyah={(surahId, ayahNumber) => navigate('quran', { surahId, ayahNumber })} />;
    case 'hifz':
      return <HifzPage />;
    case 'stats':
      return <StatsPage />;
    case 'space':
      return <ProfilePage navigate={navigate} />;
    case 'settings':
      return <SettingsPage settings={settings} setSettings={setSettings} navigate={navigate} />;
    default:
      return <HomePage navigate={navigate} />;
  }
}
