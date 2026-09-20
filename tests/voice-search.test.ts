import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isVoiceSearchSupported, voiceSearchOnce } from '../src/search/voiceSearch';

describe('voiceSearch', () => {
  const originalWindow = global.window;
  afterEach(() => { vi.restoreAllMocks(); });

  it('reports unsupported when API missing', () => {
    // @ts-ignore
    delete (global.window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    // @ts-ignore
    delete (global.window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    expect(isVoiceSearchSupported()).toBe(false);
  });

  it('reports supported when API present', () => {
    // @ts-ignore
    global.window.webkitSpeechRecognition = class {};
    expect(isVoiceSearchSupported()).toBe(true);
    // @ts-ignore
    delete global.window.webkitSpeechRecognition;
  });

  it('rejects when API missing at call time', async () => {
    // ensure no API
    // @ts-ignore
    delete (global.window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    // @ts-ignore
    delete (global.window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    await expect(voiceSearchOnce()).rejects.toThrow('غير مدعوم');
  });

  it('resolves transcript on successful recognition', async () => {
    const mockStart = vi.fn();
    const mockStop = vi.fn();
    let onResult: ((e: { results: Array<Array<{ transcript: string; confidence: number }>> }) => void) | null = null;
    class MockRecog {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      continuous = false;
      start = mockStart.mockImplementation(() => {
        setTimeout(() => onResult?.({ results: [[{ transcript: 'سورة البقرة', confidence: 0.95 }]] }), 10);
      });
      stop = mockStop;
      set onresult(fn) { onResult = fn; }
      get onresult() { return onResult; }
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
    }
    // @ts-ignore
    global.window.webkitSpeechRecognition = MockRecog;
    const result = await voiceSearchOnce({ lang: 'ar-SA' });
    expect(result.transcript).toBe('سورة البقرة');
    expect(result.confidence).toBeGreaterThan(0.9);
    // @ts-ignore
    delete global.window.webkitSpeechRecognition;
  });
});
