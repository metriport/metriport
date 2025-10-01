import { NDC_URL, SNOMED_URL } from "@metriport/shared/medical";
import { buildMappingExtension } from "../mapping-extension";

describe("mapping-extension", () => {
  describe("buildMappingExtension", () => {
    it("should build extension with source system only", () => {
      const extension = buildMappingExtension({
        sourceSystem: SNOMED_URL,
      });

      expect(extension.url).toBe(
        "https://public.metriport.com/fhir/StructureDefinition/code-mapping"
      );
      expect(extension.extension).toHaveLength(1);
      expect(extension.extension[0]).toEqual({
        url: "sourceSystem",
        valueUri: SNOMED_URL,
      });
    });

    it("should work with different source systems", () => {
      const extension = buildMappingExtension({
        sourceSystem: NDC_URL,
      });

      expect(extension.extension[0].valueUri).toBe(NDC_URL);
    });
  });
});
