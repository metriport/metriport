module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require docstring comments for TypeScript scripts in packages/utils',
      category: 'Stylistic Issues',
      recommended: false
    },
    fixable: null,
    schema: []
  },

  create(context) {
    const filename = context.getFilename();
    
    // Only apply this rule to TypeScript files in packages/utils, excluding test files
    if (!filename.includes('packages/utils/src') || !filename.endsWith('.ts') || filename.includes('__tests__')) {
      return {};
    }
    
    return {
      Program(node) {
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();
        
        // Skip files that have exports (they are modules, not scripts)
        // Exception: files using commander are still considered scripts
        const hasExports = node.body.some(statement => 
          statement.type === 'ExportNamedDeclaration' ||
          statement.type === 'ExportDefaultDeclaration' ||
          statement.type === 'ExportAllDeclaration' ||
          (statement.type === 'ExpressionStatement' &&
           statement.expression.type === 'AssignmentExpression' &&
           statement.expression.left.type === 'MemberExpression' &&
           statement.expression.left.object.name === 'module' &&
           statement.expression.left.property.name === 'exports')
        );
        
        if (hasExports) {
          // Check if this file uses commander (CLI tool)
          const usesCommander = node.body.some(statement => {
            // Check for import from 'commander'
            if (statement.type === 'ImportDeclaration' && 
                statement.source.value === 'commander') {
              return true;
            }
            // Check for require('commander')
            if (statement.type === 'VariableDeclaration' &&
                statement.declarations &&
                statement.declarations.some(decl => 
                  decl.init &&
                  decl.init.type === 'CallExpression' &&
                  decl.init.callee &&
                  decl.init.callee.name === 'require' &&
                  decl.init.arguments &&
                  decl.init.arguments[0] &&
                  decl.init.arguments[0].value === 'commander'
                )) {
              return true;
            }
            return false;
          });
          
          // If has exports but doesn't use commander, skip (it's a module)
          if (!usesCommander) {
            return;
          }
        }
        
        // Find the last import or dotenv.config() statement
        let lastImportLine = 0;
        for (const statement of node.body) {
          if (statement.type === 'ImportDeclaration') {
            lastImportLine = Math.max(lastImportLine, statement.loc.end.line);
          } else if (statement.type === 'ExpressionStatement' && 
                     statement.expression.type === 'CallExpression' &&
                     statement.expression.callee.type === 'MemberExpression' &&
                     statement.expression.callee.object.name === 'dotenv' &&
                     statement.expression.callee.property.name === 'config') {
            lastImportLine = Math.max(lastImportLine, statement.loc.end.line);
          }
        }
        
        // Find the first meaningful code statement (excluding setup calls)
        let firstCodeStatement = null;
        let firstCodeLine = Infinity;
        for (const statement of node.body) {
          if (statement.type === 'VariableDeclaration' || 
              statement.type === 'FunctionDeclaration' ||
              statement.type === 'ExportNamedDeclaration' ||
              statement.type === 'ExportDefaultDeclaration' ||
              statement.type === 'ClassDeclaration') {
            if (statement.loc.start.line < firstCodeLine) {
              firstCodeLine = statement.loc.start.line;
              firstCodeStatement = statement;
            }
          } else if (statement.type === 'ExpressionStatement' && 
                     statement.expression.type === 'CallExpression') {
            // Skip dotenv.config() and common setup calls like dayjs.extend()
            const callee = statement.expression.callee;
            if (callee.type === 'MemberExpression') {
              const isSetupCall = (
                (callee.object.name === 'dotenv' && callee.property.name === 'config') ||
                (callee.object.name === 'dayjs' && callee.property.name === 'extend') ||
                (callee.property.name === 'extend' || callee.property.name === 'config')
              );
              if (!isSetupCall && statement.loc.start.line < firstCodeLine) {
                firstCodeLine = statement.loc.start.line;
                firstCodeStatement = statement;
              }
            } else {
              // Other function calls are considered first code
              if (statement.loc.start.line < firstCodeLine) {
                firstCodeLine = statement.loc.start.line;
                firstCodeStatement = statement;
              }
            }
          }
        }
        
        // Look for a multi-line block comment between imports and first code
        let hasDocstring = false;
        for (const comment of comments) {
          if (comment.type === 'Block' && 
              comment.loc.start.line > lastImportLine && 
              comment.loc.end.line < firstCodeLine &&
              comment.value.trim().length > 20) { // Must be substantial
            hasDocstring = true;
            break;
          }
        }
        
        if (!hasDocstring && firstCodeStatement) {
          context.report({
            node: firstCodeStatement,
            message: 'Missing docstring comment. Add a block comment (/* */) above this line explaining the script\'s purpose.',
            loc: {
              start: firstCodeStatement.loc.start,
              end: {
                line: firstCodeStatement.loc.start.line,
                column: firstCodeStatement.loc.end.column
              }
            }
          });
        }
      }
    };
  }
};