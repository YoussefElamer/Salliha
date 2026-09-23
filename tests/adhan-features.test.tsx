import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { adhanSounds, getAdhanSound } from '../src/audio/adhanSounds';
import { getAdhanSettings, saveAdhanSettings } from '../src/settings/adhanSettings';
import { requestPreciseLocation, checkLocationPermissionState } from '../src/geo/nativeLocation';
import { defaultSettings } from '../src/settings/defaults';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
  });
  Element.prototype.scrollIntoView = vi.fn();
});

function clickNav(label: RegExp) {
  const nav = document.querySelector('.bottom-nav')!;
  const button = [...nav.querySelectorAll('button')].find((candidate) => label.test(candidate.textContent ?? ''));
  if (!button) throw new Error(`لم يُعثر على زر التنقل ${label}`);
  fireEvent.click(button);
}

function renderApp() {
  localStorage.setItem(
    'salliha:settings:v1',
    JSON.stringify({ ...defaultSettings, onboardingComplete: true, onboardingVersion: 2 })
  );
  return render(<App />);
}

describe('ميزات الأذان واختيار الأصوات واستمرار التشغيل', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // HTMLMediaElement mock
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('يحتوي التطبيق على قائمة أصوات أذان متعددة للمؤذنين', () => {
    expect(adhanSounds.length).toBeGreaterThanOrEqual(6);
    expect(adhanSounds.map((s) => s.name)).toContain('عبد الباسط — مصر');
    expect(adhanSounds.map((s) => s.name)).toContain('أحمد نعينع — مصر');
    expect(adhanSounds.map((s) => s.name)).toContain('الحرم المكي');
    expect(adhanSounds.map((s) => s.name)).toContain('الحرم المدني');
  });

  it('يعرض قائمة اختيار أصوات الأذان في صفحة الصلاة مع خيارات الاستماع والتبديل', async () => {
    renderApp();
    clickNav(/الصلاة/);

    expect(await screen.findByText(/صوت الأذان والمؤذن/)).toBeInTheDocument();
    expect(screen.getByText('عبد الباسط — مصر')).toBeInTheDocument();
    expect(screen.getByText('أحمد نعينع — مصر')).toBeInTheDocument();
    expect(screen.getByText('الحرم المكي')).toBeInTheDocument();
    expect(screen.getByText('الحرم المدني')).toBeInTheDocument();

    // فحص أزرار الاستماع
    const previewButtons = screen.getAllByRole('button', { name: /استماع|إيقاف/ });
    expect(previewButtons.length).toBeGreaterThanOrEqual(6);

    // تبديل اختيار المؤذن
    const nuinaaCard = screen.getByText('أحمد نعينع — مصر').closest('.adhan-sound-card')!;
    fireEvent.click(nuinaaCard);

    expect(getAdhanSettings().soundId).toBe('ahmad-nuinaa-egypt');
  });

  it('يستمر الأذان في العمل عند التنقل بين الشاشات ويعرض شريط الأذان العائم الموحد', async () => {
    renderApp();
    clickNav(/الصلاة/);

    await screen.findByText(/صوت الأذان والمؤذن/);

    // تشغيل الأذان
    const firstPreviewBtn = screen.getAllByRole('button', { name: /استماع لأذان/ })[0];
    fireEvent.click(firstPreviewBtn);

    // التحقق من ظهور شريط الأذان العائم الموحد
    await waitFor(() => {
      const bar = document.querySelector('.adhan-floating-bar');
      expect(bar).toBeInTheDocument();
    });

    // التنقل إلى شاشة المصحف — الأذان يستمر ولا يفصل!
    clickNav(/المصحف/);
    expect((await screen.findAllByText('المصحف')).length).toBeGreaterThan(0);

    // شريط الأذان لا زال موجودًا ولم يفصل
    expect(document.querySelector('.adhan-floating-bar')).toBeInTheDocument();
    expect(document.body.textContent).toContain('تجربة صوت الأذان');

    // التنقل إلى شاشة الأذكار — الأذان يستمر
    clickNav(/الأذكار/);
    expect((await screen.findAllByText('الأذكار')).length).toBeGreaterThan(0);
    expect(document.querySelector('.adhan-floating-bar')).toBeInTheDocument();

    // الضغط على زر إيقاف في الشريط العائم يوقف الأذان
    const stopBtn = screen.getByRole('button', { name: /إيقاف الأذان/ });
    fireEvent.click(stopBtn);

    // الشريط العائم يختفي بعد الإيقاف
    await waitFor(() => {
      expect(document.querySelector('.adhan-floating-bar')).not.toBeInTheDocument();
    });
  });

  it('يعرض تنبيه طلب صلاحية الموقع في صفحة الصلاة عند الاعتماد على التوقيت فقط', async () => {
    renderApp();
    clickNav(/الصلاة/);

    expect(await screen.findByText(/طلب إذن الموقع لمواقيت أكثر دقة/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /السماح بصلاحية الموقع وتحديده بدقة/ })).toBeInTheDocument();
  });

  it('دالة requestPreciseLocation تتعامل مع البيئة والمتصفح بسلاسة', async () => {
    const status = await checkLocationPermissionState();
    expect(['granted', 'prompt', 'denied', 'unsupported']).toContain(status);

    const result = await requestPreciseLocation();
    expect(typeof result.ok).toBe('boolean');
    expect(result.message.length).toBeGreaterThan(5);
  });
});
