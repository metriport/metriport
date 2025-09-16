import { getRouteCode } from "../route-codes";
import { SNOMED_URL } from "@metriport/shared/medical";

describe("Route code parser test", () => {
  it("should parse route code for basic phrases", () => {
    const oralRouteCode = getRouteCode("oral", { includeExtension: false });
    expect(oralRouteCode).toEqual({
      coding: [{ code: "26643006", display: "Oral route", system: SNOMED_URL }],
    });

    const perOsRouteCode = getRouteCode("p.o.", { includeExtension: false });
    expect(perOsRouteCode).toEqual(oralRouteCode);
  });
});
