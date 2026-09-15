import { describe, expect, test } from 'bun:test';
import { describeBrowser } from './describe-browser.ts';

describe('describeBrowser', () => {
  test('names browser and system from the user agent', () => {
    expect(describeBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0')).toBe('Edge on Windows');
    expect(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15')).toBe('Safari on macOS');
    expect(describeBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0')).toBe('Firefox on Linux');
    expect(describeBrowser('')).toBe('Browser on this device');
  });
});
