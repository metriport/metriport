import { CodeableConcept } from "@medplum/fhirtypes";
import {
  makeDiagnosticReport,
  makeDiagnosticReportCategory,
} from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-diagnostic-report";
import { buildEncounterSections } from "../bundle-to-html-shared";

describe("bundle-to-html-shared", () => {
  describe("buildEncounterSections", () => {
    it("processes array category", async () => {
      const effectiveDateTime = "2024-01-01";
      const category = makeDiagnosticReportCategory();
      category.text = "LAB";
      const diagReport = makeDiagnosticReport({
        effectiveDateTime,
        category: [category],
      });
      const res = buildEncounterSections([diagReport]);
      expect(res).toEqual(
        expect.objectContaining({
          [effectiveDateTime]: { labs: [diagReport] },
        })
      );
    });

    it("processes category that's not an array (backwards compatibility)", async () => {
      const effectiveDateTime = "2024-01-01";
      const category = makeDiagnosticReportCategory();
      category.text = "LAB";
      const diagReport = makeDiagnosticReport({
        effectiveDateTime,
        category: category as CodeableConcept[],
      });
      const res = buildEncounterSections([diagReport]);
      expect(res).toEqual(
        expect.objectContaining({
          [effectiveDateTime]: { labs: [diagReport] },
        })
      );
    });
  });
});
