/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "jsdom", // Use jsdom for DOM APIs
    globals: true, // Use global APIs like `describe`, `it`, `expect`
    setupFiles: "./tests/setup.ts", // Run this file before tests
  },
});
