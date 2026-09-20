import type { Ayah, PlaybackMode, RepeatMode } from '../core/types';

export type { RepeatMode, PlaybackMode };

export interface AudioState {
  queue: Ayah[];
  currentIndex: number;
  isPlaying: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  mode: PlaybackMode;
  /** معرّف السورة المشغّلة حاليًا (لمتابعة التشغيل والحفظ). */
  surahId: number | null;
  range: { surahId: number; fromAyah: number; toAyah: number } | null;
}

export type AudioAction =
  | { type: 'LOAD_QUEUE'; queue: Ayah[]; startIndex?: number; mode?: PlaybackMode; range?: AudioState['range'] }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'JUMP'; index: number }
  | { type: 'SET_REPEAT'; repeatMode: RepeatMode }
  | { type: 'SET_RATE'; playbackRate: number }
  | { type: 'SET_MODE'; mode: PlaybackMode }
  | { type: 'SET_RANGE'; range: AudioState['range'] };

export const initialAudioState: AudioState = {
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  repeatMode: 'off',
  playbackRate: 1,
  mode: 'ayah',
  surahId: null,
  range: null
};

/** يحدد فهرس البداية داخل النطاق المكرر إن وُجد. */
function effectiveStart(state: AudioState, index: number): number {
  if (!state.range || state.mode === 'surah') return index;
  return index;
}

export function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'LOAD_QUEUE': {
      const queue = action.queue;
      const startIndex = Math.max(0, Math.min(action.startIndex ?? 0, Math.max(0, queue.length - 1)));
      return {
        ...state,
        queue,
        currentIndex: startIndex,
        isPlaying: queue.length > 0,
        mode: action.mode ?? state.mode,
        range: action.range ?? state.range,
        surahId: queue[startIndex]?.surahId ?? null
      };
    }
    case 'PLAY':
      return { ...state, isPlaying: true };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'JUMP':
      return { ...state, currentIndex: Math.max(0, Math.min(action.index, Math.max(0, state.queue.length - 1))), isPlaying: true, surahId: state.queue[action.index]?.surahId ?? state.surahId };
    case 'NEXT': {
      if (!state.queue.length) return state;
      if (state.repeatMode === 'ayah') return { ...state, isPlaying: true };
      const lastIndex = state.queue.length - 1;
      const rangeEnd = state.mode === 'ayah' && state.repeatMode === 'range' && state.range
        ? Math.max(0, Math.min(lastIndex, state.range.toAyah - 1))
        : lastIndex;
      const rangeStart = state.mode === 'ayah' && state.repeatMode === 'range' && state.range
        ? Math.max(0, Math.min(lastIndex, state.range.fromAyah - 1))
        : 0;
      const next = state.currentIndex + 1;
      if (next <= rangeEnd) return { ...state, currentIndex: effectiveStart(state, next), isPlaying: true, surahId: state.queue[next]?.surahId ?? state.surahId };
      if (state.repeatMode === 'surah' || state.repeatMode === 'range') {
        return { ...state, currentIndex: rangeStart, isPlaying: true, surahId: state.queue[rangeStart]?.surahId ?? state.surahId };
      }
      return { ...state, isPlaying: false };
    }
    case 'PREVIOUS': {
      if (!state.queue.length) return state;
      const rangeStart = state.mode === 'ayah' && state.repeatMode === 'range' && state.range
        ? Math.max(0, Math.min(state.queue.length - 1, state.range.fromAyah - 1))
        : 0;
      const previous = state.currentIndex - 1;
      const index = previous < rangeStart ? rangeStart : previous;
      return { ...state, currentIndex: index, isPlaying: true, surahId: state.queue[index]?.surahId ?? state.surahId };
    }
    case 'SET_REPEAT':
      return { ...state, repeatMode: action.repeatMode, range: action.repeatMode === 'range' ? state.range : state.range };
    case 'SET_RATE':
      return { ...state, playbackRate: Math.min(2, Math.max(0.5, action.playbackRate)) };
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_RANGE':
      return { ...state, range: action.range, repeatMode: action.range ? 'range' : state.repeatMode };
    default:
      return state;
  }
}

/** يبني قائمة تشغيل سورة كاملة بدءًا من آية معينة. */
export function surahQueue(queue: Ayah[], startAyahNumber = 1): { queue: Ayah[]; startIndex: number } {
  const startIndex = Math.max(0, queue.findIndex((ayah) => ayah.ayahNumber === startAyahNumber));
  return { queue, startIndex };
}
