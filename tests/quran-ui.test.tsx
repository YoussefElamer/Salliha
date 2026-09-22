import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { QuranPage } from '../src/quran/QuranPage';
import { VerseActionSheet } from '../src/quran/VerseActionSheet';
import { AudioProvider } from '../src/audio/AudioProvider';
import { quranRepository } from '../src/quran/QuranRepository';
import { defaultSettings } from '../src/settings/defaults';
import type { Ayah } from '../src/core/types';

function renderQuranPage() {
  return render(
    <AudioProvider>
      <QuranPage />
    </AudioProvider>
  );
}

describe('Quran UI — long press & VerseActionSheet', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('salliha:settings:v1', JSON.stringify({ ...defaultSettings, onboardingComplete: true, reading: { ...defaultSettings.reading, viewMode: 'ayahList' } }));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('يفتح ورقة الخيارات بالضغط المطول وبقائمة السياق', async () => {
    renderQuranPage();
    const ayahBlocks = document.querySelectorAll('.ayah-block');
    expect(ayahBlocks.length).toBeGreaterThan(0);
    const first = ayahBlocks[0] as HTMLElement;

    fireEvent.pointerDown(first);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    fireEvent.click(screen.getByLabelText('إغلاق'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.contextMenu(first);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('يعرض كل خيارات الآية الجديدة', async () => {
    const ayah: Ayah = quranRepository.getAyah(1, 1)!;
    render(
      <AudioProvider>
        <VerseActionSheet ayah={ayah} onClose={vi.fn()} onFindSimilar={vi.fn()} onGoToAyah={vi.fn()} />
      </AudioProvider>
    );
    expect(screen.getByText(/الفاتحة/)).toBeInTheDocument();
    const snippet = document.querySelector('.ayah-sheet-text');
    expect(snippet?.textContent).toContain('بِسۡمِ');
    for (const label of ['تشغيل من هذه الآية', 'تشغيل الآية وحدها', 'تكرار الآية', 'تشغيل السورة من هنا', 'التفسير', 'نسخ الآية', 'مشاركة نصية', 'مشاركة كصورة', 'إضافة للعلامات', 'البحث عن آيات مشابهة']) {
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    }
  });

  it('يلغي الضغط المطول عند رفع الإصبع أو الخروج', async () => {
    renderQuranPage();
    const first = document.querySelector('.ayah-block') as HTMLElement;
    fireEvent.pointerDown(first);
    fireEvent.pointerUp(first);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.pointerDown(first);
    fireEvent.pointerLeave(first);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('أزرار حجم الخط تغيّر المتغير العام وتُحفظ في الإعدادات', async () => {
    renderQuranPage();
    const plus = document.querySelector('[aria-label="تكبير الخط"]') as HTMLElement;
    const minus = document.querySelector('[aria-label="تصغير الخط"]') as HTMLElement;
    expect(plus).toBeInTheDocument();
    expect(minus).toBeInTheDocument();
    for (let index = 0; index < 30; index += 1) fireEvent.click(plus);
    const afterPlus = JSON.parse(localStorage.getItem('salliha:settings:v1') ?? '{}').reading.quranFontScale;
    expect(afterPlus).toBeLessThanOrEqual(2.2);
    for (let index = 0; index < 40; index += 1) fireEvent.click(minus);
    const afterMinus = JSON.parse(localStorage.getItem('salliha:settings:v1') ?? '{}').reading.quranFontScale;
    expect(afterMinus).toBeGreaterThanOrEqual(0.85);
  });

  it('يبحث داخل المصحف ويعرض النتائج فورًا', async () => {
    renderQuranPage();
    const input = screen.getByLabelText('بحث في المصحف');
    fireEvent.change(input, { target: { value: 'فاصبر صبرا جميلا' } });
    const results = document.querySelectorAll('.search-results-mini button');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].textContent).toContain('المعارج');
  });
});
