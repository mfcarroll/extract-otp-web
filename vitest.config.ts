/// <reference types="vitest" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // Use jsdom for DOM APIs
    globals: true, // Use global APIs like `describe`, `it`, `expect`
    // Claude Code keeps git worktrees (full copies of the repo) in .claude/,
    // whose tests would otherwise run a second time.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
