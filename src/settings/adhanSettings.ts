import { storage } from '../core/storage';
import { DEFAULT_ADHAN_SOUND_ID } from '../audio/adhanSounds';

const KEY = 'adhan-settings:v1';

export interface AdhanSettings {
  soundId: string;
  permissionPrompted: boolean;
}

const defaults: AdhanSettings = {
  soundId: DEFAULT_ADHAN_SOUND_ID,
  permissionPrompted: false
};

export function getAdhanSettings(): AdhanSettings {
  return { ...defaults, ...(storage.get<AdhanSettings>(KEY) ?? {}) };
}

export function saveAdhanSettings(settings: AdhanSettings): void {
  storage.set(KEY, settings);
}
