import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Hydra Review',
    description: 'Enriquece o code review com GitLab e Redmine',
    version: pkg.version,
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    action: {
      default_icon: {
        16: 'icon-16.png',
        32: 'icon-32.png',
        48: 'icon-48.png',
        128: 'icon-128.png',
      },
    },
    permissions: ['storage', 'history', 'tabs'],
    host_permissions: [
      "http://*/*",
      "https://*/*"
    ],
    content_scripts: [
      {
        matches: ["*://gitlab.com/*", "*://gitlab2.atakone.com.br/*"],
        js: ["content-scripts/gitlab.js"]
      }
    ]
  },
  runner: {
    chromiumProfile: './.wxt/chrome-profile',
    keepProfileChanges: true,
  },
  vite: () => ({
    plugins: [
      tailwindcss(),
    ],
  }),
});
