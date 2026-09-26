import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mickosis.github.io',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
