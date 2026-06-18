import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file gets a fresh mongo + fresh app — the global
    // setup spins up an in-memory MongoDB once for the whole run,
    // and tests/setup/beforeEach drops every collection between
    // tests so they don't leak state into each other.
    globalSetup: ['./tests/setup/globalSetup.js'],
    setupFiles: ['./tests/setup/beforeEach.js'],
    environment: 'node',
    // mongodb-memory-server downloads + spins up mongod, give the
    // first hook room to do that on a cold cache.
    hookTimeout: 60_000,
    testTimeout: 20_000,
    // Force serial execution per file — multiple parallel files
    // would race on the shared connection.
    fileParallelism: false,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/admin/**', 'src/swagger/**'],
    },
  },
});
