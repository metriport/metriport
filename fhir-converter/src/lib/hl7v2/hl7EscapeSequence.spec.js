// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var assert = require("assert");
var hl7SequenceProcessor = require("./hl7EscapeSequence");

describe("hl7.EscapeSequence", function () {
  let fieldSeparator = "A";
  let componentSeparator = "B";
  let subcomponentSeparator = "C";
  let repetitionSeparator = "D";

  var unescapeTests = [
    { in: String.raw`\F\n`, out: `${fieldSeparator}n` },
    { in: String.raw`\S\n`, out: `${componentSeparator}n` },
    { in: String.raw`\T\n`, out: `${subcomponentSeparator}n` },
    { in: String.raw`\R\n`, out: `${repetitionSeparator}n` },
    { in: String.raw`\E\n`, out: String.raw`\n` },
    { in: String.raw`\.br\n`, out: String.raw`\nn` },
    { in: String.raw`\X6566\n`, out: String.raw`efn` },
  ];

  unescapeTests.forEach(t => {
    it(`hl7SequenceProcessor.Unescape(${t.in}) should return ${t.out}`, function () {
      assert.equal(
        hl7SequenceProcessor.Unescape(
          t.in,
          fieldSeparator,
          componentSeparator,
          subcomponentSeparator,
          repetitionSeparator
        ),
        t.out
      );
    });
  });
});
