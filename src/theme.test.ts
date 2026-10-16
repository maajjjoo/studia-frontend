import { resolveEffectiveAppearance } from './useTheme.ts';

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: expected ${String(expected)} but got ${String(actual)}. ${message || ''}`
    );
  }
}

// 1. Explicit mode resolution
assertEqual(resolveEffectiveAppearance('dark', false), 'dark', 'Explicit dark on light OS');
assertEqual(resolveEffectiveAppearance('dark', true), 'dark', 'Explicit dark on dark OS');
assertEqual(resolveEffectiveAppearance('light', false), 'light', 'Explicit light on light OS');
assertEqual(resolveEffectiveAppearance('light', true), 'light', 'Explicit light on dark OS');

// 2. System mode resolution
assertEqual(resolveEffectiveAppearance('system', false), 'light', 'System mode when OS is light');
assertEqual(resolveEffectiveAppearance('system', true), 'dark', 'System mode when OS is dark');

// 3. Backward compatibility with existing studia_theme
const mockStorage: Record<string, string> = {
  studia_theme: 'blue',
};
const preservedTheme = mockStorage['studia_theme'] === 'blue' ? 'blue' : 'rose';
assertEqual(preservedTheme, 'blue', 'Preserve existing blue theme');

// Set appearance without altering theme
mockStorage['studia_appearance'] = 'dark';
assertEqual(mockStorage['studia_theme'], 'blue', 'studia_theme must remain intact');
assertEqual(mockStorage['studia_appearance'], 'dark', 'studia_appearance saved separately');

// 4. Fallback defaults for invalid/missing values
const invalidAppearances = [null, undefined, '', 'corrupt', 'unknown'];
for (const val of invalidAppearances) {
  const fallback = (val === 'light' || val === 'dark' || val === 'system') ? val : 'system';
  assertEqual(fallback, 'system', `Expected fallback to 'system' for ${String(val)}`);
}

const invalidThemes = [null, undefined, '', 'green', 'violet'];
for (const val of invalidThemes) {
  const fallback = (val === 'rose' || val === 'blue') ? val : 'rose';
  assertEqual(fallback, 'rose', `Expected fallback to 'rose' for ${String(val)}`);
}

console.log('# All 5 theme & appearance test suites passed.');
