import { faker } from "@faker-js/faker";
import { Condition, Encounter } from "@medplum/fhirtypes";
import { ICD_10_URL, SNOMED_URL } from "@metriport/shared/medical";
import * as termServer from "../../../../term-server";
import {
  CONDITION_CATEGORY_SYSTEM_URL,
  dangerouslyHydrateCondition,
  ENCOUNTER_DIAGNOSIS_CATEGORY_CODE,
  PROBLEM_LIST_CATEGORY_CODE,
} from "../condition";
import { makeEncounter } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeCondition } from "../../../../../fhir-to-cda/cda-templates/components/__tests__/make-condition";

let mockCrosswalkCode: jest.SpyInstance;

describe("dangerouslyHydrateCondition", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCrosswalkCode = jest.spyOn(termServer, "crosswalkCode");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

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

    mockCrosswalkCode.mockResolvedValue({
      system: ICD_10_URL,
      code: icd10Code,
    });

    await dangerouslyHydrateCondition(condition, []);

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: snomedCode,
      sourceSystem: SNOMED_URL,
      targetSystem: ICD_10_URL,
    });

    expect(condition.code?.coding).toBeDefined();
    expect(condition.code?.coding).toHaveLength(2);
    expect(condition.code?.coding?.[1]).toEqual({
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

    await dangerouslyHydrateCondition(condition, []);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code?.coding).toBeDefined();
    expect(condition.code?.coding).toHaveLength(1);
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

    await dangerouslyHydrateCondition(condition, []);

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

    await dangerouslyHydrateCondition(condition, []);

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

    await dangerouslyHydrateCondition(condition, []);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code).toBeUndefined();
  });

  it("should handle missing coding array", async () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: faker.string.uuid(),
      code: {},
    };

    await dangerouslyHydrateCondition(condition, []);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code?.coding).toBeUndefined();
  });

  describe("buildUpdatedCategory", () => {
    it("should update the category to problem-list-item by default", async () => {
      const condition = makeCondition();

      await dangerouslyHydrateCondition(condition, []);

      expect(condition.category).toBeDefined();
      expect(condition.category).toHaveLength(1);
      expect(condition.category?.[0]?.coding).toHaveLength(1);
      expect(condition.category?.[0]?.coding?.[0]?.system).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.system).toBe(CONDITION_CATEGORY_SYSTEM_URL);
      expect(condition.category?.[0]?.coding?.[0]?.code).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.code).toBe(PROBLEM_LIST_CATEGORY_CODE);
    });

    it("should update the category to encounter-diagnosis if the condition is an encounter diagnosis", async () => {
      const condition = makeCondition();

      const encounters: Encounter[] = [
        makeEncounter({
          diagnosis: [{ condition: { reference: `Condition/${condition.id}` } }],
        }),
      ];

      await dangerouslyHydrateCondition(condition, encounters);

      expect(condition.category).toBeDefined();
      expect(condition.category).toHaveLength(1);
      expect(condition.category?.[0]?.coding).toHaveLength(1);
      expect(condition.category?.[0]?.coding?.[0]?.system).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.system).toBe(CONDITION_CATEGORY_SYSTEM_URL);
      expect(condition.category?.[0]?.coding?.[0]?.code).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.code).toBe(ENCOUNTER_DIAGNOSIS_CATEGORY_CODE);
    });

    it("should update the category to problem-list-item based on ICD-10 code, even if it's an encounter diagnosis", async () => {
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

      await dangerouslyHydrateCondition(condition, encounters);

      expect(condition.category).toBeDefined();
      expect(condition.category).toHaveLength(1);
      expect(condition.category?.[0]?.coding).toHaveLength(1);
      expect(condition.category?.[0]?.coding?.[0]?.system).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.system).toBe(CONDITION_CATEGORY_SYSTEM_URL);
      expect(condition.category?.[0]?.coding?.[0]?.code).toBeDefined();
      expect(condition.category?.[0]?.coding?.[0]?.code).toBe(PROBLEM_LIST_CATEGORY_CODE);
    });
  });
});
