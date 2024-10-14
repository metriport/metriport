import { USState, normalizeStateSafe } from "../state";

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

    const expectedState = USState.NY;
    const states = [
      expectedState,
      "ny",
      "New York",
      "new york",
      "nEw YoRk",
      "NEW YORK",
      "New york",
    ];
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

    it("should return undefined if can't match a US state (v1)", () => {
      const input = "ZZ";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });

    it("should return undefined if can't match a US state (v2)", () => {
      const input = "Ariz";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });

    it("should convert District of Columbia to DC", () => {
      const input = "District of Columbia";
      const expectedOutput = USState.DC;
      expect(normalizeStateSafe(input)).toEqual(expectedOutput);
    });

    describe(`should convert to USState`, () => {
      for (const usState of Object.values(USState)) {
        it(usState, () => {
          const input = usState;
          const expectedOutput = usState;
          expect(normalizeStateSafe(input)).toEqual(expectedOutput);
        });
      }
    });
  });
});
