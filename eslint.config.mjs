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
    // Build outputs from the NEXT_DIST_DIR overrides used by the release and
    // verification scripts. tsconfig.json and .gitignore already list all
    // three; .next-verify was missing here, so linting after a verification
    // build reported hundreds of errors in generated code.
    ".next-e2e/**",
    ".next-release/**",
    ".next-verify/**",
    "out/**",
    "build/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
