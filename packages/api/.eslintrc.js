/*global module*/
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "eslint-plugin-tsdoc"],
  root: true,
  rules: {
    'tsdoc/syntax': 'warn'
  }
};
