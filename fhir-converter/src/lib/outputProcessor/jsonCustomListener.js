/* eslint-disable no-undef */
// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var jsonListener = require("./autogen/jsonListener").jsonListener;

class jsonCustomListener extends jsonListener {
  constructor() {
    super();
    this.stack = [];
  }

  exitJson() {
    let childText = this.stack.pop();
    if (childText === undefined) {
      throw "unexpected state!";
    }
    this.stack.push(childText ? childText : "{}"); // top object
  }

  exitObj(ctx) {
    //console.log('obj');
    //this.dumpCtx(ctx);

    var pairArr = [];
    for (var i = 0; i < ctx.getChildCount(); ++i) {
      if (ctx.getChild(i).getChildCount() == 3) {
        let pairText = this.stack.pop();
        if (pairText) {
          pairArr.push(pairText);
        }
      }
    }
    let finalText = pairArr.reverse().join();
    this.stack.push(finalText ? `{${finalText}}` : null);
    //this.printState();
  }

  exitArray(ctx) {
    //console.log('array');
    //this.dumpCtx(ctx);

    var valueArr = [];
    for (var i = 0; i < ctx.getChildCount(); ++i) {
      if (ctx.getChild(i).getChildCount() > 0) {
        let valText = this.stack.pop();
        if (valText) {
          valueArr.push(valText);
        }
      }
    }
    let finalText = valueArr.reverse().join();
    this.stack.push(finalText ? `[${finalText}]` : null);
    //this.printState();
  }

  exitPair(ctx) {
    //console.log('pair');
    //this.dumpCtx(ctx);

    if (ctx.getChildCount() == 3) {
      let valueText = this.stack.pop();
      this.stack.push(valueText ? `${ctx.getChild(0).getText()}:${valueText}` : null);
    }
    //this.printState();
  }

  exitValue(ctx) {
    //console.log('value');
    //this.dumpCtx(ctx);

    if (1 == ctx.getChildCount()) {
      let child = ctx.getChild(0);
      if (child.getChildCount() == 0) {
        let text = child.getText();
        this.stack.push(text.length == 0 || text == '""' ? null : text);
      }
      // else keep child data as it is.
    }

    //this.printState();
  }

  /*
    dumpCtx(ctx) {
        console.log(`\t data=${ctx.getText()} childCount=${ctx.getChildCount()}`);
        for (let i = 0; i < ctx.getChildCount(); ++i) {
            console.log(`\t\t data=${ctx.getChild(i).getText()} childCount=${ctx.getChild(i).getChildCount()}`);
        }
    }

    printState() {
        console.log(`  stack size : ${this.stack.length}`);
        var top = this.stack[this.stack.length-1];
        console.log(`  ${(top ? top : 'undefined/null')}`);
    }
    */

  getResult() {
    return this.stack.pop();
  }
}

exports.jsonCustomListener = jsonCustomListener;
