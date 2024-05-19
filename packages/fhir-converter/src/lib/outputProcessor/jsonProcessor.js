// ------------------------------------------------------------------------------------------------- 
// Copyright (c) 2022-present Metriport Inc.   
//  
// Licensed under AGPLv3. See LICENSE in the repo root for license information.
//  
// This file incorporates work covered by the following copyright and  
// permission notice:  
//  
//     Copyright (c) Microsoft Corporation. All rights reserved. 
//  
//     Permission to use, copy, modify, and/or distribute this software  
//     for any purpose with or without fee is hereby granted, provided  
//     that the above copyright notice and this permission notice appear  
//     in all copies.  
//  
//     THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL  
//     WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED  
//     WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE  
//     AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR  
//     CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS  
//     OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,  
//     NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN  
//     CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.  
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
