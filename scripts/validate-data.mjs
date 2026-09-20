import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filePath))).digest('hex');
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(root, filePath), 'utf8'));
const fail = (message) => {
  console.error(`❌ Data validation failed: ${message}`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const adhkarSourcePath = 'data/sources/adhkar/morning-evening-ar.json';
const adhkarHashPath = 'data/sources/adhkar/morning-evening-ar.sha256';
const adhkarGeneratedPath = 'src/data/adhkar/adhkar.generated.json';
const expectedAdhkarHash = fs.readFileSync(path.join(root, adhkarHashPath), 'utf8').trim().split(/\s+/)[0];
const actualAdhkarHash = sha256(adhkarSourcePath);
assert(actualAdhkarHash === expectedAdhkarHash, `Adhkar source hash changed. Expected ${expectedAdhkarHash}, got ${actualAdhkarHash}`);

const hisnSourcePath = 'data/sources/adhkar/hisnul-muslim-ar.json';
const hisnHashPath = 'data/sources/adhkar/hisnul-muslim-ar.sha256';
const expectedHisnHash = fs.readFileSync(path.join(root, hisnHashPath), 'utf8').trim().split(/\s+/)[0];
const actualHisnHash = sha256(hisnSourcePath);
assert(actualHisnHash === expectedHisnHash, `Hisn al-Muslim source hash changed. Expected ${expectedHisnHash}, got ${actualHisnHash}`);

const adhkarSource = readJson(adhkarSourcePath);
const hisnSource = readJson(hisnSourcePath);
const adhkarGenerated = readJson(adhkarGeneratedPath);
assert(Array.isArray(adhkarSource), 'Adhkar source must be an array');
assert(Array.isArray(hisnSource.data), 'Hisn al-Muslim source must contain a data array');
assert(Array.isArray(adhkarGenerated.items), 'Generated adhkar items must be an array');
assert(adhkarGenerated.meta?.sourceSha256 === actualAdhkarHash, 'Generated adhkar metadata hash mismatch');
assert(adhkarGenerated.meta?.hisnSourceSha256 === actualHisnHash, 'Generated hisn metadata hash mismatch');
assert(adhkarGenerated.items.length > 0, 'No adhkar data available');

const seen = new Set();
for (let index = 0; index < adhkarSource.length; index += 1) {
  const source = adhkarSource[index];
  const generated = adhkarGenerated.items[index];
  assert(generated.id === `mae-${String(source.order).padStart(3, '0')}`, `Adhkar id mismatch at index ${index}`);
  assert(!seen.has(generated.id), `Duplicate adhkar id ${generated.id}`);
  seen.add(generated.id);
  assert(generated.order === source.order, `Adhkar order mismatch at index ${index}`);
  assert(generated.content === source.content, `Adhkar content changed at order ${source.order}`);
  assert(generated.count === source.count, `Adhkar count changed at order ${source.order}`);
  assert(generated.source === source.source, `Adhkar source reference changed at order ${source.order}`);
  assert(Array.isArray(generated.categories) && generated.categories.length > 0, `Adhkar ${generated.id} has no category`);
}

const allowedCategories = new Set(adhkarGenerated.categories);
const includedHisn = adhkarGenerated.items.filter((item) => item.id.startsWith('hisn-'));
const sourceHisn = hisnSource.data.filter((item) => !/^المقدمة$|^فضل |^كيف كان النبي|^من أنواع الخير/.test(item.section));
assert(includedHisn.length === sourceHisn.length, `Hisn items count changed: ${includedHisn.length} vs ${sourceHisn.length}`);
assert(includedHisn.length >= 250, 'Hisn al-Muslim data seems incomplete');
for (const item of adhkarGenerated.items) {
  assert(!seen.has(`${item.id}-dup`), `unexpected marker ${item.id}`);
  assert(item.content && item.content.trim().length > 0, `Adhkar ${item.id} has empty content`);
  assert(Number.isInteger(item.count) && item.count > 0, `Adhkar ${item.id} has invalid count`);
  assert(item.countDescription && item.countDescription.length > 0, `Adhkar ${item.id} has no count description`);
  assert(Array.isArray(item.categories) && item.categories.length > 0, `Adhkar ${item.id} has no category`);
  for (const category of item.categories) assert(allowedCategories.has(category), `Adhkar ${item.id} uses unknown category "${category}"`);
}
assert(!adhkarGenerated.items.some((item) => /^فضل |^المقدمة$/.test(item.section ?? '')), 'Virtue-only sections must not be counted as adhkar');

const docs = [
  'docs/DATA_SOURCES.md',
  'docs/QURAN_VALIDATION.md',
  'docs/PRIVACY.md',
  'docs/ARCHITECTURE.md',
  'docs/RELEASE.md',
  'docs/MOBILE_WORKFLOW.md'
];
for (const doc of docs) {
  assert(fs.existsSync(path.join(root, doc)), `Missing documentation file ${doc}`);
}

console.log('✅ Data validation passed: source hashes, generated data integrity, categories, and required docs verified.');
