import { faker } from "@faker-js/faker";
import { Medication } from "@medplum/fhirtypes";
import { NDC_URL, RXNORM_URL } from "@metriport/shared/medical";
import * as termServer from "../../../term-server";
import { dangerouslyHydrateMedication } from "../hydrate-fhir";

let mockCrosswalkCode: jest.SpyInstance;

describe("dangerouslyHydrateMedication", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCrosswalkCode = jest.spyOn(termServer, "crosswalkCode");
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

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

    mockCrosswalkCode.mockResolvedValue({
      system: RXNORM_URL,
      code: rxNormCode,
    });

    await dangerouslyHydrateMedication(medication);

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: ndcCode,
      sourceSystem: NDC_URL,
      targetSystem: RXNORM_URL,
    });

    expect(medication.code?.coding).toBeDefined();
    expect(medication.code?.coding).toHaveLength(2);
    expect(medication.code?.coding?.[1]).toEqual({
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

    await dangerouslyHydrateMedication(medication);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(medication.code?.coding).toBeDefined();
    expect(medication.code?.coding).toHaveLength(1);
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

    await dangerouslyHydrateMedication(medication);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(medication.code?.coding).toBeDefined();
    expect(medication.code?.coding).toHaveLength(2);
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

    mockCrosswalkCode.mockResolvedValue(undefined);

    await dangerouslyHydrateMedication(medication);

    expect(mockCrosswalkCode).toHaveBeenCalledWith({
      sourceCode: ndcCode,
      sourceSystem: NDC_URL,
      targetSystem: RXNORM_URL,
    });

    expect(medication.code?.coding).toBeDefined();
    expect(medication.code?.coding).toHaveLength(1);
  });

  it("should handle missing code property", async () => {
    const medication: Medication = {
      resourceType: "Medication",
      id: faker.string.uuid(),
    };

    await dangerouslyHydrateMedication(medication);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(medication.code).toBeUndefined();
  });

  it("should handle missing coding array", async () => {
    const medication: Medication = {
      resourceType: "Medication",
      id: faker.string.uuid(),
      code: {},
    };

    await dangerouslyHydrateMedication(medication);

    expect(mockCrosswalkCode).not.toHaveBeenCalled();
    expect(medication.code?.coding).toBeUndefined();
  });
});
