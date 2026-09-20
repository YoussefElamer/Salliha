/**
 * Voice Search — يحوّل الكلام إلى نص ثم يمرره لنفس محرك البحث القرآني.
 * يستخدم Web Speech API إن وُجد، وإلا يعود للبحث النصي.
 */

export interface VoiceSearchOptions {
  lang?: string; // 'ar-SA' default
  maxAlternatives?: number;
}

export interface VoiceSearchResult {
  transcript: string;
  confidence: number;
}

export function isVoiceSearchSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition || (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition);
}

export function voiceSearchOnce(options: VoiceSearchOptions = {}): Promise<VoiceSearchResult> {
  const lang = options.lang ?? 'ar-SA';
  return new Promise((resolve, reject) => {
    const SpeechRecognitionCtor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance; SpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition
      || (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition;
    if (!SpeechRecognitionCtor) {
      reject(new Error('البحث الصوتي غير مدعوم في هذا المتصفح. استخدم البحث النصي.'));
      return;
    }
    const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = options.maxAlternatives ?? 1;
    recognition.continuous = false;

    const timeout = setTimeout(() => {
      try { recognition.stop(); } catch { /* ignore */ }
      reject(new Error('انتهت مهلة الاستماع. حاول مرة أخرى.'));
    }, 8000);

    recognition.onresult = (event: { results: Array<Array<{ transcript: string; confidence: number }>> }) => {
      clearTimeout(timeout);
      const first = event.results[0]?.[0];
      if (!first?.transcript) {
        reject(new Error('لم يتم التعرف على الكلام.'));
        return;
      }
      resolve({ transcript: first.transcript, confidence: first.confidence ?? 0.9 });
    };
    recognition.onerror = (event: { error: string }) => {
      clearTimeout(timeout);
      reject(new Error(`خطأ في التعرف الصوتي: ${event.error}`));
    };
    recognition.onend = () => { clearTimeout(timeout); };
    try {
      recognition.start();
    } catch (e) {
      clearTimeout(timeout);
      reject(e instanceof Error ? e : new Error('تعذر بدء البحث الصوتي.'));
    }
  });
}

// Minimal typing for SpeechRecognition
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: Array<Array<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
