import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
    benchmark: {
      include: ['src/**/*.bench.js', 'tests/**/*.bench.js'],
    },
    globals: true,
  },
  assetsInclude: ['**/*.wgsl'],
})
