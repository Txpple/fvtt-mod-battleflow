import { defineConfig } from "vitest/config";

// UNIT TIER ONLY (PLAN.md Phase 5). Everything here runs offline, with NO Foundry, in
// milliseconds: pure DECISION and REGISTRY functions taking plain data (ARCHITECTURE.md §2).
//
// The live tier is `tools/smoke-*.mjs`, driven through the sibling MCP repo's headless
// browser against a real world. It is deliberately NOT a vitest suite and NOT part of
// `npm test` — it mutates a live world and has protocol requirements a runner would hide
// (NOTES.md §5).
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.js"]
  }
});
