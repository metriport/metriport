const rules = require('./lib/rules');

module.exports = {
  rules,
  configs: {
    recommended: {
      plugins: ['@metriport/eslint-rules'],
      rules: {
        '@metriport/eslint-rules/no-named-arrow-functions': 'error',
      },
    },
    all: {
      plugins: ['@metriport/eslint-rules'],
      rules: Object.keys(rules).reduce((acc, ruleName) => {
        acc[`@metriport/eslint-rules/${ruleName}`] = 'error';
        return acc;
      }, {}),
    },
  },
};
