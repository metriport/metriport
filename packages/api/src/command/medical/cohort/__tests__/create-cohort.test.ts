import { faker } from "@faker-js/faker";
import { BadRequestError } from "@metriport/shared";
import { CohortCreateCmd, DEFAULT_COLOR, DEFAULT_SETTINGS } from "@metriport/shared/domain/cohort";
import { createCohort } from "../create-cohort";
import { getCohortByNameSafe } from "../get-cohort";
import * as CohortModel from "../../../../models/medical/cohort";
import * as utils from "../utils";

jest.mock("../get-cohort");
const mockGetCohortByNameSafe = getCohortByNameSafe as jest.MockedFunction<
  typeof getCohortByNameSafe
>;
const mockCohortModelCreate = jest.spyOn(CohortModel.CohortModel, "create");
const mockValidateMonitoringSettingsForCx = jest.spyOn(utils, "validateMonitoringSettingsForCx");

describe("createCohort", () => {
  const cxId = faker.string.uuid();
  const mockCohort = {
    id: faker.string.uuid(),
    cxId,
    name: faker.word.noun(),
    description: faker.lorem.sentence(),
    color: DEFAULT_COLOR,
    settings: DEFAULT_SETTINGS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCohortModelCreate.mockResolvedValue({ dataValues: mockCohort });
    mockValidateMonitoringSettingsForCx.mockResolvedValue(undefined);
  });

  describe("Happy path", () => {
    it("creates a cohort with full object", async () => {
      mockGetCohortByNameSafe.mockResolvedValue(undefined);

      const cohortData: CohortCreateCmd = {
        cxId,
        name: faker.word.noun(),
        description: faker.lorem.sentence(),
        color: DEFAULT_COLOR,
        settings: DEFAULT_SETTINGS,
      };

      const result = await createCohort(cohortData);

      expect(mockGetCohortByNameSafe).toHaveBeenCalledWith({
        cxId,
        name: cohortData.name,
      });
      expect(mockCohortModelCreate).toHaveBeenCalledWith({
        id: expect.any(String),
        cxId,
        name: cohortData.name,
        description: cohortData.description,
        color: cohortData.color,
        settings: cohortData.settings,
      });
      expect(result).toEqual(mockCohort);
    });

    it("creates a cohort with minimal required fields", async () => {
      mockGetCohortByNameSafe.mockResolvedValue(undefined);

      const cohortData: CohortCreateCmd = {
        cxId,
        name: faker.word.noun(),
        color: DEFAULT_COLOR,
        settings: DEFAULT_SETTINGS,
      };

      const result = await createCohort(cohortData);

      expect(mockGetCohortByNameSafe).toHaveBeenCalledWith({
        cxId,
        name: cohortData.name,
      });
      expect(mockCohortModelCreate).toHaveBeenCalledWith({
        id: expect.any(String),
        cxId,
        name: cohortData.name,
        description: undefined,
        color: DEFAULT_COLOR,
        settings: DEFAULT_SETTINGS,
      });
      expect(result).toEqual(mockCohort);
    });
  });

  describe("Error scenarios", () => {
    it("throws BadRequestError when cohort name already exists", async () => {
      const existingCohort = {
        id: faker.string.uuid(),
        cxId,
        name: "existing-cohort",
        color: "white" as const,
        description: "",
        settings: DEFAULT_SETTINGS,
        eTag: faker.string.uuid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetCohortByNameSafe.mockResolvedValue(existingCohort);

      const cohortData: CohortCreateCmd = {
        cxId,
        name: "existing-cohort",
        color: DEFAULT_COLOR,
        settings: DEFAULT_SETTINGS,
      };

      await expect(createCohort(cohortData)).rejects.toThrow(
        new BadRequestError("A cohort with this name already exists", undefined, {
          existingCohortId: existingCohort.id,
          name: "existing-cohort",
        })
      );

      expect(mockGetCohortByNameSafe).toHaveBeenCalledWith({
        cxId,
        name: "existing-cohort",
      });
      expect(mockCohortModelCreate).not.toHaveBeenCalled();
    });

    it("throws error when monitoring settings validation fails", async () => {
      mockGetCohortByNameSafe.mockResolvedValue(undefined);
      mockValidateMonitoringSettingsForCx.mockRejectedValue(
        new BadRequestError("Invalid monitoring settings")
      );

      const cohortData: CohortCreateCmd = {
        cxId,
        name: faker.word.noun(),
        color: DEFAULT_COLOR,
        settings: {
          monitoring: {
            adt: false,
            hie: { enabled: true, frequency: "monthly" },
            pharmacy: {
              notifications: true,
              schedule: {
                enabled: true,
                frequency: "weekly",
              },
            },
            laboratory: {
              notifications: false,
              schedule: {
                enabled: false,
                frequency: "monthly",
              },
            },
          },
        },
      };

      await expect(createCohort(cohortData)).rejects.toThrow("Invalid monitoring settings");
    });
  });
});
