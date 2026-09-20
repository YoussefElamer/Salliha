import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { Ayah } from '../core/types';
import { quranRepository } from '../quran/QuranRepository';
import { audioReducer, initialAudioState, type RepeatMode } from './audioPlayer';
import { ayahAudioUrl, getReciter } from './reciters';

interface AudioContextValue {
  state: typeof initialAudioState;
  reciterId: string;
  setReciterId: (id: string) => void;
  currentAyah: Ayah | null;
  playAyah: (ayah: Ayah) => void;
  playQueue: (queue: Ayah[], startIndex?: number) => void;
  playSurah: (surahId: number, startAyah?: number) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  setRepeatMode: (repeatMode: RepeatMode) => void;
  setRate: (rate: number) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children, defaultReciterId }: { children: ReactNode; defaultReciterId: string }) {
  const [state, dispatch] = useReducer(audioReducer, initialAudioState);
  const [reciterId, setReciterId] = usePersistedReciter(defaultReciterId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAyah = state.queue[state.currentIndex] ?? null;

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    const onEnded = () => dispatch({ type: 'NEXT' });
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentAyah) return;
    const source = ayahAudioUrl(reciterId, currentAyah.globalAyahNumber);
    if (audio.src !== source) audio.src = source;
    audio.playbackRate = state.playbackRate;
    if (state.isPlaying) {
      audio.play().catch(() => dispatch({ type: 'PAUSE' }));
    } else {
      audio.pause();
    }
  }, [currentAyah, reciterId, state.isPlaying, state.playbackRate]);

  const value = useMemo<AudioContextValue>(() => ({
    state,
    reciterId,
    setReciterId,
    currentAyah,
    playAyah: (ayah) => dispatch({ type: 'LOAD_QUEUE', queue: [ayah] }),
    playQueue: (queue, startIndex = 0) => dispatch({ type: 'LOAD_QUEUE', queue, startIndex }),
    playSurah: (surahId, startAyah = 1) => {
      const surah = quranRepository.getSurah(surahId);
      if (!surah) return;
      dispatch({ type: 'LOAD_QUEUE', queue: surah.verses, startIndex: Math.max(0, startAyah - 1) });
    },
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'PLAY' }),
    next: () => dispatch({ type: 'NEXT' }),
    previous: () => dispatch({ type: 'PREVIOUS' }),
    setRepeatMode: (repeatMode) => dispatch({ type: 'SET_REPEAT', repeatMode }),
    setRate: (playbackRate) => dispatch({ type: 'SET_RATE', playbackRate })
  }), [currentAyah, reciterId, setReciterId, state]);

  return (
    <AudioContext.Provider value={value}>
      {children}
      <MiniPlayer />
    </AudioContext.Provider>
  );
}

function usePersistedReciter(defaultReciterId: string): [string, (id: string) => void] {
  const [value, setValue] = useState(() => window.localStorage.getItem('salliha:reciter') ?? defaultReciterId);
  const update = (id: string) => {
    window.localStorage.setItem('salliha:reciter', id);
    setValue(id);
  };
  return [value, update];
}

export function useAudio(): AudioContextValue {
  const value = useContext(AudioContext);
  if (!value) throw new Error('useAudio must be used inside AudioProvider');
  return value;
}

function MiniPlayer() {
  const audio = useContext(AudioContext);
  if (!audio?.currentAyah) return null;
  const reciter = getReciter(audio.reciterId);
  return (
    <aside className="mini-player" aria-label="مشغل التلاوة المصغر">
      <div>
        <strong>{audio.currentAyah.surahName} — {audio.currentAyah.ayahNumber}</strong>
        <span>{reciter.name}</span>
      </div>
      <div className="inline-actions">
        <button className="icon-button" onClick={audio.previous} aria-label="السابق"><SkipForward size={18} /></button>
        <button className="primary-icon" onClick={audio.state.isPlaying ? audio.pause : audio.resume} aria-label={audio.state.isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}>
          {audio.state.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button className="icon-button" onClick={audio.next} aria-label="التالي"><SkipBack size={18} /></button>
      </div>
    </aside>
  );
}
