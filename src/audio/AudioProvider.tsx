import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Ayah, PlaybackMode, PlaybackSnapshot, Reciter, RepeatMode, Surah } from '../core/types';
import { quranRepository } from '../quran/QuranRepository';
import { settingsRepository } from '../settings/settingsRepository';
import { audioReducer, initialAudioState, type AudioState } from './audioPlayer';
import { ayahAudioUrl, getReciter, surahAudioUrl } from './reciters';
import { downloadRepository } from '../downloads/DownloadRepository';
import { MiniPlayer } from './MiniPlayer';
import { PlayerSheet } from './PlayerSheet';

export interface AudioContextValue {
  state: AudioState;
  reciterId: string;
  reciter: Reciter;
  currentAyah: Ayah | null;
  currentSurah: Surah | null;
  queue: Ayah[];
  position: number;
  duration: number;
  buffered: number;
  isLoading: boolean;
  error: string | null;
  playerOpen: boolean;
  sleepRemainingSeconds: number | null;
  bitrate: number;
  setReciterId: (id: string) => void;
  setBitrate: (bitrate: number) => void;
  playAyah: (ayah: Ayah, options?: { single?: boolean }) => void;
  playQueue: (queue: Ayah[], startIndex?: number) => void;
  playSurah: (surahId: number, startAyah?: number, options?: { preferSurahFile?: boolean }) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  setRepeatMode: (repeatMode: RepeatMode) => void;
  setRate: (rate: number) => void;
  setMode: (mode: PlaybackMode) => void;
  setRange: (range: AudioState['range']) => void;
  setSleepTimer: (minutes: number | null) => void;
  openPlayer: () => void;
  closePlayer: () => void;
  /** آخر موضع استماع محفوظ لاستئناف التشغيل. */
  lastSnapshot: PlaybackSnapshot | null;
  resumeFromSnapshot: () => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);
const SNAPSHOT_KEY = 'playback-snapshot:v1';

function readSnapshot(): PlaybackSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`salliha:${SNAPSHOT_KEY}`);
    return raw ? (JSON.parse(raw) as PlaybackSnapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: PlaybackSnapshot): void {
  try {
    window.localStorage.setItem(`salliha:${SNAPSHOT_KEY}`, JSON.stringify(snapshot));
  } catch {
    // تجاهل امتلاء مساحة التخزين.
  }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const initialSettings = useMemo(() => settingsRepository.getSettings(), []);
  const [state, dispatch] = useReducer(audioReducer, {
    ...initialAudioState,
    repeatMode: initialSettings.playback.repeatMode,
    playbackRate: initialSettings.playback.playbackRate,
    mode: initialSettings.playback.mode,
    range: initialSettings.playback.range
  });
  const [reciterId, setReciterIdState] = useState(() => window.localStorage.getItem('salliha:reciter') ?? initialSettings.playback.reciterId ?? initialSettings.defaultReciterId);
  const [bitrate, setBitrateState] = useState(initialSettings.playback.bitrate);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [sleepDeadline, setSleepDeadline] = useState<number | null>(null);
  const [sleepRemainingSeconds, setSleepRemaining] = useState<number | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<PlaybackSnapshot | null>(() => readSnapshot());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousBlobUrlRef = useRef<string | null>(null);
  /** يحمي من رفض وعود `play()` القديمة عند تغيير المصدر بسرعة (AbortError). */
  const playTokenRef = useRef(0);
  const reciter = useMemo(() => getReciter(reciterId), [reciterId]);
  const currentAyah = state.queue[state.currentIndex] ?? null;
  const currentSurah = currentAyah ? quranRepository.getSurah(currentAyah.surahId) ?? null : null;
  const stateRef = useRef(state);
  stateRef.current = state;

  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const persistSettings = useCallback((patch: Partial<ReturnType<typeof settingsRepository.getSettings>['playback']>) => {
    settingsRepository.updateSettings((current) => ({
      ...current,
      playback: { ...current.playback, ...patch },
      defaultReciterId: patch.reciterId ?? current.defaultReciterId
    }));
  }, []);

  const setReciterId = useCallback(
    (id: string) => {
      window.localStorage.setItem('salliha:reciter', id);
      setReciterIdState(id);
      persistSettings({ reciterId: id });
      const reciterInfo = getReciter(id);
      if (stateRef.current.mode === 'surah' && !reciterInfo.surahAudio) {
        dispatch({ type: 'SET_MODE', mode: 'ayah' });
      }
    },
    [persistSettings]
  );

  const setBitrate = useCallback(
    (value: number) => {
      setBitrateState(value);
      persistSettings({ bitrate: value });
    },
    [persistSettings]
  );

  /** عنوان التشغيل الحالي: ملف سورة كاملة أو تلاوة آية. */
  const currentSource = useMemo(() => {
    if (!currentAyah) return null;
    const canUseSurahFile = state.mode === 'surah' && reciter.surahAudio;
    if (canUseSurahFile) {
      return { url: surahAudioUrl(reciterId, currentAyah.surahId, bitrate), isSurahFile: true };
    }
    return { url: ayahAudioUrl(reciterId, currentAyah.globalAyahNumber, bitrate), isSurahFile: false };
  }, [bitrate, currentAyah, reciter.surahAudio, reciterId, state.mode]);

  // تحميل المصدر وتشغيله — مع تفضيل النسخة المحفوظة على الجهاز إن وُجدت.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSource) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    const load = async () => {
      const cachedUrl = await downloadRepository.cachedObjectUrl(currentSource.url);
      if (cancelled) {
        if (cachedUrl) URL.revokeObjectURL(cachedUrl);
        return;
      }
      const target = cachedUrl ?? currentSource.url;
      const previous = previousBlobUrlRef.current;
      if (audio.src !== target) {
        audio.src = target;
        audio.currentTime = 0;
        setPosition(0);
        setDuration(0);
      }
      if (previous && previous !== target) URL.revokeObjectURL(previous);
      previousBlobUrlRef.current = cachedUrl;
      audio.playbackRate = state.playbackRate;
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentSource, state.playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentAyah) {
      audio.pause();
      return;
    }
    if (state.isPlaying) {
      const token = ++playTokenRef.current;
      audio.play().catch((error: unknown) => {
        // تأخر هذا الوعد عن وقته (تغير المصدر/إيقاف أثناء البدء) — لا نعاقب التشغيل الحالي.
        if (playTokenRef.current !== token) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setError('تعذر بدء التشغيل. تحقق من الاتصال بالإنترنت.');
        dispatch({ type: 'PAUSE' });
      });
    } else {
      playTokenRef.current += 1;
      audio.pause();
    }
  }, [currentAyah, state.isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = state.playbackRate;
  }, [state.playbackRate]);

  // أحداث عنصر الصوت
  const playSurahInternal = useCallback(
    (surahId: number, startAyah = 1, options: { preferSurahFile?: boolean } = {}) => {
      const preferSurahFile = options.preferSurahFile ?? true;
      const surah = quranRepository.getSurah(surahId);
      if (!surah) return;
      const canUseSurahFile = preferSurahFile && reciter.surahAudio;
      dispatch({
        type: 'LOAD_QUEUE',
        queue: surah.verses,
        startIndex: Math.max(0, startAyah - 1),
        mode: canUseSurahFile ? 'surah' : 'ayah'
      });
    },
    [reciter.surahAudio]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setPosition(audio.currentTime);
      if (audio.buffered.length) setBuffered(audio.buffered.end(audio.buffered.length - 1));
      // شريط التقدم داخل إشعار النظام (مثل مشغلات الأغاني) يحتاج حالة الموضع.
      const mediaSession = navigator.mediaSession;
      if (mediaSession?.setPositionState && Number.isFinite(audio.duration) && audio.duration > 0) {
        try {
          mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) });
        } catch {
          // بعض المتصفحات ترفض المواضع غير الصحيحة — نتجاهل بهدوء.
        }
      }
    };
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      // فشل ملف السورة الكاملة؟ نرجع تلقائيًا لوضع «آية بآية» بنفس الموضع.
      if (stateRef.current.mode === 'surah' && reciter.surahAudio) {
        dispatch({ type: 'SET_MODE', mode: 'ayah' });
        setError('تعذر تشغيل ملف السورة كاملًا — تم التحويل إلى وضع «آية بآية».');
        return;
      }
      setError('تعذر تحميل التلاوة. تأكد من الاتصال بالإنترنت أو جرّب قارئًا آخر.');
      dispatch({ type: 'PAUSE' });
    };
    const onEnded = () => {
      const current = stateRef.current;
      // تكرار الآية: نعيد نفس الآية من بدايتها بدل الوقوف الصامت.
      if (current.repeatMode === 'ayah') {
        audio.currentTime = 0;
        void audio.play().catch(() => dispatch({ type: 'PAUSE' }));
        return;
      }
      if (current.mode === 'surah') {
        const settings = settingsRepository.getSettings();
        if (current.repeatMode === 'surah') {
          audio.currentTime = 0;
          void audio.play();
          return;
        }
        if (settings.playback.autoPlayNextSurah && currentAyah) {
          const nextSurahId = currentAyah.surahId + 1;
          if (nextSurahId <= quranRepository.getSurahs().length) {
            playSurahInternal(nextSurahId, 1, { preferSurahFile: true });
            return;
          }
        }
        dispatch({ type: 'PAUSE' });
        return;
      }
      // وضع «آية بآية»: عند نهاية طابور سورة كاملة نكمل تلقائيًا للسورة التي بعدها.
      const atQueueEnd = current.currentIndex >= current.queue.length - 1;
      if (atQueueEnd && current.repeatMode === 'off') {
        const settings = settingsRepository.getSettings();
        const last = current.queue[current.queue.length - 1];
        const first = current.queue[0];
        const fullSurahQueue =
          Boolean(last && first) &&
          last.surahId === first.surahId &&
          current.queue.length === (quranRepository.getSurah(last.surahId)?.ayahCount ?? -1);
        if (settings.playback.autoPlayNextSurah && fullSurahQueue && last.surahId < quranRepository.getSurahs().length) {
          playSurahInternal(last.surahId + 1, 1);
          return;
        }
      }
      dispatch({ type: 'NEXT' });
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentAyah, playSurahInternal, reciter.surahAudio]);


  const value = useMemo<AudioContextValue>(
    () => ({
      state,
      reciterId,
      reciter,
      currentAyah,
      currentSurah,
      queue: state.queue,
      position,
      duration,
      buffered,
      isLoading,
      error,
      playerOpen,
      sleepRemainingSeconds,
      bitrate,
      setReciterId,
      setBitrate,
      playAyah: (ayah, options) => {
        if (options?.single) {
          dispatch({ type: 'LOAD_QUEUE', queue: [ayah], mode: 'ayah' });
          return;
        }
        // تشغيل الآية داخل سياق سورتها حتى يستمر التشغيل للآيات التالية.
        const surah = quranRepository.getSurah(ayah.surahId);
        if (!surah) return dispatch({ type: 'LOAD_QUEUE', queue: [ayah], mode: 'ayah' });
        const startIndex = Math.max(0, surah.verses.findIndex((item) => item.ayahNumber === ayah.ayahNumber));
        dispatch({ type: 'LOAD_QUEUE', queue: surah.verses, startIndex, mode: 'ayah', range: null });
      },
      playQueue: (queue, startIndex = 0) => dispatch({ type: 'LOAD_QUEUE', queue, startIndex, mode: 'ayah' }),
      playSurah: (surahId, startAyah = 1, options) => playSurahInternal(surahId, startAyah, options),
      toggle: () => dispatch({ type: state.isPlaying ? 'PAUSE' : 'PLAY' }),
      pause: () => dispatch({ type: 'PAUSE' }),
      resume: () => dispatch({ type: 'PLAY' }),
      next: () => {
        if (stateRef.current.repeatMode === 'ayah') {
          const audio = audioRef.current;
          if (audio) {
            audio.currentTime = 0;
            void audio.play().catch(() => dispatch({ type: 'PAUSE' }));
          }
          return;
        }
        if (state.mode === 'surah' && currentAyah) {
          const settings = settingsRepository.getSettings();
          const nextSurahId = currentAyah.surahId + 1;
          if (settings.playback.autoPlayNextSurah && nextSurahId <= quranRepository.getSurahs().length) {
            playSurahInternal(nextSurahId, 1);
            return;
          }
        }
        dispatch({ type: 'NEXT' });
      },
      previous: () => {
        if (state.mode === 'surah' && currentAyah && currentAyah.surahId > 1) {
          playSurahInternal(currentAyah.surahId - 1, 1);
          return;
        }
        dispatch({ type: 'PREVIOUS' });
      },
      jumpTo: (index) => dispatch({ type: 'JUMP', index }),
      seek: (seconds) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(seconds)) return;
        audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
        setPosition(audio.currentTime);
      },
      skip: (deltaSeconds) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, Math.min(audio.currentTime + deltaSeconds, audio.duration || audio.currentTime + deltaSeconds));
        setPosition(audio.currentTime);
      },
      setRepeatMode: (repeatMode) => {
        dispatch({ type: 'SET_REPEAT', repeatMode });
        persistSettings({ repeatMode });
      },
      setRate: (rate) => {
        dispatch({ type: 'SET_RATE', playbackRate: rate });
        persistSettings({ playbackRate: rate });
      },
      setMode: (mode) => {
        dispatch({ type: 'SET_MODE', mode });
        persistSettings({ mode });
        if (mode === 'surah' && currentAyah) playSurahInternal(currentAyah.surahId, currentAyah.ayahNumber, { preferSurahFile: true });
      },
      setRange: (range) => {
        dispatch({ type: 'SET_RANGE', range });
        persistSettings({ range });
      },
      setSleepTimer: (minutes) => {
        if (minutes === null) {
          setSleepDeadline(null);
          setSleepRemaining(null);
          persistSettings({ sleepTimerMinutes: null });
          return;
        }
        setSleepDeadline(Date.now() + minutes * 60_000);
        setSleepRemaining(minutes * 60);
        persistSettings({ sleepTimerMinutes: minutes });
      },
      openPlayer: () => setPlayerOpen(true),
      closePlayer: () => setPlayerOpen(false),
      lastSnapshot,
      resumeFromSnapshot: () => {
        if (!lastSnapshot) return;
        playSurahInternal(lastSnapshot.surahId, lastSnapshot.ayahNumber, { preferSurahFile: lastSnapshot.mode === 'surah' });
        if (lastSnapshot.reciterId !== reciterId) setReciterId(lastSnapshot.reciterId);
      }
    }),
    [
      bitrate,
      buffered,
      currentAyah,
      currentSurah,
      duration,
      error,
      isLoading,
      lastSnapshot,
      persistSettings,
      playSurahInternal,
      playerOpen,
      position,
      state.queue.length,
      reciter,
      reciterId,
      setBitrate,
      setReciterId,
      sleepRemainingSeconds,
      state
    ]
  );

  // مؤقت النوم
  useEffect(() => {
    if (sleepDeadline === null) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.round((sleepDeadline - Date.now()) / 1000));
      setSleepRemaining(remaining);
      if (remaining <= 0) {
        dispatch({ type: 'PAUSE' });
        setSleepDeadline(null);
        setSleepRemaining(null);
        persistSettings({ sleepTimerMinutes: null });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [persistSettings, sleepDeadline]);

  // Media Session: أزرار شاشة القفل/الإشعارات
  useEffect(() => {
    const mediaSession = navigator.mediaSession;
    if (!mediaSession || !currentAyah) return;
    try {
      mediaSession.metadata = new MediaMetadata({
        title: `${currentAyah.surahName} — الآية ${currentAyah.ayahNumber}`,
        artist: reciter.name,
        album: 'صليها — Salliha',
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });
      mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
      mediaSession.setActionHandler('play', () => dispatch({ type: 'PLAY' }));
      mediaSession.setActionHandler('pause', () => dispatch({ type: 'PAUSE' }));
      mediaSession.setActionHandler('nexttrack', () => dispatch({ type: 'NEXT' }));
      mediaSession.setActionHandler('previoustrack', () => dispatch({ type: 'PREVIOUS' }));
      mediaSession.setActionHandler('seekbackward', () => { const audio = audioRef.current; if (audio) audio.currentTime = Math.max(0, audio.currentTime - 10); });
      mediaSession.setActionHandler('seekforward', () => { const audio = audioRef.current; if (audio) audio.currentTime += 10; });
    } catch {
      // بعض المتصفحات لا تدعم كل الإجراءات — نتجاهل بهدوء.
    }
  }, [currentAyah, reciter.name, state.isPlaying]);

  // حفظ آخر موضع استماع
  useEffect(() => {
    if (!currentAyah) return;
    const timeout = window.setTimeout(() => {
      const snapshot: PlaybackSnapshot = {
        reciterId,
        mode: state.mode,
        bitrate,
        surahId: currentAyah.surahId,
        ayahNumber: currentAyah.ayahNumber,
        positionSeconds: Math.round(position),
        updatedAt: new Date().toISOString()
      };
      writeSnapshot(snapshot);
      setLastSnapshot(snapshot);
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [bitrate, currentAyah, position, reciterId, state.mode]);

  return (
    <AudioContext.Provider value={value}>
      {children}
      <MiniPlayer />
      <PlayerSheet />
    </AudioContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useAudio must be used inside AudioProvider');
  return value;
}
