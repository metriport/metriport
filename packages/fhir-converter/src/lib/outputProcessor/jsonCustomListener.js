/* eslint-disable no-undef */
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
