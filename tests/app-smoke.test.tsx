import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { defaultSettings } from '../src/settings/defaults';

// jsdom لا يدعم matchMedia أو scrollIntoView — نضيف أبسط بديل كافٍ للاختبار.
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

/** يضغط زر التنقل داخل الشريط السفلي تحديدًا (الشريط الجانبي يظهر أيضًا في jsdom لأن CSS media queries لا تعمل). */
function clickNav(label: RegExp) {
  const nav = document.querySelector('.bottom-nav')!;
  const button = [...nav.querySelectorAll('button')].find((candidate) => label.test(candidate.textContent ?? ''));
  if (!button) throw new Error(`لم يُعثر على زر التنقل ${label}`);
  fireEvent.click(button);
}

function renderApp() {
  localStorage.setItem('salliha:settings:v1', JSON.stringify({ ...defaultSettings, onboardingComplete: true, onboardingVersion: 2 }));
  // شاشة البداية مكتملة حتى ندخل للتطبيق مباشرة.
  return render(<App />);
}

describe('تطبيق صليها — فحص شامل للواجهة', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => cleanup());

  it('يعرض اسم التطبيق «صليها» بالشكل الصحيح', async () => {
    renderApp();
    expect(await screen.findByText('صليها')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('صَلِّها');
  });

  it('يعرض مواقيت الصلاة لست صلوات مع الموقع والعداد التنازلي', async () => {
    renderApp();
    clickNav(/الصلاة/);
    expect(await screen.findByText(/مواقيت اليوم/)).toBeInTheDocument();
    const timeRows = document.querySelectorAll('.prayer-time');
    expect(timeRows.length).toBe(6);
    expect(document.body.textContent).toContain('الفجر');
    expect(document.body.textContent).toContain('العشاء');
    expect(document.querySelector('.countdown')?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('يفتح قائمة المدن بكل الدول ويسمح بالاختيار', async () => {
    renderApp();
    clickNav(/الصلاة/);
    const openPicker = await screen.findByText(/اختيار مدينة \(كل الدول\)/);
    fireEvent.click(openPicker.closest('button') ?? openPicker);
    expect(await screen.findByText(/اختيار المدينة — كل الدول/)).toBeInTheDocument();
    const countries = document.querySelectorAll('.city-list button');
    expect(countries.length).toBeGreaterThan(10);
  });

  it('يعرض المصحف بنص الآيات ومتغير خط القرآن', async () => {
    renderApp();
    clickNav(/المصحف/);
    expect((await screen.findAllByText('سورة الفاتحة')).length).toBeGreaterThan(0);
    const ayahText = document.querySelector('.ayah-text');
    expect(ayahText?.textContent?.length).toBeGreaterThan(3);
    const fontFamily = document.documentElement.style.getPropertyValue('--quran-font-family');
    expect(fontFamily).toContain('Amiri Quran');
    // الفاتحة كاملة (٧ آيات) داخل قسمها.
    const fatiha = document.querySelector('.surah-section[data-surah-id="1"]');
    expect(fatiha?.querySelectorAll('.ayah-block').length).toBe(7);
    // والتلاوة متصلة: البقرة تأتي مباشرة بعد الفاتحة عند النزول.
    const sections = [...document.querySelectorAll('.surah-section')].map((section) => Number((section as HTMLElement).dataset.surahId));
    expect(sections).toEqual([1, 2]);
  });

  it('يعرض الأذكار بتصنيفات غير فارغة وعدّاد قابل للضغط', async () => {
    renderApp();
    clickNav(/الأذكار/);
    const chip = await screen.findByRole('button', { name: /أذكار النوم/ });
    fireEvent.click(chip);
    await waitFor(() => expect(document.querySelectorAll('.category-chips button').length).toBeGreaterThan(8));
    const itemCount = screen.getAllByText(/من/);
    expect(itemCount.length).toBeGreaterThan(0);
    const counter = screen.getByLabelText('اضغط للعدّ');
    fireEvent.click(counter);
    fireEvent.click(counter);
    expect(document.body.textContent).toContain('2');
  });

  it('يعرض نتيجة البحث عن آية فورًا', async () => {
    renderApp();
    clickNav(/المزيد/);
    const sheet = document.querySelector('.more-sheet')!;
    const searchButton = [...sheet.querySelectorAll('button')].find((candidate) => /البحث/.test(candidate.textContent ?? ''))!;
    fireEvent.click(searchButton);
    const input = await screen.findByLabelText('نص البحث');
    fireEvent.change(input, { target: { value: 'فاصبر صبرا جميلا' } });
    const results = await screen.findAllByRole('button', { name: /فتح الآية|المعارج/ }, { timeout: 4000 });
    expect(results.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/المعارج/).length).toBeGreaterThan(0);
  });

  it('يفتح الإعدادات من الترويسة في أي وقت', async () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('الإعدادات'));
    expect(await screen.findByText(/كل الإعدادات متاحة داخل التطبيق/)).toBeInTheDocument();
  });

  it('يعرض زر تثبيت التطبيق للأيقونة', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: /تثبيت التطبيق|كيف أثبّت/ })).toBeInTheDocument();
  });
});
