import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioProvider, useAudio } from '../src/audio/AudioProvider';
import { AudioPage } from '../src/audio/AudioPage';
import { defaultSettings } from '../src/settings/defaults';
import { filterReciters, reciters, ayahAudioUrl, surahAudioUrl } from '../src/audio/reciters';
import { quranRepository } from '../src/quran/QuranRepository';

// jsdom لا ينفّذ HTMLMediaElement — نمنع الأخطاء غير المتعلقة بالاختبار.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('salliha:settings:v1', JSON.stringify({ ...defaultSettings, onboardingComplete: true }));
  window.HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  // @ts-expect-error — واجهة Media Session غير موجودة في jsdom
  navigator.mediaSession = { metadata: null, setActionHandler: vi.fn(), playbackState: 'none' };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Probe() {
  const audio = useAudio();
  return (
    <div>
      <span data-testid="reciter-count">{reciters.length}</span>
      <span data-testid="queue-length">{audio.queue.length}</span>
      <span data-testid="position">{audio.position}</span>
      <span data-testid="mode">{audio.state.mode}</span>
      <button onClick={() => audio.playQueue(quranRepository.getSurah(112)!.verses)}>تشغيل طابور</button>
      <button onClick={() => audio.skip(10)}>تقدّم</button>
      <button onClick={() => audio.skip(-10)}>رجوع</button>
      <button onClick={() => audio.seek(45)}>قفز</button>
      <button onClick={() => audio.setRepeatMode('ayah')}>تكرار آية</button>
      <button onClick={() => audio.setRange({ surahId: 112, fromAyah: 1, toAyah: 2 })}>نطاق</button>
      <span data-testid="repeat">{audio.state.repeatMode}</span>
      <span data-testid="range">{audio.state.range ? `${audio.state.range.fromAyah}-${audio.state.range.toAyah}` : 'لا'}</span>
      <button onClick={() => audio.openPlayer()}>افتح المشغل</button>
    </div>
  );
}

function SequentialProbe() {
  const audio = useAudio();
  return (
    <div>
      <span data-testid="queue-length">{audio.queue.length}</span>
      <span data-testid="current-ayah">{audio.currentAyah ? audio.currentAyah.ayahNumber : '-'}</span>
      <span data-testid="current-surah">{audio.currentAyah ? audio.currentAyah.surahId : '-'}</span>
      <span data-testid="playing">{String(audio.state.isPlaying)}</span>
      <button onClick={() => audio.playQueue(quranRepository.getSurah(112)!.verses)}>شغّل الإخلاص</button>
      <button onClick={() => audio.jumpTo(3)}>الآية الأخيرة</button>
      <button onClick={() => audio.jumpTo(0)}>الآية الأولى</button>
      <button onClick={() => audio.setRepeatMode('ayah')}>تكرار الآية</button>
    </div>
  );
}

/** يلتقط عنصر الصوت الداخلي الذي ينشئه المشغل حتى نستطيع محاكاة حدث «انتهى». */
function captureAudioElement(): HTMLAudioElement[] {
  const instances: HTMLAudioElement[] = [];
  vi.spyOn(window, 'Audio').mockImplementation(
    function (this: unknown) {
      const element = document.createElement('audio');
      instances.push(element);
      return element;
    } as unknown as typeof Audio
  );
  return instances;
}

function ended(element: HTMLAudioElement) {
  act(() => {
    element.dispatchEvent(new Event('ended'));
  });
}

describe('التشغيل المتتالي للآيات', () => {
  it('ينتقل للآية التالية تلقائيًا عند انتهاء الآية', () => {
    const instances = captureAudioElement();
    render(
      <AudioProvider>
        <SequentialProbe />
      </AudioProvider>
    );
    fireEvent.click(screen.getByText('شغّل الإخلاص'));
    expect(screen.getByTestId('current-ayah').textContent).toBe('1');

    ended(instances[0]);
    expect(screen.getByTestId('current-ayah').textContent).toBe('2');
    ended(instances[0]);
    expect(screen.getByTestId('current-ayah').textContent).toBe('3');
    expect(screen.getByTestId('playing').textContent).toBe('true');
  });

  it('في وضع تكرار الآية يعيد نفس الآية بدل التوقف الصامت', () => {
    const instances = captureAudioElement();
    const playSpy = vi.fn(async () => undefined);
    window.HTMLMediaElement.prototype.play = playSpy;
    render(
      <AudioProvider>
        <SequentialProbe />
      </AudioProvider>
    );
    fireEvent.click(screen.getByText('شغّل الإخلاص'));
    fireEvent.click(screen.getByText('تكرار الآية'));

    instances[0].currentTime = 5;
    const playsBefore = playSpy.mock.calls.length;
    ended(instances[0]);

    expect(screen.getByTestId('current-ayah').textContent).toBe('1');
    expect(instances[0].currentTime).toBe(0);
    expect(playSpy.mock.calls.length).toBeGreaterThan(playsBefore);
    expect(screen.getByTestId('playing').textContent).toBe('true');
  });

  it('بعد نهاية السورة ينتقل تلقائيًا للسورة التي بعدها', () => {
    const instances = captureAudioElement();
    render(
      <AudioProvider>
        <SequentialProbe />
      </AudioProvider>
    );
    fireEvent.click(screen.getByText('شغّل الإخلاص'));
    fireEvent.click(screen.getByText('الآية الأخيرة'));
    expect(screen.getByTestId('current-surah').textContent).toBe('112');

    ended(instances[0]);

    // الإخلاص (112) → الفلق (113)
    expect(screen.getByTestId('current-surah').textContent).toBe('113');
    expect(screen.getByTestId('current-ayah').textContent).toBe('1');
    expect(screen.getByTestId('playing').textContent).toBe('true');
  });
});

describe('مشغل التلاوة', () => {
  it('يوفّر عشرين قارئًا على الأقل مع روابط صوت صحيحة', () => {
    expect(reciters.length).toBeGreaterThanOrEqual(20);
    for (const reciter of reciters) {
      expect(reciter.name.length).toBeGreaterThan(2);
      expect(ayahAudioUrl(reciter.id, 262)).toContain('/audio/128/');
      expect(ayahAudioUrl(reciter.id, 262).endsWith('/262.mp3')).toBe(true);
      expect(surahAudioUrl(reciter.id, 2).endsWith('/2.mp3')).toBe(true);
      expect(surahAudioUrl(reciter.id, 2)).toContain('/audio-surah/');
    }
    expect(filterReciters('الحصري').length).toBeGreaterThan(0);
    expect(filterReciters('العفاسي').length).toBeGreaterThan(0);
    expect(filterReciters('مصر').length).toBeGreaterThan(3);
    expect(filterReciters('').length).toBe(reciters.length);
  });

  it('يحمّل طابور السورة كاملًا ويقفز بالثواني', () => {
    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>
    );
    fireEvent.click(screen.getByText('تشغيل طابور'));
    expect(screen.getByTestId('queue-length').textContent).toBe('4');

    fireEvent.click(screen.getByText('تقدّم'));
    fireEvent.click(screen.getByText('رجوع'));
    fireEvent.click(screen.getByText('قفز'));
    fireEvent.click(screen.getByText('تكرار آية'));
    expect(screen.getByTestId('repeat').textContent).toBe('ayah');

    fireEvent.click(screen.getByText('نطاق'));
    expect(screen.getByTestId('range').textContent).toBe('1-2');
  });

  it('يفتح ورقة المشغل بكل أدوات التحكم', async () => {
    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>
    );
    fireEvent.click(screen.getByText('تشغيل طابور'));
    fireEvent.click(screen.getByText('افتح المشغل'));

    const sheet = await screen.findByLabelText('مشغل التلاوة');
    expect(sheet).toBeInTheDocument();
    expect(screen.getByLabelText('شريط التقدم')).toBeInTheDocument();
    expect(screen.getByLabelText('رجوع ١٠ ثوانٍ')).toBeInTheDocument();
    expect(screen.getByLabelText('تقدّم ١٠ ثوانٍ')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /قائمة الانتظار/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /القرّاء/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /القرّاء/ }));
    expect(await screen.findByPlaceholderText('ابحث عن قارئ...')).toBeInTheDocument();
    expect(document.querySelectorAll('.reciter-list article').length).toBeGreaterThan(10);

    fireEvent.click(screen.getByRole('tab', { name: /قائمة الانتظار/ }));
    expect(document.querySelectorAll('.queue-item').length).toBe(4);
  });

  it('يعرض صفحة التلاوة باختيار القارئ والسور والتحميل', async () => {
    render(
      <AudioProvider>
        <AudioPage />
      </AudioProvider>
    );
    expect(await screen.findByText(/^القرّاء/)).toBeInTheDocument();
    expect(crypto.randomUUID).toBeTypeOf('function');
    expect(document.querySelectorAll('.surah-chips button').length).toBeGreaterThan(5);
    expect(document.querySelectorAll('.reciter-list article').length).toBeGreaterThan(5);
  });
});
