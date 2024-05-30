// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var inputs = require("./extract-range-templates");
var helpers = require("../handlebars-helpers").external;

describe("Handlebars helpers", function () {
  var opTests = [
    {
      f: "extractReferenceRange",
      desc: "Should process x:type IVL_PQ",
      in: [inputs.typeIvlPq],
      out: inputs.typeIvlPqOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process x:type IVL_PQ with nullFlavor limits",
      in: [inputs.nullFlavorOth],
      out: inputs.nullFlavorOthOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process x:type IVL_PQ with only the upper limit",
      in: [inputs.lessThan],
      out: inputs.lessThanOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process x:type IVL_PQ with value inside translation",
      in: [inputs.valueInTranslation],
      out: inputs.valueInTranslationOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process x:type ST with non-numeric value",
      in: [inputs.typeStNonNumeric],
      out: inputs.typeStNonNumericOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process x:type IVL_REAL",
      in: [inputs.typeIvlReal],
      out: inputs.typeIvlRealOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process x:type ST with mixed values",
      in: [inputs.typeStMixed],
      out: inputs.typeStMixedOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should process text if value is empty",
      in: [inputs.missingValue],
      out: inputs.typeStMixedOutput,
    },
    {
      f: "extractReferenceRange",
      desc: "Should return undefined when input is empty",
      in: [{}],
      out: undefined,
    },
  ];

  opTests.forEach(t => {
    it(
      t.desc ??
        t.f + "\n\tWith input:" + JSON.stringify(t.in) + "\n\tMust return:" + JSON.stringify(t.out),
      function (done) {
        var out = getHelper(t.f).func(...t.in);
        if (JSON.stringify(t.out) === JSON.stringify(out)) {
          done();
        } else {
          done(
            new Error(
              t.f + "\n\tExpected:" + JSON.stringify(t.out) + "\n\tActual: " + JSON.stringify(out)
            )
          );
        }
      }
    );
  });

  var opErrorTests = [];

  opErrorTests.forEach(t => {
    it(t.f + "(" + t.in.join(",") + ") should throw error", function (done) {
      try {
        var out = getHelper(t.f).func(...t.in);
        done(new Error(t.f + "(" + t.in.join(",") + ") does not throw. Returns: " + out));
      } catch (err) {
        if (err.toString().includes(t.f)) {
          done();
        } else {
          done(new Error(`missing function name in error message`));
        }
      }
    });
  });
});

function getHelper(helperName) {
  for (var i = 0; i < helpers.length; i++) {
    if (helpers[i].name === helperName) {
      return helpers[i];
    }
  }
}
