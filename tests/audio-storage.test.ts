import { describe, expect, it, beforeEach } from 'vitest';
import { audioReducer, initialAudioState } from '../src/audio/audioPlayer';
import { LocalStorageStore } from '../src/core/storage';
import { quranRepository } from '../src/quran/QuranRepository';

describe('Audio player reducer', () => {
  const verses = quranRepository.getSurah(1)!.verses;

  it('plays, pauses, advances and repeats', () => {
    let state = audioReducer(initialAudioState, { type: 'LOAD_QUEUE', queue: verses, startIndex: 0 });
    expect(state.isPlaying).toBe(true);
    state = audioReducer(state, { type: 'PAUSE' });
    expect(state.isPlaying).toBe(false);
    state = audioReducer(state, { type: 'PLAY' });
    state = audioReducer(state, { type: 'NEXT' });
    expect(state.currentIndex).toBe(1);
    state = audioReducer(state, { type: 'SET_REPEAT', repeatMode: 'ayah' });
    state = audioReducer(state, { type: 'NEXT' });
    expect(state.currentIndex).toBe(1);
  });

  it('clamps playback rate', () => {
    expect(audioReducer(initialAudioState, { type: 'SET_RATE', playbackRate: 10 }).playbackRate).toBe(2);
    expect(audioReducer(initialAudioState, { type: 'SET_RATE', playbackRate: 0.1 }).playbackRate).toBe(0.5);
  });
});

describe('Local storage repositories', () => {
  beforeEach(() => localStorage.clear());

  it('stores JSON with a namespace', () => {
    const store = new LocalStorageStore('test');
    store.set('settings', { theme: 'dark' });
    expect(store.get('settings', { theme: 'light' })).toEqual({ theme: 'dark' });
    store.remove('settings');
    expect(store.get('settings', { theme: 'light' })).toEqual({ theme: 'light' });
  });
});
