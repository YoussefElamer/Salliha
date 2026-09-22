import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = 'https://raw.githubusercontent.com/Kiwifu/adhan-mp3/main/';
// Keep preview URLs, notification filenames and bundled assets in sync.
const sounds = JSON.parse(fs.readFileSync(path.join(root, 'src/audio/adhan-sounds.json'), 'utf8'));

async function download(url, destination) {
  if (fs.existsSync(destination) && fs.statSync(destination).size > 0) return;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let buffer;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        const error = new Error(`Failed to download ${url}: HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new Error(`Empty audio download: ${url}`);
    } catch (error) {
      if (error.retryable === false || attempt === 3) throw error;
      console.warn(`Audio download attempt ${attempt} failed; retrying: ${error.message}`);
      await delay(attempt * 1000);
      continue;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    // Never leave a partial file that a later run would treat as cached audio.
    fs.writeFileSync(`${destination}.tmp`, buffer);
    fs.renameSync(`${destination}.tmp`, destination);
    return;
  }
}

async function main() {
  const destinations = [];
  if (fs.existsSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'))) {
    destinations.push(path.join(root, 'android/app/src/main/res/raw'));
  }
  if (fs.existsSync(path.join(root, 'ios/App/App/Info.plist'))) {
    destinations.push(path.join(root, 'ios/App/App/Resources'));
  }
  if (!destinations.length) {
    console.log('No native projects found; generate a Capacitor platform before preparing Adhan audio.');
    return;
  }
  for (const sound of sounds) {
    for (const [source, filename] of [[sound.normal, sound.normalFile], [sound.fajr, sound.fajrFile]]) {
      if (!/^adhan_[a-z0-9_]+\.mp3$/.test(filename)) {
        throw new Error(`Invalid Android audio resource filename: ${filename}`);
      }
      for (const directory of destinations) {
        await download(raw + encodeURIComponent(source), path.join(directory, filename));
      }
    }
    // Remove filenames produced by the old script, which Android cannot compile.
    for (const directory of destinations) {
      for (const suffix of ['', '_fajr']) {
        const legacy = `adhan_${sound.id}${suffix}.mp3`;
        if (legacy.includes('-')) fs.rmSync(path.join(directory, legacy), { force: true });
      }
    }
  }
  console.log('Prepared native Adhan audio assets.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
