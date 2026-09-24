import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const platform = process.argv[2];
const allowed = new Set(['android', 'ios']);

if (!allowed.has(platform)) {
  console.error('Usage: node scripts/ensure-cap-platform.mjs <android|ios>');
  process.exit(2);
}

if (!fs.existsSync(platform)) {
  console.log(`Adding Capacitor platform: ${platform}`);
  execFileSync('npx', ['cap', 'add', platform], { stdio: 'inherit' });
} else {
  console.log(`Capacitor platform already exists: ${platform}`);
}
