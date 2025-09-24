import { faker } from "@faker-js/faker";
import { Bundle, Condition, Medication } from "@medplum/fhirtypes";
import { ICD_10_URL, NDC_URL, RXNORM_URL, SNOMED_URL } from "@metriport/shared/medical";
import * as termServer from "../../../term-server";
import { hydrateFhir } from "../hydrate-fhir";

// These tests won't run on CI because they require a terminology server to be running.
describe.skip("hydrateFhir - Integration Tests", () => {
  const mockLog = jest.fn();
  const staphSnomedCode = "13790001000004101";
  const staphIcd10Code = "B95.62";
  const hydrogenPeroxideNdcCode = "59050-268-00";
  const hydrogenPeroxideRxNormCode = "91348";

  describe("crosswalkCode integration", () => {
    it("should successfully crosswalk SNOMED 13790001000004101 to ICD-10 B95.62 using terminology server", async () => {
      const result = await termServer.crosswalkCode({
        sourceCode: staphSnomedCode,
        sourceSystem: SNOMED_URL,
        targetSystem: ICD_10_URL,
      });

      expect(result).toBeDefined();
      expect(result?.system).toBe(ICD_10_URL);
      expect(result?.code).toBe(staphIcd10Code);
    });

    it("should hydrate Condition with crosswalkCode integration", async () => {
      const icd10Code = staphIcd10Code;
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: staphSnomedCode,
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      const result = await hydrateFhir(bundle, mockLog);

      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(2);

      const icd10Coding = hydratedCondition?.code?.coding?.find(
        coding => coding.system === ICD_10_URL
      );
      expect(icd10Coding?.code).toBe(icd10Code);
      expect(icd10Coding?.system).toBe(ICD_10_URL);
    });

    it("should hydrate Medication with crosswalkCode integration", async () => {
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: NDC_URL,
              code: hydrogenPeroxideNdcCode,
            },
          ],
        },
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      const result = await hydrateFhir(bundle, mockLog);

      const hydratedMedication = result.data.entry?.[0]?.resource as Medication;
      expect(hydratedMedication?.code?.coding).toHaveLength(2);

      const rxNormCoding = hydratedMedication?.code?.coding?.find(
        coding => coding.system === RXNORM_URL
      );
      expect(rxNormCoding).toBeDefined();
      expect(rxNormCoding?.system).toBe(RXNORM_URL);
      expect(rxNormCoding?.code).toBeDefined();
      expect(rxNormCoding?.code).toBe(hydrogenPeroxideRxNormCode);
      expect(rxNormCoding?.display).toBe("hydrogen peroxide 30 % Topical Solution");
    });
  });

  describe("lookupMultipleCodes integration", () => {
    it("should successfully lookup codes using terminology server", async () => {
      const mockParameters = [
        {
          resourceType: "Parameters" as const,
          id: "test-id",
          parameter: [
            { name: "system", valueUri: SNOMED_URL },
            { name: "code", valueCode: staphSnomedCode },
          ],
        },
      ];

      const result = await termServer.lookupMultipleCodes(mockParameters, mockLog);

      expect(result).toBeDefined();
      expect(result?.data).toBeDefined();
      expect(result?.metadata).toBeDefined();
      expect(result?.metadata.numParams).toBe(1);
      expect(result?.data.length).toBeGreaterThan(0);

      // Check that we got the expected SNOMED code data
      const snomedData = result?.data.find(item => item.code === staphSnomedCode);
      expect(snomedData).toBeDefined();
      expect(snomedData?.code).toBe(staphSnomedCode);
      expect(snomedData?.display).toBeDefined();
    });
  });

  describe("end-to-end hydration", () => {
    it("should hydrate a complete bundle with multiple resources", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: staphSnomedCode,
            },
          ],
        },
      };

      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: NDC_URL,
              code: hydrogenPeroxideNdcCode,
            },
          ],
        },
      };

      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }, { resource: medication }],
      };

      const result = await hydrateFhir(bundle, mockLog);

      // Verify both resources were processed
      expect(result.data.entry).toHaveLength(2);

      // Check Condition hydration
      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(2);
      const conditionIcd10 = hydratedCondition?.code?.coding?.find(
        coding => coding.system === ICD_10_URL
      );
      expect(conditionIcd10?.code).toBe(staphIcd10Code);

      // Check Medication hydration
      const hydratedMedication = result.data.entry?.[1]?.resource as Medication;
      expect(hydratedMedication?.code?.coding).toHaveLength(2);
      const medicationRxNorm = hydratedMedication?.code?.coding?.find(
        coding => coding.system === RXNORM_URL
      );
      expect(medicationRxNorm).toBeDefined();

      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.totalBundleCodes).toBeGreaterThan(0);
      expect(result.metadata?.numReplaced).toBeGreaterThan(0);
    });

    it("should handle resources that don't need hydration", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: ICD_10_URL,
              code: staphIcd10Code, // Already has ICD-10 code
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      const result = await hydrateFhir(bundle, mockLog);

      // Verify the condition wasn't modified
      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(1);
      expect(hydratedCondition?.code?.coding?.[0]?.system).toBe(ICD_10_URL);
      expect(hydratedCondition?.code?.coding?.[0]?.code).toBe(staphIcd10Code);
    });

    it("should handle empty bundle", async () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
      };

      const result = await hydrateFhir(bundle, mockLog);

      expect(result.data).toEqual(bundle);
      expect(result.metadata).toBeUndefined();
    });

    it("should handle bundle with no entries", async () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [],
      };

      const result = await hydrateFhir(bundle, mockLog);

      expect(result.data).toEqual(bundle);
      expect(result.metadata).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle invalid SNOMED codes gracefully", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: "invalid-code-12345",
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      const result = await hydrateFhir(bundle, mockLog);

      // Should not crash and should return the original bundle
      expect(result.data).toBeDefined();
      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(1);
      expect(hydratedCondition?.code?.coding?.[0]?.code).toBe("invalid-code-12345");
    });
  });
});
