import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

// `next-env.d.ts` este generat de Next la fiecare build; nu îl edităm noi.
const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".tools/**",
      "drizzle/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // `any` ascunde exact tipul de nepotrivire pe care contăm în authz.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
