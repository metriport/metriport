/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getCxMappingSourceFromJwtTokenSource } from "../../command/mapping/cx";

describe("Cx Mapping command", () => {
  describe("getCxMappingSourceFromJwtTokenSource", () => {
    const validSources = [
      "canvas",
      "canvas-client",
      "canvas-webhook",
      "athenahealth",
      "athenahealth-client",
      "elation",
      "elation-client",
      "elation-webhook",
    ];

    for (const source of validSources) {
      it(`returns the correct source for ${source}`, () => {
        const result = getCxMappingSourceFromJwtTokenSource(source);
        expect(result).toEqual(source.split("-")[0]);
      });
    }

    const invalidSources = ["bogus", "bogus-client", "bogus-webhook", "athenahealth-webhook"];

    for (const source of invalidSources) {
      it(`throws an error for ${source}`, () => {
        expect(() => getCxMappingSourceFromJwtTokenSource(source)).toThrow();
      });
    }
  });
});
