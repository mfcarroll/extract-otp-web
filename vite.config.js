import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import i18nPages from './scripts/i18n/vite-plugin.mjs';

/**
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  base: '/extract-otp-web/',
  plugins: [basicSsl(), i18nPages()],
  server: {
    https: true,
  },
});
