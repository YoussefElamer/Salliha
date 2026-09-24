import { storage } from '../core/storage';
import { DEFAULT_ADHAN_SOUND_ID } from '../audio/adhanSounds';

const KEY = 'adhan-settings:v1';

export interface AdhanSettings {
  soundId: string;
  permissionPrompted: boolean;
  customFileName: string;
  customUri: string;
}

const defaults: AdhanSettings = {
  soundId: DEFAULT_ADHAN_SOUND_ID,
  permissionPrompted: false,
  customFileName: '',
  customUri: ''
};

export function getAdhanSettings(): AdhanSettings {
  return { ...defaults, ...(storage.get<AdhanSettings>(KEY, defaults) ?? {}) };
}

export function saveAdhanSettings(settings: AdhanSettings): void {
  storage.set(KEY, settings);
}
