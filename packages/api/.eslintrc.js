/*global module*/
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "@metriport/eslint-rules"],
  root: true,
  rules: {
    "@metriport/eslint-rules/no-named-arrow-functions": "warn",
  },
  overrides: [
    {
      files: ["src/sequelize/migrations/**/*"],
      rules: {
        "@metriport/eslint-rules/no-named-arrow-functions": "off",
      },
    },
  ],
};
