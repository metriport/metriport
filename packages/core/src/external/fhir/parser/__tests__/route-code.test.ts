import { getRouteCode } from "../route-codes";
import { SNOMED_URL } from "@metriport/shared/medical";
import { buildParserExtension } from "../extension";

describe("Route code parser test", () => {
  it("should parse route code for basic phrases", () => {
    const oralRouteCode = getRouteCode("oral");
    expect(oralRouteCode).toEqual({
      coding: [{ code: "26643006", display: "Oral route", system: SNOMED_URL }],
      extension: [buildParserExtension("oral")],
    });

    const perOsRouteCode = getRouteCode("p.o.");
    expect(perOsRouteCode).toEqual({
      ...oralRouteCode,
      extension: [buildParserExtension("p.o.")],
    });
  });
});
