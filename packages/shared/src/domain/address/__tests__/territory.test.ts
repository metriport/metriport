import { normalizeTerritorySafe, USTerritory } from "../territory";

describe("territory", () => {
  describe("normalizeTerritorySafe", () => {
    it("should convert long name to USTerritory", () => {
      const input = "Guam";
      const expectedOutput = USTerritory.GU;
      expect(normalizeTerritorySafe(input)).toEqual(expectedOutput);
    });

    it("should convert long name case insentitive to USTerritory", () => {
      const input = "GuAm";
      const expectedOutput = USTerritory.GU;
      expect(normalizeTerritorySafe(input)).toEqual(expectedOutput);
    });

    describe(`should convert to USTerritory`, () => {
      for (const usTerritory of Object.values(USTerritory)) {
        it(usTerritory, () => {
          const input = usTerritory;
          const expectedOutput = usTerritory;
          expect(normalizeTerritorySafe(input)).toEqual(expectedOutput);
        });
      }
    });

    it("should return undefined if can't match a US territory", () => {
      const input = "Gua";
      expect(normalizeTerritorySafe(input)).toBeUndefined();
    });

    it("should return undefined if gets an empty string", () => {
      const input = "";
      expect(normalizeTerritorySafe(input)).toBeUndefined();
    });
  });
});
