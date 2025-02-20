// -------------------------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See LICENSE in the repo root for license information.
// -------------------------------------------------------------------------------------------------

var inputs = require("./extract-range-templates");
var presentedForm = require("./build-presented-form-templates");
var helpers = require("../handlebars-helpers").external;
var functions = require("../handlebars-helpers").internal;

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
    {
      f: "buildPresentedForm",
      desc: "Returns empty array if nothing is passed",
      in: [],
      out: undefined,
    },
    {
      f: "buildPresentedForm",
      desc: "Returns empty array if undefined is passed",
      in: [undefined, undefined],
      out: undefined,
    },
    {
      f: "buildPresentedForm",
      desc: "Returns presentedForm entry with b64 string if one is provided",
      in: [presentedForm.b64String],
      out: JSON.stringify(presentedForm.makePresentedFormEntry([presentedForm.b64String])),
    },
    {
      f: "buildPresentedForm",
      desc: "Returns presentedForm entry with b64 string if one is provided together with an empty component",
      in: [presentedForm.b64String, presentedForm.emptyComponent],
      out: JSON.stringify(presentedForm.makePresentedFormEntry([presentedForm.b64String])),
    },
    {
      f: "buildPresentedForm",
      desc: "Returns empty array if empty component is provided",
      in: [undefined, presentedForm.componentWithEmptyObservations],
      out: undefined,
    },
    {
      f: "buildPresentedForm",
      desc: "Returns presentedForm entry with b64 strings if they are provided",
      in: [undefined, presentedForm.component],
      out: JSON.stringify(
        presentedForm.makePresentedFormEntry([
          presentedForm.b64StringValuable,
          presentedForm.b64StringProtected,
        ])
      ),
    },
    {
      f: "buildPresentedForm",
      desc: "Correctly combines the inputs to return presentedForm with b64 strings",
      in: [presentedForm.b64String, presentedForm.component],
      out: JSON.stringify(
        presentedForm.makePresentedFormEntry([
          presentedForm.b64String,
          presentedForm.b64StringValuable,
          presentedForm.b64StringProtected,
        ])
      ),
    },
    {
      f: "buildPresentedForm",
      desc: "Correctly handles the component that's not an array and returns presentedForm with b64 strings",
      in: [presentedForm.b64String, ...presentedForm.component],
      out: JSON.stringify(
        presentedForm.makePresentedFormEntry([
          presentedForm.b64String,
          presentedForm.b64StringValuable,
        ])
      ),
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

describe("getDateTime", function () {
  it("should render date if full dateTimeString", function () {
    var date = functions.getDateTime("20240711220795");
    expect(date).toEqual("2024-07-11T22:08:35.000Z");
  });

  it("should render date if full dateTimeString with space in front", function () {
    var date = functions.getDateTime(" 20240711220795");
    expect(date).toEqual("2024-07-11T22:08:35.000Z");
  });

  it("should render date if full dateTimeString with space in back", function () {
    var date = functions.getDateTime("20240711220795 ");
    expect(date).toEqual("2024-07-11T22:08:35.000Z");
  });

  it("should render date if only year, month, day", function () {
    var date = functions.getDateTime("20240710");
    expect(date).toEqual("2024-07-10T00:00:00.000Z");
  });

  it("should render date if only year, month", function () {
    var date = functions.getDateTime("202407");
    expect(date).toEqual("2024-07-01T00:00:00.000Z");
  });

  it("should render date if only year", function () {
    var date = functions.getDateTime("2024");
    expect(date).toEqual("2024-01-01T00:00:00.000Z");
  });

  it("should render date if full dateTimeString with timezone", function () {
    var date = functions.getDateTime("20230626150846-0400");
    expect(date).toEqual("2023-06-26T19:08:46.000Z");
  });

  it("should render date if full dateTimeString with timezone and seconds", function () {
    var date = functions.getDateTime("20230626150846.123-0400");
    expect(date).toEqual("2023-06-26T19:08:46.123Z");
  });

  it("should render nothing when has year but bad month", function () {
    var date = functions.getDateTime("20243");
    expect(date).toEqual("");
  });

  it("should render nothing when just one number", function () {
    var date = functions.getDateTime("4");
    expect(date).toEqual("");
  });

  it("should render nothing when its letters", function () {
    var date = functions.getDateTime("abcdefg");
    expect(date).toEqual("");
  });

  it("should render nothing when its numbers and one letter", function () {
    var date = functions.getDateTime("2024a0304");
    expect(date).toEqual("");
  });

  it("should render nothing empty string", function () {
    var date = functions.getDateTime("");
    expect(date).toEqual("");
  });

  it("should render nothing if date before 1900", function () {
    var date = functions.getDateTime("18991231");
    expect(date).toEqual("");
  });

  it("should render date when ISO YYYY-MM-DD", function () {
    var date = functions.getDateTime("2023-06-26");
    expect(date).toEqual("2023-06-26");
  });

  it("should render date when ISO YYYY-MM-DDTHH:MM:SS", function () {
    var date = functions.getDateTime("2023-06-26T19:08:46");
    expect(date).toEqual("2023-06-26T19:08:46");
  });

  it("should render date when ISO YYYY-MM-DDTHH:MM:SS.MMM", function () {
    var date = functions.getDateTime("2023-06-26T19:08:46.000");
    expect(date).toEqual("2023-06-26T19:08:46.000");
  });

  it("should render date when ISO YYYY-MM-DDTHH:MM:SS.MMMZ", function () {
    var date = functions.getDateTime("2023-06-26T19:08:46.000Z");
    expect(date).toEqual("2023-06-26T19:08:46.000Z");
  });

  it("should render date when ISO YYYY-MM-DDTHH:MM:SS.MMM-0300", function () {
    var date = functions.getDateTime("2023-06-26T19:08:46.000-0300");
    expect(date).toEqual("2023-06-26T19:08:46.000-0300");
  });

  it("should render date when incomplete ISO YYYY-MM-DD HH:MM:SS", function () {
    var date = functions.getDateTime("2023-06-26 19:08:46");
    expect(date).toEqual("2023-06-26T19:08:46.000Z");
  });

  it("should render date when ISO YYYY-MM-DD HH:MM:SS.MMMZ", function () {
    var date = functions.getDateTime("2023-06-26 19:08:46.000Z");
    expect(date).toEqual("2023-06-26T19:08:46.000Z");
  });

  it("should render date when valid date on invalid dateTimeString", function () {
    var date = functions.getDateTime("20240714040785-0400");
    expect(date).toEqual("2024-07-14T00:00:00.000Z");
  });

  it("should render nothing when invalid dateTimeString", function () {
    var date = functions.getDateTime("a202407140407f");
    expect(date).toEqual("");
  });

  it("should render date when gets a Date object", function () {
    var date = functions.getDateTime(new Date("2023-06-26T19:08:46.000Z"));
    expect(date).toEqual("2023-06-26T19:08:46.000Z");
  });

  it("should render date when gets a non-Date object that has a value prop", function () {
    var date = functions.getDateTime({ value: "20230626150846-0400" });
    expect(date).toEqual("2023-06-26T19:08:46.000Z");
  });

  it("should render nothing when gets a non-Date object that has a value prop that's undefined", function () {
    var date = functions.getDateTime({ value: undefined });
    expect(date).toEqual("");
  });

  it("should render nothing when gets a non-Date object", function () {
    var date = functions.getDateTime({ a: "123" });
    expect(date).toEqual("");
  });

  it("should render nothing when gets undefined", function () {
    var date = functions.getDateTime(undefined);
    expect(date).toEqual("");
  });

  it("should render nothing when gets null", function () {
    var date = functions.getDateTime(null);
    expect(date).toEqual("");
  });
});

describe("extractReferenceRange", function () {
  const extractReferenceRange = helpers.find(h => h.name === "extractReferenceRange").func;

  it("should process range with low and high values", function () {
    const input = {
      unit: 'mg',
      low: { value: "325", unit: "mg" },
      high: { value: "650", unit: "mg" },
    };    
    const expectedOutput = {
      low: { value: "325", unit: "mg" },
      high: { value: "650", unit: "mg" },
    };
    expect(extractReferenceRange(input)).toEqual(expectedOutput);
  });
  it("should process range with just low", function () {
    const input = {
      unit: 'mg',
      low: { value: "325", unit: "mg" },
    };    
    const expectedOutput = {
      low: { value: "325", unit: "mg" },
    };
    expect(extractReferenceRange(input)).toEqual(expectedOutput);
  });
  it("should process range with just high", function () {
    const input = {
      unit: 'mg',
      high: { value: "650", unit: "mg" },
    };    
    const expectedOutput = {
      high: { value: "650", unit: "mg" },
    };
    expect(extractReferenceRange(input)).toEqual(expectedOutput);
  });
});

describe("extractDecimal", function () {
  const extractDecimal = helpers.find(h => h.name === "extractDecimal").func;

  it("should return undefined for null or undefined input", function () {
    expect(extractDecimal(null)).toBeUndefined();
    expect(extractDecimal(undefined)).toBeUndefined();
  });

  it("should return undefined for non-decimal strings", function () {
    expect(extractDecimal("abc")).toBeUndefined();
    expect(extractDecimal("123a")).toBeUndefined();
    expect(extractDecimal("12.34.56")).toBeUndefined();
  });

  it("should return correct value for valid decimal strings", function () {
    expect(extractDecimal("123")).toBe(123);
    expect(extractDecimal("123.45")).toBe(123.45);
    expect(extractDecimal("-123.45")).toBe(-123.45);
    expect(extractDecimal("123.45")).toBe(123.45);
  });

  it("should correctly handle leading decimal point", function () {
    expect(extractDecimal(".45")).toBe(0.45);
    expect(extractDecimal("-.45")).toBe(-0.45);
  });

  it("should correctly handle zero values", function () {
    expect(extractDecimal("0")).toBe(0);
    expect(extractDecimal("0.0")).toBe(0.0);
  });
});

function getHelper(helperName) {
  for (var i = 0; i < helpers.length; i++) {
    if (helpers[i].name === helperName) {
      return helpers[i];
    }
  }
}
