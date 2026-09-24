import { registerPlugin } from '@capacitor/core';
import { getAdhanSettings, saveAdhanSettings } from '../settings/adhanSettings';

interface CustomAdhanSoundPlugin {
  save(options: { name: string; base64: string; mimeType: string }): Promise<{ uri: string }>;
  get(): Promise<{ uri: string; name: string }>;
  remove(): Promise<void>;
}

const CustomAdhanSound = registerPlugin<CustomAdhanSoundPlugin>('CustomAdhanSound');

export async function saveCustomAdhanFile(file: File): Promise<string> {
  if (!file.type.startsWith('audio/')) throw new Error('اختر ملفًا صوتيًا فقط.');
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  const base64 = btoa(binary);
  const result = await CustomAdhanSound.save({ name: file.name, base64, mimeType: file.type || 'audio/mpeg' });
  saveAdhanSettings({ ...getAdhanSettings(), customFileName: file.name, customUri: result.uri });
  return result.uri;
}

export async function getCustomAdhan(): Promise<{ uri: string; name: string } | null> {
  try {
    const result = await CustomAdhanSound.get();
    return result?.uri ? result : null;
  } catch {
    return null;
  }
}

export async function removeCustomAdhan(): Promise<void> {
  await CustomAdhanSound.remove().catch(() => {});
  const settings = getAdhanSettings();
  saveAdhanSettings({ ...settings, customFileName: '', customUri: '' });
}

export function isCustomAdhanSupported(): boolean {
  try { return Boolean(window.Capacitor?.isNativePlatform?.()); } catch { return false; }
}

export { CustomAdhanSound };
