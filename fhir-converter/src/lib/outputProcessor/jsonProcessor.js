// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

const antlr4 = require("antlr4");
const jsonLexer = require("./autogen/jsonLexer");
const jsonParser = require("./autogen/jsonParser");
const jsonCustomListener = require("./jsonCustomListener").jsonCustomListener;

module.exports.Process = function (input) {
  try {
    var chars = new antlr4.InputStream(input);
    var lexer = new jsonLexer.jsonLexer(chars);
    var tokens = new antlr4.CommonTokenStream(lexer);
    var parser = new jsonParser.jsonParser(tokens);
    lexer.removeErrorListeners();
    lexer.addErrorListener(new antlr4.error.DiagnosticErrorListener(false));
    parser.removeErrorListeners();
    parser.addErrorListener(new antlr4.error.DiagnosticErrorListener(false));
    parser.buildParseTrees = true;
    var tree = parser.json();
    var jsonListenerObj = new jsonCustomListener();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(jsonListenerObj, tree);
    return jsonListenerObj.getResult();
  } catch (err) {
    //console.log(err.toString());
    return input;
  }
};
