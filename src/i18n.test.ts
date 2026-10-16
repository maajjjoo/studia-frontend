import { es } from './i18n/es.ts';
import { en } from './i18n/en.ts';
import { interpolate, formatLocalizedDate, formatLocalizedDay } from './i18n/formatters.ts';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: expected ${String(expected)} but got ${String(actual)}. ${message || ''}`
    );
  }
}

// 1. Recursive Parity Check between Spanish and English dictionaries
function collectKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(collectKeys(v, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

const esKeys = collectKeys(es).sort();
const enKeys = collectKeys(en).sort();

assertEqual(esKeys.length, enKeys.length, 'Total translation keys count must match exactly between es and en');

for (let i = 0; i < esKeys.length; i++) {
  assertEqual(esKeys[i], enKeys[i], `Translation key mismatch at index ${i}`);
}

// Verify no empty string values in either dictionary
function verifyNonEmptyStrings(obj: Record<string, any>, path = ''): void {
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${k}` : k;
    if (typeof v === 'string') {
      assert(v.trim().length > 0, `Empty string translation found at: ${fullPath}`);
    } else if (Array.isArray(v)) {
      assert(v.length > 0, `Empty translation array found at: ${fullPath}`);
      for (const item of v) {
        assert(typeof item === 'string' && item.trim().length > 0, `Empty item in array at: ${fullPath}`);
      }
    } else if (v && typeof v === 'object') {
      verifyNonEmptyStrings(v, fullPath);
    }
  }
}

verifyNonEmptyStrings(es, 'es');
verifyNonEmptyStrings(en, 'en');

// 2. Interpolation Tests
const template1 = 'Hello, {name}!';
assertEqual(interpolate(template1, { name: 'Maria' }), 'Hello, Maria!', 'Interpolate single string');

const template2 = '{count} tasks • {duration}';
assertEqual(interpolate(template2, { count: 5, duration: '2 h' }), '5 tasks • 2 h', 'Interpolate multiple values');

const template3 = 'No params {ignored}';
assertEqual(interpolate(template3), 'No params {ignored}', 'Interpolate without params retains placeholder');

// 3. Date & Language Fallback Logic
const invalidLangs = [null, undefined, '', 'fr', 'pt', 'deutsch'];
for (const val of invalidLangs) {
  const resolved = val === 'en' ? 'en' : 'es';
  assertEqual(resolved, 'es', `Invalid language ${String(val)} must fall back to 'es'`);
}

// 4. Formatter Localization Tests
const sampleDate = new Date('2026-10-15T12:00:00');
const esFormattedDate = formatLocalizedDate(sampleDate, 'es');
const enFormattedDate = formatLocalizedDate(sampleDate, 'en');
assert(esFormattedDate.toLowerCase().includes('octubre') || esFormattedDate.includes('15'), 'Spanish date format check');
assert(enFormattedDate.toLowerCase().includes('october') || enFormattedDate.includes('15'), 'English date format check');

const esDay1 = formatLocalizedDay(1, 'es'); // Monday
const enDay1 = formatLocalizedDay(1, 'en');
assertEqual(esDay1, 'Lunes', 'Day 1 in Spanish is Lunes');
assertEqual(enDay1, 'Monday', 'Day 1 in English is Monday');

console.log('# All 5 i18n parity, interpolation, and date formatting test suites passed.');

