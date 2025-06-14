import {
  maleGender,
  femaleGender,
  otherGender,
  unknownGender,
  normalizeGender,
  normalizeGenderSafe,
} from "../gender";

const tests = [
  // male
  { input: "male", expectedOutput: maleGender },
  { input: "Male", expectedOutput: maleGender },
  { input: "m", expectedOutput: maleGender },
  { input: "M", expectedOutput: maleGender },
  // female
  { input: "female", expectedOutput: femaleGender },
  { input: "Female", expectedOutput: femaleGender },
  { input: "f", expectedOutput: femaleGender },
  { input: "F", expectedOutput: femaleGender },
  // other
  { input: "other", expectedOutput: otherGender },
  { input: "Other", expectedOutput: otherGender },
  { input: "o", expectedOutput: otherGender },
  { input: "O", expectedOutput: otherGender },
  { input: "un", expectedOutput: otherGender },
  { input: "Un", expectedOutput: otherGender },
  // unknown
  { input: "unknown", expectedOutput: unknownGender },
  { input: "Unknown", expectedOutput: unknownGender },
  { input: "u", expectedOutput: unknownGender },
  { input: "U", expectedOutput: unknownGender },
  { input: "unk", expectedOutput: unknownGender },
  { input: "Unk", expectedOutput: unknownGender },
];

describe("gender", () => {
  describe("normalizeGender", () => {
    it("should throw an error if gender is an empty string", () => {
      expect(() => normalizeGender("")).toThrow();
    });

    it("should throw an error when gets invalid gender", () => {
      expect(() => normalizeGender("something thats not a gender")).toThrow();
    });

    describe("valid inputs", () => {
      for (const { input, expectedOutput } of tests) {
        it(`should return ${expectedOutput} when input is ${input}`, () => {
          expect(normalizeGender(input)).toBe(expectedOutput);
        });
      }
    });
  });

  describe("safe normalizeGenderSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      const expectedOutput = undefined;
      expect(normalizeGenderSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined when gets invalid gender", () => {
      expect(normalizeGenderSafe("something thats not a gender")).toBeUndefined();
    });

    describe("valid inputs", () => {
      for (const { input, expectedOutput } of tests) {
        it(`should return ${expectedOutput} when input is ${input}`, () => {
          expect(normalizeGenderSafe(input)).toBe(expectedOutput);
        });
      }
    });
  });
});
