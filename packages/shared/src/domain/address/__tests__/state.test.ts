import { normalizeStateSafe, USState } from "../state";

describe("state", () => {
  describe("normalizeStateSafe", () => {
    it("should convert long name to USState", () => {
      const input = "Arizona";
      const expectedOutput = USState.AZ;
      expect(normalizeStateSafe(input)).toEqual(expectedOutput);
    });

    it("should convert long name case insentitive to USState", () => {
      const input = "aRiZonA";
      const expectedOutput = USState.AZ;
      expect(normalizeStateSafe(input)).toEqual(expectedOutput);
    });

    for (const usState of Object.values(USState)) {
      it(`should convert ${usState} to USState`, () => {
        const input = usState;
        const expectedOutput = usState;
        expect(normalizeStateSafe(input)).toEqual(expectedOutput);
      });
    }

    it("should return undefined if can't match a US state", () => {
      const input = "Ariz";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });

    it("should return undefined if gets an empty string", () => {
      const input = "";
      expect(normalizeStateSafe(input)).toBeUndefined();
    });
  });
});
