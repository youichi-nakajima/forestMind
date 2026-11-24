import { describe, it, expect } from 'vitest';
import {
  APP_INFO,
  buildCopyableEnvText,
  formatEnvironmentSummary,
  formatPlatformLabel,
} from '../aboutInfo';

describe('aboutInfo', () => {
  it('exposes expected application metadata and HTTPS links including Buy Me a Coffee', () => {
    expect(APP_INFO.name).toBe('forestMind');
    expect(APP_INFO.version).toBe('1.4.0');
    expect(APP_INFO.license).toBe('MIT License');
    expect(APP_INFO.links.buyMeACoffee).toBe('https://buymeacoffee.com/youichinakq');
    for (const url of Object.values(APP_INFO.links)) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });

  it('formats platform labels cleanly', () => {
    expect(formatPlatformLabel('win32', 'x64')).toBe('Windows (x64)');
    expect(formatPlatformLabel('darwin', 'arm64')).toBe('macOS (arm64)');
    expect(formatPlatformLabel('linux')).toBe('Linux');
    expect(formatPlatformLabel('freebsd', 'x64')).toBe('freebsd (x64)');
    expect(formatPlatformLabel()).toBe('');
  });

  it('formats runtime summaries for Web and Desktop (Electron)', () => {
    expect(formatEnvironmentSummary(null)).toBe('Web ブラウザ');
    expect(
      formatEnvironmentSummary({
        version: '1.3.0',
        electron: '45.3.1',
        chrome: '134.0.0.0',
        node: '22.14.0',
        platform: 'win32',
        arch: 'x64',
      })
    ).toBe('Desktop (Electron 45.3.1 / Windows (x64))');
  });

  it('builds copyable environment text for both Desktop and Web environments', () => {
    const desktopText = buildCopyableEnvText('1.3.0', {
      version: '1.3.0',
      electron: '45.3.1',
      chrome: '134.0.0.0',
      node: '22.14.0',
      platform: 'win32',
      arch: 'x64',
    });
    expect(desktopText).toBe(
      [
        'forestMind v1.3.0',
        '実行環境: Desktop (Electron 45.3.1 / Chromium 134.0.0.0 / Node 22.14.0)',
        'OS: Windows (x64)',
      ].join('\n')
    );

    const webText = buildCopyableEnvText('1.3.0', null, 'TestBrowser/1.0');
    expect(webText).toBe(
      [
        'forestMind v1.3.0',
        '実行環境: Web ブラウザ',
        'User-Agent: TestBrowser/1.0',
      ].join('\n')
    );
  });
});
