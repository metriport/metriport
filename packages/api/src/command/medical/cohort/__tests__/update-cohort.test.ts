import { faker } from "@faker-js/faker";
import { NotFoundError } from "@metriport/shared";
import { CohortUpdateCmd, DEFAULT_COLOR, DEFAULT_SETTINGS } from "@metriport/shared/domain/cohort";
import { updateCohort } from "../update-cohort";
import * as CohortModel from "../../../../models/medical/cohort";
import * as getCohortSizeModule from "../patient-cohort/get-cohort-size";
import * as utils from "../utils";
import * as defaultModel from "../../../../models/_default";
import * as mergeSettingsModule from "@metriport/shared/common/merge-settings";

const mockCohortModelFindOne = jest.fn();
const mockGetCohortSize = jest.fn();
const mockValidateMonitoringSettingsForCx = jest.fn();
const mockValidateVersionForUpdate = jest.fn();
const mockMergeSettings = jest.fn();

jest.spyOn(CohortModel.CohortModel, "findOne").mockImplementation(mockCohortModelFindOne);
jest.spyOn(getCohortSizeModule, "getCohortSize").mockImplementation(mockGetCohortSize);
jest
  .spyOn(utils, "validateMonitoringSettingsForCx")
  .mockImplementation(mockValidateMonitoringSettingsForCx);
jest
  .spyOn(defaultModel, "validateVersionForUpdate")
  .mockImplementation(mockValidateVersionForUpdate);
jest.spyOn(mergeSettingsModule, "mergeSettings").mockImplementation(mockMergeSettings);

describe("updateCohort", () => {
  const cxId = faker.string.uuid();
  const cohortId = faker.string.uuid();
  const eTag = faker.string.uuid();
  const mockCohort = {
    id: cohortId,
    cxId,
    name: faker.word.noun(),
    description: faker.lorem.sentence(),
    color: DEFAULT_COLOR,
    settings: DEFAULT_SETTINGS,
    update: jest.fn(),
    dataValues: {
      id: cohortId,
      cxId,
      name: faker.word.noun(),
      description: faker.lorem.sentence(),
      color: DEFAULT_COLOR,
      settings: DEFAULT_SETTINGS,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCohortModelFindOne.mockResolvedValue(mockCohort);
    mockCohort.update.mockResolvedValue(mockCohort);
    mockGetCohortSize.mockResolvedValue(5);
    mockValidateMonitoringSettingsForCx.mockResolvedValue(undefined);
    mockValidateVersionForUpdate.mockReturnValue(undefined);
    mockMergeSettings.mockReturnValue(DEFAULT_SETTINGS);
  });

  describe("Happy path", () => {
    it("updates a cohort with full object", async () => {
      const updateData: CohortUpdateCmd = {
        id: cohortId,
        cxId,
        eTag,
        name: faker.word.noun(),
        description: faker.lorem.sentence(),
        color: DEFAULT_COLOR,
        settings: DEFAULT_SETTINGS,
      };

      const result = await updateCohort(updateData);

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { id: cohortId, cxId },
      });
      expect(mockValidateVersionForUpdate).toHaveBeenCalledWith(mockCohort, eTag);
      expect(mockValidateMonitoringSettingsForCx).toHaveBeenCalledWith(
        cxId,
        DEFAULT_SETTINGS.monitoring,
        expect.any(Function)
      );
      expect(mockMergeSettings).toHaveBeenCalledWith(mockCohort.settings, DEFAULT_SETTINGS);
      expect(mockCohort.update).toHaveBeenCalledWith({
        name: updateData.name,
        description: updateData.description,
        color: updateData.color,
        settings: DEFAULT_SETTINGS,
      });
      expect(mockGetCohortSize).toHaveBeenCalledWith({ cohortId });
      expect(result).toEqual({ ...mockCohort.dataValues, size: 5 });
    });
  });

  describe("Error scenarios", () => {
    it("throws NotFoundError when cohort not found", async () => {
      mockCohortModelFindOne.mockResolvedValue(undefined);

      const updateData: CohortUpdateCmd = {
        id: cohortId,
        cxId,
        eTag,
        name: faker.word.noun(),
        settings: DEFAULT_SETTINGS,
      };

      await expect(updateCohort(updateData)).rejects.toThrow(
        new NotFoundError("Could not find cohort", undefined, { cohortId })
      );

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { id: cohortId, cxId },
      });
      expect(mockValidateVersionForUpdate).not.toHaveBeenCalled();
      expect(mockCohort.update).not.toHaveBeenCalled();
    });

    it("throws error when monitoring settings validation fails", async () => {
      mockValidateMonitoringSettingsForCx.mockRejectedValue(
        new Error("Invalid monitoring settings")
      );

      const updateData: CohortUpdateCmd = {
        id: cohortId,
        cxId,
        eTag,
        name: faker.word.noun(),
        settings: DEFAULT_SETTINGS,
      };

      await expect(updateCohort(updateData)).rejects.toThrow("Invalid monitoring settings");

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { id: cohortId, cxId },
      });
      expect(mockValidateVersionForUpdate).toHaveBeenCalledWith(mockCohort, eTag);
      expect(mockValidateMonitoringSettingsForCx).toHaveBeenCalledWith(
        cxId,
        DEFAULT_SETTINGS.monitoring,
        expect.any(Function)
      );
      expect(mockCohort.update).not.toHaveBeenCalled();
    });
  });
});
