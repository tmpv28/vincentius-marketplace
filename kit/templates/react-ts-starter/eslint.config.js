// Flat config, and Airbnb is gone rather than ported.
//
// eslint-config-airbnb has had no release in four years, eslint-config-airbnb-typescript was
// archived in 2025, and neither speaks flat config. The community forks that do are low-download
// packages in a namespace with a documented malicious-publish incident, which is a worse trade
// than the dead-but-clean config they replace. So the opinionated layer is dropped and what the
// standard actually names is stated here directly.
//
// Most of the old rules block existed to switch Airbnb's opinions back off. Those lines are gone
// with it. What remains is every rule this project turned on deliberately, plus the four loop and
// label restrictions Airbnb contributed that are worth keeping on their own merits.

import js from "@eslint/js";
import globals from "globals";
import typescriptEslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default typescriptEslint.config(
  { ignores: ["dist", "node_modules", "storybook-static", "coverage"] },

  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  react.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx}"],

    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },

    settings: { react: { version: "detect" } },

    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
      import: importPlugin
    },

    rules: {
      // Kept strict, because these catch real bugs rather than express a taste.
      eqeqeq: ["error", "always"],
      "no-empty": "error",
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "error",
      "unused-imports/no-unused-imports": "error",
      "react-hooks/rules-of-hooks": "error",
      "no-nested-ternary": "error",

      // Two rules Airbnb contributed that are worth keeping on their own merits rather than
      // losing with the config that happened to carry them.
      "no-use-before-define": ["error", { functions: true, classes: true, variables: true }],
      "no-param-reassign": [
        "error",
        {
          props: true,
          // Airbnb's own ignore list, kept verbatim. `context` is on it, which is why the
          // painting system passed before: a Canvas 2D call is a property write on the context,
          // and a painting function that may not mutate it cannot paint.
          ignorePropertyModificationsFor: [
            "acc",
            "accumulator",
            "e",
            "ctx",
            "context",
            "req",
            "request",
            "res",
            "response",
            "$scope",
            "staticContext"
          ]
        }
      ],

      // The unused-imports plugin owns this, so the two base rules stand down for it.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }
      ],

      // Dependency arrays express intent here and a mechanical fix makes worse code. Off means
      // you are responsible, not that it does not matter.
      "react-hooks/exhaustive-deps": "off",

      // TypeScript owns these, and `any` is a decision taken at boundaries with a comment.
      "react/prop-types": "off",
      "react/require-default-props": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",

      // The new JSX transform means React is not in scope, and the entities rule fights copy.
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",

      // These came from Airbnb and are kept because each one names a real hazard. Project-level
      // selectors (a typed constant required over a bare literal, TV 10) are added here as needed.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ForInStatement",
          message:
            "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array."
        },
        {
          selector: "ForOfStatement",
          message:
            "iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations."
        },
        {
          selector: "LabeledStatement",
          message:
            "Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand."
        },
        {
          selector: "WithStatement",
          message:
            "`with` is disallowed in strict mode because it makes code impossible to predict and optimize."
        }
      ],

      // The one dependency rule tsc cannot answer: whether an import is declared in the manifest.
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "**/vite.config.{js,ts}",
            "**/vitest.setup.{js,ts}",
            "**/.storybook/**",
            "**/*.stories.{ts,tsx,js,jsx}",
            "**/*.test.{ts,tsx,js,jsx}",
            "**/*.spec.{ts,tsx,js,jsx}",
            "scripts/**",
            "eslint.config.js"
          ]
        }
      ],

      // jsx-a11y ships these on and 04 turns them off. Each one is a decision to do its job by
      // hand, not a decision that its job does not matter.
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/click-events-have-key-events": "off"
    }
  },

  prettierRecommended,

  // Restated after eslint-config-prettier turns them off, so a file that somehow bypassed
  // Prettier still fails the lint step. They catch nothing Prettier would have left.
  // This block must stay after prettierRecommended, or its eslint-config-prettier layer switches
  // them back off. avoidEscape mirrors Prettier, which picks single quotes to save an escape.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double", { avoidEscape: true }],
      "comma-dangle": ["error", "never"]
    }
  }
);
