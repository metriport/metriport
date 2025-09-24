import { faker } from "@faker-js/faker";
import { Bundle, Condition, Medication } from "@medplum/fhirtypes";
import { ICD_10_URL, NDC_URL, RXNORM_URL, SNOMED_URL } from "@metriport/shared/medical";
import * as termServer from "../../../term-server";
import * as codeableConcept from "../../codeable-concept";
import { hydrateFhir } from "../hydrate-fhir";

let mockCrosswalkCode: jest.SpyInstance;
let mockLookupMultipleCodes: jest.SpyInstance;
let mockFindCodeableConcepts: jest.SpyInstance;

describe("hydrateFhir", () => {
  const mockLog = jest.fn();

  beforeEach(() => {
    jest.restoreAllMocks();
    mockCrosswalkCode = jest.spyOn(termServer, "crosswalkCode");
    mockLookupMultipleCodes = jest.spyOn(termServer, "lookupMultipleCodes");
    mockFindCodeableConcepts = jest.spyOn(codeableConcept, "findCodeableConcepts");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("dangerouslyHydrateCondition", () => {
    it("should add ICD-10 code when SNOMED code exists but no ICD-10 code", async () => {
      const snomedCode = "123456789";
      const icd10Code = "A36.81";
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: snomedCode,
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockCrosswalkCode.mockResolvedValue({
        system: ICD_10_URL,
        code: icd10Code,
      });

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).toHaveBeenCalledWith({
        sourceCode: snomedCode,
        sourceSystem: SNOMED_URL,
        targetSystem: ICD_10_URL,
      });

      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(2);
      expect(hydratedCondition?.code?.coding?.[1]).toEqual({
        system: ICD_10_URL,
        code: icd10Code,
      });
    });

    it("should not add ICD-10 code when SNOMED code is missing", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: ICD_10_URL,
              code: "A36.81",
              display: "Test condition",
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(1);
    });

    it("should not add ICD-10 code when ICD-10 code already exists", async () => {
      const snomedCode = "123456789";
      const existingIcd10Code = "A36.81";
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: snomedCode,
              display: "Test condition",
            },
            {
              system: ICD_10_URL,
              code: existingIcd10Code,
              display: "Existing ICD-10 condition",
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(2);
    });

    it("should not add ICD-10 code when crosswalkCode returns null", async () => {
      const snomedCode = "123456789";
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: snomedCode,
              display: "Test condition",
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockCrosswalkCode.mockResolvedValue(undefined);
      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).toHaveBeenCalledWith({
        sourceCode: snomedCode,
        sourceSystem: SNOMED_URL,
        targetSystem: ICD_10_URL,
      });

      const hydratedCondition = result.data.entry?.[0]?.resource as Condition;
      expect(hydratedCondition?.code?.coding).toHaveLength(1);
    });
  });

  describe("dangerouslyHydrateMedication", () => {
    it("should add RXNorm code when NDC code exists but no RXNorm code", async () => {
      const ndcCode = "12345-678-90";
      const rxNormCode = "123456";
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: NDC_URL,
              code: ndcCode,
            },
          ],
        },
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockCrosswalkCode.mockResolvedValueOnce({
        system: RXNORM_URL,
        code: rxNormCode,
      });

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).toHaveBeenCalledWith({
        sourceCode: ndcCode,
        sourceSystem: NDC_URL,
        targetSystem: RXNORM_URL,
      });

      const hydratedMedication = result.data.entry?.[0]?.resource as Medication;
      expect(hydratedMedication?.code?.coding).toHaveLength(2);
      expect(hydratedMedication?.code?.coding?.[1]).toEqual({
        system: RXNORM_URL,
        code: rxNormCode,
      });
    });

    it("should not add RXNorm code when NDC code is missing", async () => {
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: RXNORM_URL,
              code: "123456",
            },
          ],
        },
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      const hydratedMedication = result.data.entry?.[0]?.resource as Medication;
      expect(hydratedMedication?.code?.coding).toHaveLength(1);
    });

    it("should not add RXNorm code when RXNorm code already exists", async () => {
      const ndcCode = "12345-678-90";
      const existingRxNormCode = "123456";
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: NDC_URL,
              code: ndcCode,
            },
            {
              system: RXNORM_URL,
              code: existingRxNormCode,
            },
          ],
        },
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      const hydratedMedication = result.data.entry?.[0]?.resource as Medication;
      expect(hydratedMedication?.code?.coding).toHaveLength(2);
    });

    it("should not add RXNorm code when crosswalkCode returns null", async () => {
      const ndcCode = "12345-678-90";
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: NDC_URL,
              code: ndcCode,
            },
          ],
        },
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockCrosswalkCode.mockResolvedValue(undefined);
      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).toHaveBeenCalledWith({
        sourceCode: ndcCode,
        sourceSystem: NDC_URL,
        targetSystem: RXNORM_URL,
      });

      const hydratedMedication = result.data.entry?.[0]?.resource as Medication;
      expect(hydratedMedication?.code?.coding).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should handle non-Condition and non-Medication resources", async () => {
      const bundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Patient",
              id: faker.string.uuid(),
            },
          },
        ],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      expect(result.data).toEqual(bundle);
    });

    it("should handle missing code property in Condition", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      expect(result.data).toEqual(bundle);
    });

    it("should handle missing code property in Medication", async () => {
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      expect(result.data).toEqual(bundle);
    });

    it("should handle missing coding array in Condition", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {},
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      expect(result.data).toEqual(bundle);
    });

    it("should handle missing coding array in Medication", async () => {
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {},
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      const result = await hydrateFhir(bundle, mockLog);

      expect(mockCrosswalkCode).not.toHaveBeenCalled();
      expect(result.data).toEqual(bundle);
    });
  });

  describe("error handling", () => {
    it("should handle crosswalkCode throwing an error for Condition", async () => {
      const snomedCode = "123456789";
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: snomedCode,
              display: "Test condition",
            },
          ],
        },
      };

      const bundle: Bundle<Condition> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: condition }],
      };

      mockCrosswalkCode.mockRejectedValue(new Error("Crosswalk failed"));
      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      await expect(hydrateFhir(bundle, mockLog)).rejects.toThrow("Crosswalk failed");
    });

    it("should handle crosswalkCode throwing an error for Medication", async () => {
      const ndcCode = "12345-678-90";
      const medication: Medication = {
        resourceType: "Medication",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: NDC_URL,
              code: ndcCode,
            },
          ],
        },
      };

      const bundle: Bundle<Medication> = {
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: medication }],
      };

      mockCrosswalkCode.mockRejectedValue(new Error("Crosswalk failed"));
      mockFindCodeableConcepts.mockReturnValue([]);
      mockLookupMultipleCodes.mockResolvedValue({
        data: [],
        metadata: {},
      });

      await expect(hydrateFhir(bundle, mockLog)).rejects.toThrow("Crosswalk failed");
    });
  });
});
