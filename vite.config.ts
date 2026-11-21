import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Content Security Policy injected into production builds only
// (the dev server relies on inline scripts for React Fast Refresh).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'forestmind-inject-csp',
      apply: 'build',
      transformIndexHtml(html: string) {
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`
        );
      },
    },
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
  },
});
