import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function patchAndroid() {
  const file = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  const permissions = [
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM'
  ];
  const additions = permissions.filter((permission) => !text.includes(`android:name="${permission}"`))
    .map((permission) => `    <uses-permission android:name="${permission}" />`)
    .join('
');
  if (additions) text = text.replace(/<manifest[^>]*>\s*/, (match) => `${match}${additions}
`);

  if (!text.includes('android.hardware.location.gps')) {
    text = text.replace(/<manifest[^>]*>\s*/, (match) => `${match}    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
`);
  }
  fs.writeFileSync(file, text);
}

function patchIos() {
  const file = path.join(root, 'ios', 'App', 'App', 'Info.plist');
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  const entries = [
    ['NSLocationWhenInUseUsageDescription', 'نحتاج موقعك اختياريًا لحساب مواقيت الصلاة بدقة في مكانك.'],
    ['NSLocationAlwaysAndWhenInUseUsageDescription', 'نحتاج موقعك اختياريًا لحساب مواقيت الصلاة بدقة في مكانك.']
  ];
  for (const [key, value] of entries) {
    if (text.includes(`<key>${key}</key>`)) continue;
    text = text.replace('</dict>', `  <key>${key}</key>
  <string>${value}</string>
</dict>`);
  }
  fs.writeFileSync(file, text);
}

patchAndroid();
patchIos();
console.log('Prepared native location, notification and exact-alarm permissions.');
