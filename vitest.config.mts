import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Unit tests live in tests/unit/<ws>/ (ws = m0, a-f, m2, content). Shared helpers: tests/support/.
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, ".claude/**", "exercises/**"],
    css: false,
  },
});
