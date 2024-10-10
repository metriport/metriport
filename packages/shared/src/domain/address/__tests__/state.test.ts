import { normalizeStateSafe } from "../state";

describe("country", () => {
  describe("normalizeCountrySafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });

    const expectedState = "NY";
    const states = [expectedState, "ny", "New York", "new york", "NEW YORK", "New york"];
    for (const state of states) {
      it(`valid - ${state}`, () => {
        const result = normalizeStateSafe(state);
        expect(result).toBe(expectedState);
      });
    }

    it("should trim input prefix", () => {
      const expectedOutput = expectedState;
      const input = " " + expectedOutput;
      expect(normalizeStateSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = expectedState;
      const input = expectedOutput + " ";
      expect(normalizeStateSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined when it gets invalid state", () => {
      const input = "ZZ";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });
  });
});
