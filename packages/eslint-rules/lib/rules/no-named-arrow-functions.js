module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow arrow functions from being assigned to variables',
      category: 'Stylistic Issues',
      recommended: false
    },
    fixable: null,
    schema: []
  },

  create(context) {
    return {
      VariableDeclarator(node) {
        // Check if the variable is being assigned an arrow function
        if (node.init && node.init.type === 'ArrowFunctionExpression') {
          context.report({
            node: node,
            message: 'Arrow functions should not be assigned to variables. Use function declarations instead.'
          });
        }
      }
    };
  }
};