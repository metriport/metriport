/*global module*/
module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier", "plugin:@metriport/eslint-rules/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "@metriport/eslint-rules"],
  root: true,
  overrides: [
    {
      files: ["src/sequelize/migrations/**/*"],
      rules: {
        "@metriport/eslint-rules/no-named-arrow-functions": "off",
      },
    },
  ],
};
