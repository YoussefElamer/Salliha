import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PrayerName } from '../core/types';
import { adhanSounds, getAdhanPreviewUrl, getAdhanSound, type AdhanSound } from './adhanSounds';
import { getAdhanSettings } from '../settings/adhanSettings';
import { formatPlaybackTime } from '../core/arabic';
import { Volume2, VolumeX, Square, BellRing } from 'lucide-react';

export interface AdhanPlayerState {
  isPlaying: boolean;
  soundId: string | null;
  prayerName: PrayerName | string | null;
  sound: AdhanSound | null;
  currentTime: number;
  duration: number;
  progress: number;
  isPreview: boolean;
  error: string | null;
}

export interface AdhanContextValue extends AdhanPlayerState {
  playAdhan: (soundId?: string, prayerName?: PrayerName | string, isPreview?: boolean) => void;
  stopAdhan: () => void;
  toggleAdhan: (soundId: string, prayerName?: PrayerName | string) => void;
}

const AdhanContext = createContext<AdhanContextValue | null>(null);

export function AdhanProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundId, setSoundId] = useState<string | null>(null);
  const [prayerName, setPrayerName] = useState<PrayerName | string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // إنشاء عنصر صوتي ثابت وحيد يبقى طوال دورة حياة التطبيق ولا يتأثر بالتنقل بين الصفحات
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }

  const stopAdhan = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setSoundId(null);
    setPrayerName(null);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, []);

  const playAdhan = useCallback(
    (targetSoundId?: string, targetPrayerName?: PrayerName | string, asPreview = true) => {
      const audio = audioRef.current;
      if (!audio) return;

      const activeSoundId = targetSoundId || getAdhanSettings().soundId;
      const activePrayerName = targetPrayerName || 'الظهر';
      const soundObj = getAdhanSound(activeSoundId);
      const url = getAdhanPreviewUrl(activeSoundId, activePrayerName);

      // إيقاف تشغيل تلاوة القرآن إن كانت تعمل لتجنب تداخل الأصوات
      window.dispatchEvent(new CustomEvent('salliha:stop-quran'));

      setError(null);
      setSoundId(activeSoundId);
      setPrayerName(activePrayerName);
      setIsPreview(asPreview);
      setCurrentTime(0);
      setDuration(0);

      if (audio.src !== url) {
        audio.src = url;
      }
      audio.currentTime = 0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            // إعداد MediaSession للتحكم من شريط الإشعارات وقفل الشاشة
            if ('mediaSession' in navigator) {
              try {
                navigator.mediaSession.metadata = new MediaMetadata({
                  title: asPreview ? `تجربة أذان ${activePrayerName}` : `حان الآن أذان ${activePrayerName}`,
                  artist: soundObj.name,
                  album: 'صليها — Salliha',
                  artwork: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
                  ]
                });
                navigator.mediaSession.playbackState = 'playing';
                navigator.mediaSession.setActionHandler('pause', () => stopAdhan());
                navigator.mediaSession.setActionHandler('stop', () => stopAdhan());
              } catch {
                // تجاهل أي نقص في دعم بعض المتصفحات
              }
            }
          })
          .catch((err) => {
            setIsPlaying(false);
            setError('تعذر تشغيل ملف الأذان. تحقق من الاتصال بالإنترنت.');
            console.error('Adhan play error:', err);
          });
      }
    },
    [stopAdhan]
  );

  const toggleAdhan = useCallback(
    (targetSoundId: string, targetPrayerName?: PrayerName | string) => {
      if (isPlaying && soundId === targetSoundId && (!targetPrayerName || prayerName === targetPrayerName)) {
        stopAdhan();
      } else {
        playAdhan(targetSoundId, targetPrayerName, true);
      }
    },
    [isPlaying, soundId, prayerName, playAdhan, stopAdhan]
  );

  // الاستماع لأحداث عنصر الصوت
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => stopAdhan();
    const onError = () => {
      setIsPlaying(false);
      setError('تعذر تحميل صوت الأذان.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [stopAdhan]);

  // الاستماع لإشارة إيقاف الأذان (مثل عند بدء تلاوة القرآن)
  useEffect(() => {
    const handleStop = () => stopAdhan();
    window.addEventListener('salliha:stop-adhan', handleStop);
    return () => window.removeEventListener('salliha:stop-adhan', handleStop);
  }, [stopAdhan]);

  const sound = useMemo(() => (soundId ? getAdhanSound(soundId) : null), [soundId]);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const value = useMemo<AdhanContextValue>(
    () => ({
      isPlaying,
      soundId,
      prayerName,
      sound,
      currentTime,
      duration,
      progress,
      isPreview,
      error,
      playAdhan,
      stopAdhan,
      toggleAdhan
    }),
    [isPlaying, soundId, prayerName, sound, currentTime, duration, progress, isPreview, error, playAdhan, stopAdhan, toggleAdhan]
  );

  return (
    <AdhanContext.Provider value={value}>
      {children}
      <AdhanFloatingBar />
    </AdhanContext.Provider>
  );
}

export function useAdhan(): AdhanContextValue {
  const context = useContext(AdhanContext);
  if (!context) {
    throw new Error('useAdhan must be used within an AdhanProvider');
  }
  return context;
}

/**
 * شريط الأذان العائم المدمج:
 * يظهر فور بدء تشغيل الأذان (سواء تجربة أو عند دخول وقت الصلاة)
 * ويستمر بالعمل والعرض مهما تنقل المستخدم بين شاشات التطبيق دون انقطاع.
 */
function AdhanFloatingBar() {
  const { isPlaying, sound, prayerName, isPreview, currentTime, duration, progress, stopAdhan, error } = useAdhan();

  if (!isPlaying && !error) return null;

  return (
    <aside className="adhan-floating-bar" aria-label="مشغل الأذان">
      <div className="adhan-floating-progress">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="adhan-floating-content">
        <div className="adhan-floating-icon" aria-hidden="true">
          <BellRing className="pulse-icon" size={20} />
        </div>
        <div className="adhan-floating-info">
          <strong>
            {isPreview ? 'تجربة صوت الأذان' : `حان الآن وقت أذان ${prayerName || 'الصلاة'}`}
          </strong>
          <small>
            {sound ? sound.name : 'أذان الصلاة'}
            {duration > 0 && ` (${formatPlaybackTime(currentTime)} / ${formatPlaybackTime(duration)})`}
          </small>
          {error && <span className="adhan-floating-error">{error}</span>}
        </div>
        <div className="adhan-floating-actions">
          <button className="adhan-stop-button" onClick={stopAdhan} aria-label="إيقاف الأذان">
            <Square size={16} />
            <span>إيقاف</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
