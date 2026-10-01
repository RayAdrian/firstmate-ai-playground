import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The service-role client is for scripts only; the app must never import it.
    files: ["src/**/*"],
    ignores: ["src/lib/db/service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/service", "**/lib/db/service", "**/db/service"],
              message: "The service-role client is for scripts only. Use @/lib/db/server.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    // Exercise starters are deliberately broken standalone projects.
    "exercises/**",
    // Media tooling (Remotion, VHS) has its own deps and checks.
    "media/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
