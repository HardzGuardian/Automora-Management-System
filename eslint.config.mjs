import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".superpowers/**", "playwright-report/**", "test-results/**", ".playwright-mcp/**", "backups/**"]),
  {
    // Rule 2: other modules only via modules/<x>/index.ts (deep imports banned; use relative inside a module)
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/*"],
              message: "Import other modules only through @/modules/<name> (its index.ts).",
            },
          ],
        },
      ],
    },
  },
  {
    // Rule 1: app/** and components/** never import db/*
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/db", "@/db/*"], message: "UI code must go through modules/*, not the db." },
            { group: ["@/modules/*/*"], message: "Import modules only through their index.ts." },
          ],
        },
      ],
    },
  },
  {
    // Rule 3: components never import modules (they receive props)
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/db", "@/db/*"], message: "components must not import db." },
            { group: ["@/modules", "@/modules/*"], message: "components receive props; they never import modules." },
          ],
        },
      ],
    },
  },
  {
    // Rule 5: only lib/env.ts reads process.env
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/env.ts", "src/db/migrate-cli.ts", "src/**/*.test.ts", "src/test/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Read configuration via @/lib/env only." },
      ],
    },
  },
]);

export default eslintConfig;
