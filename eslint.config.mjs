import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Every NEXT_DIST_DIR override, matching .gitignore's own `/.next-*/`.
    // These were listed one directory at a time and the list kept going stale:
    // linting after a build into a dir nobody had thought to add reported
    // hundreds of errors in generated code. A glob cannot fall behind.
    ".next-*/**",
    "out/**",
    "build/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
