import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const platform = process.argv[2];
const allowed = new Set(['android', 'ios']);

if (!allowed.has(platform)) {
  console.error('Usage: node scripts/ensure-cap-platform.mjs <android|ios>');
  process.exit(2);
}

if (fs.existsSync(platform)) {
  console.log(`Capacitor platform already exists: ${platform}`);
  process.exit(0);
}

console.log(`Adding Capacitor platform: ${platform}`);
execFileSync('npx', ['cap', 'add', platform], { stdio: 'inherit' });

// نسخ أصوات الأذان المدمجة إلى موارد أندرويد حتى تعمل مع إشعارات النظام
// (ملفات res/raw تُشار إليها بالاسم في LocalNotifications).
if (platform === 'android') {
  const path = await import('node:path');
  const soundsDir = path.join(process.cwd(), 'resources', 'sounds');
  const rawDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'raw');
  if (fs.existsSync(soundsDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
    for (const file of fs.readdirSync(soundsDir)) {
      if (!file.endsWith('.mp3')) continue;
      fs.copyFileSync(path.join(soundsDir, file), path.join(rawDir, file));
    }
    console.log('Copied bundled adhan sounds to android res/raw');
  }
}
