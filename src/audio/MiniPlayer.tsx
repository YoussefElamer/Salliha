import { ChevronUp, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { useAudio } from './AudioProvider';
import { formatPlaybackTime } from '../core/arabic';

/** مشغل مصغّر ثابت فوق شريط التنقل — يعرض التقدم ويتيح التحكم السريع بدون فتح المشغل. */
export function MiniPlayer() {
  const audio = useAudio();
  if (!audio.currentAyah) return null;
  const isSurahMode = audio.state.mode === 'surah' && audio.reciter.surahAudio;
  const progress = audio.duration > 0 ? Math.min(100, (audio.position / audio.duration) * 100) : 0;

  return (
    <aside className="mini-player" aria-label="مشغل التلاوة المصغّر">
      <div className="mini-player-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="mini-player-body">
        <button className="mini-player-info" onClick={audio.openPlayer} aria-label="فتح المشغل">
          <strong>{audio.currentAyah.surahName}{isSurahMode ? ' — السورة كاملة' : ` — الآية ${audio.currentAyah.ayahNumber}`}</strong>
          <small>{audio.reciter.name}{audio.isLoading ? ' · جارٍ التحميل…' : ''}</small>
        </button>
        <div className="mini-player-times" dir="ltr">
          <span>{formatPlaybackTime(audio.position)}</span>
          <span className="muted">/</span>
          <span>{formatPlaybackTime(audio.duration)}</span>
        </div>
        <div className="mini-player-actions">
          <button className="icon-button small" onClick={audio.previous} aria-label="السابق">
            <SkipForward size={16} />
          </button>
          <button className="primary-icon small" onClick={audio.toggle} aria-label={audio.state.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
            {audio.state.isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="icon-button small" onClick={audio.next} aria-label="التالي">
            <SkipBack size={16} />
          </button>
          <button className="icon-button small" onClick={audio.openPlayer} aria-label="تكبير المشغل">
            <ChevronUp size={16} />
          </button>
          <button className="icon-button small" onClick={audio.pause} aria-label="إغلاق المشغل وإيقافه">
            <X size={16} />
          </button>
        </div>
      </div>
      {audio.error && <p className="error-note mini-player-error">{audio.error}</p>}
    </aside>
  );
}
