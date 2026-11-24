import type { ElectronAppInfo } from '../types/electron';

export const APP_INFO = {
  name: 'forestMind',
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.0',
  compatBadge: 'FreeMind 1.0.1 互換',
  description:
    '複数のマップを「森（Forest）」として管理・検索・リンクし、思考の成長過程をアニメーションと音で再生できるマインドマップエディタです。',
  license: 'MIT License',
  copyright: 'Copyright (c) 2026 youichi-nakajima',
  supportMessage:
    'もし気に入っていただけましたら、コーヒー1杯分の応援をいただけると今後の開発・改善の大きな励みになります。',
  links: {
    github: 'https://github.com/youichi-nakajima/forestMind',
    releases: 'https://github.com/youichi-nakajima/forestMind/releases',
    issues: 'https://github.com/youichi-nakajima/forestMind/issues',
    userGuide: 'https://github.com/youichi-nakajima/forestMind/blob/main/USER_GUIDE.md',
    buyMeACoffee: 'https://buymeacoffee.com/youichinakq',
  },
} as const;

const PLATFORM_LABELS: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
};

/** Formats Node/Electron platform and architecture identifiers for display. */
export function formatPlatformLabel(platform?: string, arch?: string): string {
  const base = platform ? (PLATFORM_LABELS[platform] ?? platform) : '';
  if (!base) return arch || '';
  return arch ? `${base} (${arch})` : base;
}

/** Formats a single-line summary of the active runtime environment. */
export function formatEnvironmentSummary(runtime?: ElectronAppInfo | null): string {
  if (!runtime) {
    return 'Web ブラウザ';
  }
  const parts = [
    runtime.electron ? `Electron ${runtime.electron}` : '',
    formatPlatformLabel(runtime.platform, runtime.arch),
  ].filter(Boolean);
  return parts.length > 0 ? `Desktop (${parts.join(' / ')})` : 'Desktop (Electron)';
}

/** Builds plain-text application and environment details suitable for bug reports. */
export function buildCopyableEnvText(
  appVersion: string,
  runtime?: ElectronAppInfo | null,
  userAgent?: string
): string {
  const lines = [`${APP_INFO.name} v${appVersion}`];

  if (runtime) {
    const runtimeParts = [
      runtime.electron ? `Electron ${runtime.electron}` : '',
      runtime.chrome ? `Chromium ${runtime.chrome}` : '',
      runtime.node ? `Node ${runtime.node}` : '',
    ].filter(Boolean);

    lines.push(
      runtimeParts.length > 0
        ? `実行環境: Desktop (${runtimeParts.join(' / ')})`
        : '実行環境: Desktop (Electron)'
    );

    const platformLabel = formatPlatformLabel(runtime.platform, runtime.arch);
    if (platformLabel) {
      lines.push(`OS: ${platformLabel}`);
    }
  } else {
    lines.push('実行環境: Web ブラウザ');
    if (userAgent) {
      lines.push(`User-Agent: ${userAgent}`);
    }
  }

  return lines.join('\n');
}
