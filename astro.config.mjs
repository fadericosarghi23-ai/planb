import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.example.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
