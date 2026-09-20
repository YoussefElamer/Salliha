import type { Ayah } from '../core/types';

export type RepeatMode = 'off' | 'ayah' | 'range' | 'surah';

export interface AudioState {
  queue: Ayah[];
  currentIndex: number;
  isPlaying: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
}

export type AudioAction =
  | { type: 'LOAD_QUEUE'; queue: Ayah[]; startIndex?: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'NEXT' }
  | { type: 'PREVIOUS' }
  | { type: 'SET_REPEAT'; repeatMode: RepeatMode }
  | { type: 'SET_RATE'; playbackRate: number };

export const initialAudioState: AudioState = {
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  repeatMode: 'off',
  playbackRate: 1
};

export function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'LOAD_QUEUE':
      return { ...state, queue: action.queue, currentIndex: Math.min(action.startIndex ?? 0, Math.max(0, action.queue.length - 1)), isPlaying: true };
    case 'PLAY':
      return { ...state, isPlaying: true };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'NEXT': {
      if (!state.queue.length) return state;
      if (state.repeatMode === 'ayah') return { ...state, isPlaying: true };
      const next = state.currentIndex + 1;
      if (next < state.queue.length) return { ...state, currentIndex: next, isPlaying: true };
      return state.repeatMode === 'surah' || state.repeatMode === 'range' ? { ...state, currentIndex: 0, isPlaying: true } : { ...state, isPlaying: false };
    }
    case 'PREVIOUS':
      return { ...state, currentIndex: Math.max(0, state.currentIndex - 1), isPlaying: true };
    case 'SET_REPEAT':
      return { ...state, repeatMode: action.repeatMode };
    case 'SET_RATE':
      return { ...state, playbackRate: Math.min(2, Math.max(0.5, action.playbackRate)) };
    default:
      return state;
  }
}
