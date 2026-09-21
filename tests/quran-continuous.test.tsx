import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { QuranPage } from '../src/quran/QuranPage';
import { AudioProvider } from '../src/audio/AudioProvider';
import { defaultSettings } from '../src/settings/defaults';

function renderQuranPage(props: { target?: { surahId: number; ayahNumber: number } | null } = {}) {
  return render(
    <AudioProvider>
      <QuranPage {...props} />
    </AudioProvider>
  );
}

function enableContinuousMode() {
  localStorage.setItem(
    'salliha:settings:v1',
    JSON.stringify({ ...defaultSettings, onboardingComplete: true, reading: { ...defaultSettings.reading, viewMode: 'continuous' } })
  );
}

/** انتظار مرور المهام المؤقتة (رسم + تمرير + حفظ الموضع). */
function wait(ms: number) {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

describe('العرض المتصل — المصحف كاملًا ورا بعضه في تمرير واحد', () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    document.elementFromPoint = vi.fn(() => null);
    enableContinuousMode();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('يعرض 114 سورة متتابعة: البقرة تحت الفاتحة مباشرة', () => {
    renderQuranPage();
    const sections = Array.from(document.querySelectorAll('.surah-section'));
    expect(sections.length).toBe(114);
    expect(sections[0].id).toBe('surah-1');
    expect(sections[1].id).toBe('surah-2');
    expect(sections[113].id).toBe('surah-114');

    // آخر آية في الفاتحة قبل مطلع البقرة مباشرة في ترتيب المستند
    const lastFatihah = document.getElementById('ayah-1-7')!;
    const baqarahHead = document.getElementById('surah-head-2')!;
    expect(lastFatihah.compareDocumentPosition(baqarahHead) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    // البسملة بين السور: موجودة للبقرة، غير مكررة للفاتحة والتوبة
    expect(document.querySelectorAll('#surah-1 .basmala').length).toBe(0);
    expect(document.querySelectorAll('#surah-2 .basmala').length).toBe(1);
    expect(document.querySelectorAll('#surah-9 .basmala').length).toBe(0);

    // القرآن كاملًا: 6236 آية حتى آخر آية في الناس
    expect(document.querySelectorAll('.ayah-block').length).toBe(6236);
    expect(document.getElementById('ayah-114-6')).not.toBeNull();
  }, 60000);

  it('اختيار سورة من القائمة يمرّر إلى مطلعها مباشرة', async () => {
    renderQuranPage();
    await wait(150);
    (Element.prototype.scrollIntoView as Mock).mockClear();

    fireEvent.click(screen.getByLabelText('اختيار السورة'));
    const options = Array.from(document.querySelectorAll('.surah-grid button'));
    const kahf = options.find((button) => button.textContent?.includes('الكهف'))!;
    fireEvent.click(kahf);
    await wait(60); // scrollIntoView يتم داخل requestAnimationFrame

    expect(document.querySelector('.sheet-backdrop')).toBeNull();
    const mock = Element.prototype.scrollIntoView as Mock;
    expect(mock).toHaveBeenCalled();
    expect(mock.mock.instances[mock.mock.calls.length - 1]).toBe(document.getElementById('surah-head-18'));
  }, 60000);

  it('ينتقل إلى آية مقصودة (من البحث أو العلامات) داخل العرض المتصل', async () => {
    renderQuranPage({ target: { surahId: 67, ayahNumber: 3 } });
    await wait(200);
    const mock = Element.prototype.scrollIntoView as Mock;
    expect(mock.mock.instances[mock.mock.calls.length - 1]).toBe(document.getElementById('ayah-67-3'));
  }, 60000);

  it('يستأنف من آخر موضع قراءة محفوظ عند فتح المصحف المتصل', async () => {
    localStorage.setItem('salliha:reading-position:v1', JSON.stringify({ surahId: 2, ayahNumber: 255, updatedAt: new Date().toISOString() }));
    renderQuranPage();
    await wait(150);
    const mock = Element.prototype.scrollIntoView as Mock;
    expect(mock.mock.instances[mock.mock.calls.length - 1]).toBe(document.getElementById('ayah-2-255'));
  }, 60000);

  it('يحفظ موضع القراءة تلقائيًا أثناء التمرير', async () => {
    renderQuranPage();
    await wait(150);

    const visibleAyah = document.getElementById('ayah-36-1')!;
    (document.elementFromPoint as Mock).mockReturnValue(visibleAyah);
    fireEvent.scroll(window);
    // rAF للفحص ثم مهلة الحفظ المؤجلة
    await wait(1300);

    const saved = JSON.parse(localStorage.getItem('salliha:reading-position:v1') ?? 'null');
    expect(saved).toMatchObject({ surahId: 36, ayahNumber: 1 });
  }, 60000);

  it('الضغط المطول يفتح ورقة خيارات الآية في العرض المتصل أيضًا', async () => {
    vi.useFakeTimers();
    renderQuranPage();
    const ayahInBaqarah = document.getElementById('ayah-2-255')!;
    fireEvent.pointerDown(ayahInBaqarah);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('إغلاق'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    vi.useRealTimers();
  }, 60000);
});
