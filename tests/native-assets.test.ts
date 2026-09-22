// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sounds from '../src/audio/adhan-sounds.json';
import { adhanSounds, getAdhanSoundForPrayer } from '../src/audio/adhanSounds';

const root = process.cwd();
const temporaryRoots: string[] = [];

function fixture(platform?: 'android' | 'ios', status = 200) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salliha-native-'));
  temporaryRoots.push(directory);
  fs.mkdirSync(path.join(directory, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'src/audio'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/prepare-native-adhan.mjs'), path.join(directory, 'scripts/prepare-native-adhan.mjs'));
  fs.copyFileSync(path.join(root, 'src/audio/adhan-sounds.json'), path.join(directory, 'src/audio/adhan-sounds.json'));
  if (platform) {
    const marker = path.join(directory, platform === 'android' ? 'android/app/src/main/AndroidManifest.xml' : 'ios/App/App/Info.plist');
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, 'fixture');
  }
  // Exercise the actual CLI, but keep tests deterministic and offline.
  fs.writeFileSync(path.join(directory, 'mock-fetch.mjs'), `
    import fs from 'node:fs';
    globalThis.fetch = async (url) => {
      fs.appendFileSync('requests.jsonl', JSON.stringify(url) + '\\n');
      return new Response('test audio', { status: ${status} });
    };
  `);
  return {
    directory,
    run: () => spawnSync(process.execPath, ['--import', './mock-fetch.mjs', 'scripts/prepare-native-adhan.mjs'], { cwd: directory, encoding: 'utf8' })
  };
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('Native asset preparation', () => {
  it('all build scripts parse as valid JavaScript', () => {
    for (const filename of fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'))) {
      expect(() => execFileSync(process.execPath, ['--check', path.join(root, 'scripts', filename)])).not.toThrow();
    }
  });

  it('shares valid resource filenames and URLs with the notification service', () => {
    const filenames = sounds.flatMap((sound) => [sound.normalFile, sound.fajrFile]);
    expect(new Set(filenames).size).toBe(filenames.length);
    for (const sound of sounds) {
      expect(sound.normalFile).toMatch(/^adhan_[a-z0-9_]+\.mp3$/);
      expect(sound.fajrFile).toMatch(/^adhan_[a-z0-9_]+\.mp3$/);
      expect(getAdhanSoundForPrayer(sound.id, 'الفجر')).toBe(sound.fajrFile);
      expect(getAdhanSoundForPrayer(sound.id, 'الظهر')).toBe(sound.normalFile);
      const preview = adhanSounds.find((item) => item.id === sound.id)!;
      expect(decodeURIComponent(new URL(preview.normalUrl).pathname)).toBe(`/Kiwifu/adhan-mp3/main/${sound.normal}`);
      expect(decodeURIComponent(new URL(preview.fajrUrl).pathname)).toBe(`/Kiwifu/adhan-mp3/main/${sound.fajr}`);
    }
  });

  it('does not create phantom platform folders when no project exists', () => {
    const { directory, run } = fixture();
    expect(run().status).toBe(0);
    for (const name of ['android', 'ios', 'requests.jsonl']) expect(fs.existsSync(path.join(directory, name))).toBe(false);
  });

  it.each(['android', 'ios'] as const)('prepares only %s and reuses complete cached downloads', (platform) => {
    const { directory, run } = fixture(platform);
    const output = path.join(directory, platform === 'android' ? 'android/app/src/main/res/raw' : 'ios/App/App/Resources');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, `adhan_${sounds[0].id}.mp3`), 'legacy');
    fs.writeFileSync(path.join(output, sounds[0].normalFile), '');
    const result = run();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(fs.readdirSync(output).sort()).toEqual(sounds.flatMap((sound) => [sound.normalFile, sound.fajrFile]).sort());
    for (const filename of fs.readdirSync(output)) expect(fs.readFileSync(path.join(output, filename), 'utf8')).toBe('test audio');
    expect(fs.existsSync(path.join(directory, platform === 'android' ? 'ios' : 'android'))).toBe(false);
    const requests = fs.readFileSync(path.join(directory, 'requests.jsonl'), 'utf8');
    expect(requests.trim().split('\n')).toHaveLength(sounds.length * 2);
    expect(run().status).toBe(0);
    expect(fs.readFileSync(path.join(directory, 'requests.jsonl'), 'utf8')).toBe(requests);
  });

  it('fails clearly on a missing upstream file without caching or retrying a 404', () => {
    const { directory, run } = fixture('android', 404);
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('HTTP 404');
    expect(fs.existsSync(path.join(directory, 'android/app/src/main/res/raw'))).toBe(false);
    expect(fs.readFileSync(path.join(directory, 'requests.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
});
