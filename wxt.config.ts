import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Hydra Review',
    description: 'Enriquece o code review com GitLab e Redmine',
    version: '1.0.0',
    permissions: ['storage', 'history', 'tabs'],
    host_permissions: [
      "http://*/*",
      "https://*/*"
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
