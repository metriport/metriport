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
          const arrowFunction = node.init;
          const body = arrowFunction.body;
          
          // Only report if the function has more than one line
          let hasMultipleLines = false;
          
          if (body.type === 'BlockStatement') {
            // For block statements, check if there's more than one statement
            hasMultipleLines = body.body.length > 1;
          } else {
            // For expression bodies, check if the expression spans multiple lines
            const startLine = body.loc.start.line;
            const endLine = body.loc.end.line;
            hasMultipleLines = endLine > startLine;
          }
          
          if (hasMultipleLines) {
            context.report({
              node: node,
              message: 'Arrow functions should not be assigned to variables. Use function declarations instead.'
            });
          }
        }
      }
    };
  }
};