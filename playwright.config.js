// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: 'test_*.js',
});
