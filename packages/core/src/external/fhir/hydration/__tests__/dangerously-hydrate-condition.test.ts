import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { ICD_10_URL, SNOMED_URL } from "@metriport/shared/medical";
import * as termServer from "../../../term-server";
import { dangerouslyHydrateCondition } from "../hydrate-fhir";

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

    await dangerouslyHydrateCondition(condition);

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: snomedCode,
      sourceSystem: SNOMED_URL,
      targetSystem: ICD_10_URL,
    });

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

    await dangerouslyHydrateCondition(condition);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
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

    await dangerouslyHydrateCondition(condition);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
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

    await dangerouslyHydrateCondition(condition);

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: snomedCode,
      sourceSystem: SNOMED_URL,
      targetSystem: ICD_10_URL,
    });

    expect(condition.code?.coding).toHaveLength(1);
  });

  it("should handle missing code property", async () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: faker.string.uuid(),
    };

    await dangerouslyHydrateCondition(condition);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code).toBeUndefined();
  });

  it("should handle missing coding array", async () => {
    const condition: Condition = {
      resourceType: "Condition",
      id: faker.string.uuid(),
      code: {},
    };

    await dangerouslyHydrateCondition(condition);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(condition.code?.coding).toBeUndefined();
  });

  it("should handle crosswalkCode throwing an error", async () => {
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

    mockCrosswalkCode.mockRejectedValue(new Error("Crosswalk failed"));

    await expect(dangerouslyHydrateCondition(condition)).rejects.toThrow("Crosswalk failed");
  });
});
