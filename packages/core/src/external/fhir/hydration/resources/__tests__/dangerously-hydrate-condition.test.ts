import { faker } from "@faker-js/faker";
import { Coding, Condition, Encounter } from "@medplum/fhirtypes";
import {
  CONDITION_CATEGORY_SYSTEM_URL,
  CONDITION_CLINICAL_STATUS_URL,
  ICD_10_URL,
  SNOMED_URL,
} from "@metriport/shared/medical";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";
import { makeEncounter } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import * as termServer from "../../../../term-server";
import { isCcsrCoding } from "../../../shared/ccsr";
import {
  buildUpdatedClinicalStatus,
  dangerouslyHydrateCondition,
  ENCOUNTER_DIAGNOSIS_CATEGORY_CODE,
  PROBLEM_LIST_CATEGORY_CODE,
} from "../condition";

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  appendFileSync: jest.fn(),
}));

let mockCrosswalkCode: jest.SpyInstance;
let mockLookupByDisplay: jest.SpyInstance;

describe("dangerouslyHydrateCondition", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCrosswalkCode = jest.spyOn(termServer, "crosswalkCode");
    mockLookupByDisplay = jest.spyOn(termServer, "lookupByDisplay");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("should add ICD-10 code and category when SNOMED code exists but no ICD-10 code", async () => {
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

    mockCrosswalkCode.mockResolvedValue({
      system: ICD_10_URL,
      code: icd10Code,
    });

    await dangerouslyHydrateCondition({ condition, encounters: [] });

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: snomedCode,
      sourceSystem: SNOMED_URL,
      targetSystem: ICD_10_URL,
    });

    expect(condition.code?.coding).toBeDefined();
    expect(condition.code?.coding).toHaveLength(4);

    const icd10Coding = condition.code?.coding?.find(coding => coding.system === ICD_10_URL);
    expect(icd10Coding?.code).toBe(icd10Code);
    expect(icd10Coding?.system).toBe(ICD_10_URL);

    const ccsrCodings = condition.code?.coding?.filter(isCcsrCoding);
    expect(ccsrCodings?.length).toBe(2);
    const ccsrCodes = ccsrCodings?.map(c => c.code).sort();
    expect(ccsrCodes).toEqual(["CIR005", "INF003"]);

    expect(condition.category).toHaveLength(2);

    const ccsrCategories = condition.category?.filter(cat => cat.coding?.some(isCcsrCoding));
    if (!ccsrCategories) throw new Error("CCSR category not found");

    const ccsrCategoryCodes = ccsrCategories
      .map(cat => cat.coding?.map(c => c.code))
      .flat()
      .sort();
    expect(ccsrCategoryCodes).toEqual(["CIR", "INF"]);
  });

  it("should not add ICD-10 code when SNOMED code is missing", async () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: faker.string.uuid(),
      code: {
        coding: [
          {
            system: ICD_10_URL,
            code: "A12.345",
            display: "Test condition",
          },
        ],
      },
    };

    await dangerouslyHydrateCondition({ condition, encounters: [] });

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code?.coding).toBeDefined();
    expect(condition.code?.coding).toHaveLength(1);
  });

  it("should not add ICD-10 code when ICD-10 code already exists", async () => {
    const snomedCode = "123456789";
    const existingIcd10Code = "A12.345";
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

    await dangerouslyHydrateCondition({ condition, encounters: [] });

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code?.coding).toBeDefined();
    expect(condition.code?.coding).toHaveLength(2);
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

    mockCrosswalkCode.mockResolvedValue(undefined);

    await dangerouslyHydrateCondition({ condition, encounters: [] });

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: snomedCode,
      sourceSystem: SNOMED_URL,
      targetSystem: ICD_10_URL,
    });

    expect(condition.code?.coding).toBeDefined();
    expect(condition.code?.coding).toHaveLength(1);
  });

  it("should handle missing code property", async () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: faker.string.uuid(),
    };

    await dangerouslyHydrateCondition({ condition, encounters: [] });

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code).toBeUndefined();
  });

  it("should handle missing coding array", async () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: faker.string.uuid(),
      code: {},
    };

    await dangerouslyHydrateCondition({ condition, encounters: [] });

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code?.coding).toBeUndefined();
  });

  describe("lookupByDisplay fallback", () => {
    it("should add ICD-10 code via display lookup when crosswalk returns nothing", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: "999999",
              display: "Hyperlipidemia",
            },
          ],
        },
      };

      mockCrosswalkCode.mockResolvedValue(undefined);
      mockLookupByDisplay.mockResolvedValue({
        system: ICD_10_URL,
        code: "E78.5",
        display: "Hyperlipidemia, unspecified",
      });

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockCrosswalkCode).toHaveBeenCalled();
      expect(mockLookupByDisplay).toHaveBeenCalledWith({
        display: "Hyperlipidemia",
        system: ICD_10_URL,
      });

      const icd10Coding = condition.code?.coding?.find(c => c.system === ICD_10_URL);
      expect(icd10Coding).toBeDefined();
      expect(icd10Coding?.code).toBe("E78.5");
    });

    it("should not call lookupByDisplay when crosswalk already produced ICD-10 code", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: "123456789",
              display: "Some condition",
            },
          ],
        },
      };

      mockCrosswalkCode.mockResolvedValue({
        system: ICD_10_URL,
        code: "A36.81",
      });

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockLookupByDisplay).not.toHaveBeenCalled();
    });

    it("should not call lookupByDisplay when ICD-10 code already exists", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: ICD_10_URL,
              code: "A12.345",
              display: "Existing condition",
            },
          ],
        },
      };

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockLookupByDisplay).not.toHaveBeenCalled();
    });

    it("should not call lookupByDisplay for vague display terms", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: "999999",
              display: "Problem",
            },
          ],
        },
      };

      mockCrosswalkCode.mockResolvedValue(undefined);

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockLookupByDisplay).not.toHaveBeenCalled();
    });

    it("should not call lookupByDisplay when coding has no useful display", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: "999999",
            },
          ],
        },
      };

      mockCrosswalkCode.mockResolvedValue(undefined);

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockLookupByDisplay).not.toHaveBeenCalled();
    });

    it("should use code.text as fallback when coding has no useful display", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          text: "Anemia",
          coding: [
            {
              system: SNOMED_URL,
              code: "999999",
            },
          ],
        },
      };

      mockCrosswalkCode.mockResolvedValue(undefined);
      mockLookupByDisplay.mockResolvedValue({
        system: ICD_10_URL,
        code: "D64.9",
        display: "Anemia, unspecified",
      });

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockLookupByDisplay).toHaveBeenCalledWith({
        display: "Anemia",
        system: ICD_10_URL,
      });

      const icd10Coding = condition.code?.coding?.find(c => c.system === ICD_10_URL);
      expect(icd10Coding?.code).toBe("D64.9");
    });

    it("should not add code when lookupByDisplay returns undefined", async () => {
      const condition: Condition = {
        resourceType: "Condition",
        id: faker.string.uuid(),
        code: {
          coding: [
            {
              system: SNOMED_URL,
              code: "999999",
              display: "Very rare condition",
            },
          ],
        },
      };

      mockCrosswalkCode.mockResolvedValue(undefined);
      mockLookupByDisplay.mockResolvedValue(undefined);

      await dangerouslyHydrateCondition({
        condition,
        encounters: [],
        lookupCodeByDisplay: true,
      });

      expect(mockLookupByDisplay).toHaveBeenCalled();
      expect(condition.code?.coding).toHaveLength(1);
    });
  });

  describe("buildUpdatedCategory", () => {
    it("should not create a category if it cannot be determined", async () => {
      const condition = makeCondition();

      await dangerouslyHydrateCondition({ condition, encounters: [] });

      expect(condition.category).toBeUndefined();
    });

    it("should create a category with the encounter-diagnosis code if the condition is an encounter diagnosis", async () => {
      const condition = makeCondition();

      const encounters: Encounter[] = [
        makeEncounter({
          diagnosis: [{ condition: { reference: `Condition/${condition.id}` } }],
        }),
      ];

      await dangerouslyHydrateCondition({ condition, encounters });

      expect(condition.category).toBeDefined();
      expect(condition.category).toHaveLength(1);
      expect(condition.category?.[0]?.coding).toHaveLength(1);
      expect(condition.category?.[0]?.coding?.[0]?.system).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.system).toBe(CONDITION_CATEGORY_SYSTEM_URL);
      expect(condition.category?.[0]?.coding?.[0]?.code).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.code).toBe(ENCOUNTER_DIAGNOSIS_CATEGORY_CODE);
    });

    it("should update the category to problem-list-item based on ICD-10 code, even if it's referenced in an encounter", async () => {
      const condition = makeCondition({
        code: {
          coding: [{ system: ICD_10_URL, code: "Z82.61", display: "Family history of arthritis" }],
        },
      });
      const encounters: Encounter[] = [
        makeEncounter({
          diagnosis: [{ condition: { reference: `Condition/${condition.id}` } }],
        }),
      ];

      await dangerouslyHydrateCondition({ condition, encounters });

      expect(condition.category).toBeDefined();
      expect(condition.category).toHaveLength(2);

      const hl7Category = condition.category?.find(cat =>
        cat.coding?.some(isHl7ConditionCategoryCoding)
      );
      if (!hl7Category) throw new Error("HL7 category not found");

      expect(hl7Category).toBeDefined();
      expect(hl7Category.coding).toHaveLength(1);
      expect(hl7Category.coding?.[0]?.system).toBe(CONDITION_CATEGORY_SYSTEM_URL);
      expect(hl7Category.coding?.[0]?.code).toBe(PROBLEM_LIST_CATEGORY_CODE);
    });

    it("should create a category with the problem-list-item code if the condition is a problem-list-item", async () => {
      const condition = makeCondition({
        code: { text: "Family history of arthritis" },
      });

      await dangerouslyHydrateCondition({ condition, encounters: [] });

      expect(condition.category).toBeDefined();
      expect(condition.category).toHaveLength(1);
      expect(condition.category?.[0]?.coding).toHaveLength(1);
      expect(condition.category?.[0]?.coding?.[0]?.system).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.system).toBe(CONDITION_CATEGORY_SYSTEM_URL);
      expect(condition.category?.[0]?.coding?.[0]?.code).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.code).toBe(PROBLEM_LIST_CATEGORY_CODE);
    });
  });

  describe("buildUpdatedClinicalStatus", () => {
    it("should update the clinical status to active when the clinical status is active", async () => {
      const clinicalStatus = {
        coding: [{ system: SNOMED_URL, code: "55561003" }],
      };

      const result = buildUpdatedClinicalStatus(clinicalStatus);

      expect(result).toBeDefined();
      expect(result?.coding?.[0]?.system).toBe(CONDITION_CLINICAL_STATUS_URL);
      expect(result?.coding?.[0]?.code).toBe("active");
      expect(result?.coding?.[1]?.system).toBe(SNOMED_URL);
      expect(result?.coding?.[1]?.code).toBe("55561003");
    });
  });
});

function isHl7ConditionCategoryCoding(coding: Coding): boolean {
  return coding.system === CONDITION_CATEGORY_SYSTEM_URL;
}
