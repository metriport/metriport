import {
  getTimingRepeatForLatinSigCode,
  isLatinSigCode,
} from "../rxnorm/attribute/frequency/latin-sig-code";

describe("Latin sig code test", () => {
  it("should return true for common codes", () => {
    const commonCodes = [
      "qd",
      "bid",
      "tid",
      "qid",
      "qh",
      "q2h",
      "q4h",
      "q6h",
      "qod",
      "q1d",
      "qw",
      "qm",
      "hs",
      "ac",
      "pc",
    ];
    commonCodes.forEach(code => {
      expect(isLatinSigCode(code)).toBe(true);
    });
    const notCommonCodes = ["qd1", "asdf", "invalid", "", "q"];
    notCommonCodes.forEach(code => {
      expect(isLatinSigCode(code)).toBe(false);
    });
  });

  it("should return the correct timing repeat for common codes", () => {
    expect(getTimingRepeatForLatinSigCode("qd")).toEqual({
      frequency: 1,
      period: 1,
      periodUnit: "d",
    });
    expect(getTimingRepeatForLatinSigCode("BID")).toEqual({
      frequency: 2,
      period: 1,
      periodUnit: "d",
    });
    expect(getTimingRepeatForLatinSigCode("t.i.d.")).toEqual({
      frequency: 3,
      period: 1,
      periodUnit: "d",
    });
    expect(getTimingRepeatForLatinSigCode("Q I D.")).toEqual({
      frequency: 4,
      period: 1,
      periodUnit: "d",
    });
    expect(getTimingRepeatForLatinSigCode("Q H.")).toEqual({
      frequency: 1,
      period: 1,
      periodUnit: "h",
    });
    expect(getTimingRepeatForLatinSigCode("Q2h")).toEqual({
      frequency: 1,
      period: 2,
      periodUnit: "h",
    });
    expect(getTimingRepeatForLatinSigCode("q4h")).toEqual({
      frequency: 1,
      period: 4,
      periodUnit: "h",
    });
    expect(getTimingRepeatForLatinSigCode("Q6h")).toEqual({
      frequency: 1,
      period: 6,
      periodUnit: "h",
    });
    expect(getTimingRepeatForLatinSigCode("QOD")).toEqual({
      frequency: 1,
      period: 2,
      periodUnit: "d",
    });
    expect(getTimingRepeatForLatinSigCode("Q1d")).toEqual({
      frequency: 1,
      period: 1,
      periodUnit: "d",
    });
    expect(getTimingRepeatForLatinSigCode("QW")).toEqual({
      frequency: 1,
      period: 1,
      periodUnit: "wk",
    });
    expect(getTimingRepeatForLatinSigCode("QM")).toEqual({
      frequency: 1,
      period: 1,
      periodUnit: "mo",
    });
    expect(getTimingRepeatForLatinSigCode("HS")).toEqual({ timeOfDay: ["22:00:00"] });
    expect(getTimingRepeatForLatinSigCode("AC")).toEqual({ when: ["AC"] });
    expect(getTimingRepeatForLatinSigCode("PC")).toEqual({ when: ["PC"] });
  });
});
