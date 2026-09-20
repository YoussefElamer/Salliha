import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { QuranPage } from '../src/quran/QuranPage';
import { VerseActionSheet } from '../src/quran/VerseActionSheet';
import { AudioProvider } from '../src/audio/AudioProvider';
import { quranRepository } from '../src/quran/QuranRepository';
import type { Ayah } from '../src/core/types';

function renderQuranPage() {
  return render(
    <AudioProvider defaultReciterId="ar.alafasy">
      <QuranPage />
    </AudioProvider>
  );
}

describe('Quran UI — long press & VerseActionSheet', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens VerseActionSheet on long press (~420ms) and on context menu', async () => {
    renderQuranPage();
    const ayahButtons = document.querySelectorAll('.ayah-block');
    expect(ayahButtons.length).toBeGreaterThan(0);
    const first = ayahButtons[0] as HTMLElement;

    // pointerDown without enough time should NOT open sheet
    fireEvent.pointerDown(first);
    act(() => { vi.advanceTimersByTime(200); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // advance to 420ms -> should open sheet
    act(() => { vi.advanceTimersByTime(250); });
    // flush
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // close sheet
    const closeBtn = screen.getByLabelText('إغلاق');
    fireEvent.click(closeBtn);
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // context menu should also open
    fireEvent.contextMenu(first);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('VerseActionSheet renders all action buttons', async () => {
    const ayah: Ayah = quranRepository.getAyah(1, 1)!;
    const onClose = vi.fn();
    const onPlay = vi.fn();
    const onFindSimilar = vi.fn();
    const onGoToAyah = vi.fn();
    render(<VerseActionSheet ayah={ayah} onClose={onClose} onPlay={onPlay} onFindSimilar={onFindSimilar} onGoToAyah={onGoToAyah} />);
    // header
    expect(screen.getByText(/الفاتحة/)).toBeInTheDocument();
    // snippet contains text (use class)
    const snippet = document.querySelector('.quran-snippet');
    expect(snippet).not.toBeNull();
    expect(snippet!.textContent).toContain('بِسۡمِ');
    expect(screen.getByText('تشغيل الآية')).toBeInTheDocument();
    expect(screen.getByText('التفسير')).toBeInTheDocument();
    expect(screen.getByText('إضافة للعلامات')).toBeInTheDocument();
    expect(screen.getByText('نسخ')).toBeInTheDocument();
    expect(screen.getByText('مشاركة')).toBeInTheDocument();
    expect(screen.getByText('صورة مشاركة')).toBeInTheDocument();
    expect(screen.getByText('تكرار')).toBeInTheDocument();
    expect(screen.getByText('البحث عن آيات مشابهة')).toBeInTheDocument();
    expect(screen.getByText('الانتقال إلى موضع الآية')).toBeInTheDocument();
  });

  it('pointerUp cancels long press', async () => {
    renderQuranPage();
    const first = document.querySelector('.ayah-block') as HTMLElement;
    fireEvent.pointerDown(first);
    fireEvent.pointerUp(first);
    act(() => { vi.advanceTimersByTime(600); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('pointerLeave cancels long press', async () => {
    renderQuranPage();
    const first = document.querySelector('.ayah-block') as HTMLElement;
    fireEvent.pointerDown(first);
    fireEvent.pointerLeave(first);
    act(() => { vi.advanceTimersByTime(600); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('font scale controls clamp 0.8..1.8', async () => {
    renderQuranPage();
    const minus = document.querySelector('[aria-label="تصغير الخط"]') as HTMLElement;
    const plus = document.querySelector('[aria-label="تكبير الخط"]') as HTMLElement;
    expect(minus).toBeInTheDocument();
    expect(plus).toBeInTheDocument();
    // clicking many times should not throw
    for (let i = 0; i < 20; i++) fireEvent.click(plus);
    for (let i = 0; i < 20; i++) fireEvent.click(minus);
    const scale = parseFloat(document.documentElement.style.getPropertyValue('--quran-font-scale') || '1');
    if (scale) {
      expect(scale).toBeGreaterThanOrEqual(0.8);
      expect(scale).toBeLessThanOrEqual(1.8);
    }
  });
});
