/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: "es5",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  plugins: [],
  overrides: [
    {
      files: ["*.json", "*.md", "*.yml", "*.yaml"],
      options: {
        tabWidth: 2,
      },
    },
  ],
};