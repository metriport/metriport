// Generated from E:\work\health\src\FHIR-Converter-handlebars\src\lib\outputProcessor\json.g4 by ANTLR 4.9.2
// jshint ignore: start
var antlr4 = require("antlr4");

// This class defines a complete generic visitor for a parse tree produced by jsonParser.

class jsonVisitor extends antlr4.tree.ParseTreeVisitor {
  // Visit a parse tree produced by jsonParser#json.
  visitJson(ctx) {
    return this.visitChildren(ctx);
  }

  // Visit a parse tree produced by jsonParser#obj.
  visitObj(ctx) {
    return this.visitChildren(ctx);
  }

  // Visit a parse tree produced by jsonParser#pair.
  visitPair(ctx) {
    return this.visitChildren(ctx);
  }

  // Visit a parse tree produced by jsonParser#array.
  visitArray(ctx) {
    return this.visitChildren(ctx);
  }

  // Visit a parse tree produced by jsonParser#value.
  visitValue(ctx) {
    return this.visitChildren(ctx);
  }
}

exports.jsonVisitor = jsonVisitor;
