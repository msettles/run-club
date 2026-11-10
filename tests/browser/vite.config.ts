import { defineConfig, mergeConfig } from 'vite';
import appConfig from '../../vite.config';

// Explicit definitions override .env files without adding a production auth bypass.
export default mergeConfig(appConfig, defineConfig({
  define: Object.fromEntries(['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID', 'MEASUREMENT_ID'].map((name) => [`import.meta.env.VITE_FIREBASE_${name}`, JSON.stringify('')])),
}));
