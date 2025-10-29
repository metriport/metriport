import { faker } from "@faker-js/faker";
import { BadRequestError, DEFAULT_COLOR, DEFAULT_SETTINGS, NotFoundError } from "@metriport/shared";
import * as CohortModel from "../../../../models/medical/cohort";
import {
  getCohortByName,
  getCohortByNameSafe,
  getCohortOrFail,
  getCohortWithSizeOrFail,
  getCohorts,
  getCohortsForPatient,
} from "../get-cohort";
import { getCohortSize } from "../patient-cohort/get-cohort-size";

const mockCohortModelFindOne = jest.fn();
const mockCohortModelFindAll = jest.fn();

jest.spyOn(CohortModel.CohortModel, "findOne").mockImplementation(mockCohortModelFindOne);
jest.spyOn(CohortModel.CohortModel, "findAll").mockImplementation(mockCohortModelFindAll);

jest.mock("../patient-cohort/get-cohort-size", () => ({
  getCohortSize: jest.fn(),
}));

const mockGetCohortSize = getCohortSize as jest.MockedFunction<typeof getCohortSize>;

Object.defineProperty(CohortModel.CohortModel, "associations", {
  value: {
    PatientCohort: "PatientCohort",
  },
  writable: true,
});

describe("get-cohort functions", () => {
  const cxId = faker.string.uuid();
  const cohortId = faker.string.uuid();
  const patientId = faker.string.uuid();
  const cohortName = faker.word.noun();

  const mockCohort = {
    id: cohortId,
    cxId,
    name: cohortName,
    description: faker.lorem.sentence(),
    color: DEFAULT_COLOR,
    settings: DEFAULT_SETTINGS,
    eTag: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    dataValues: {
      id: cohortId,
      cxId,
      name: cohortName,
      description: faker.lorem.sentence(),
      color: DEFAULT_COLOR,
      settings: DEFAULT_SETTINGS,
      eTag: faker.string.uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCohortOrFail", () => {
    it("returns cohort when found", async () => {
      mockCohortModelFindOne.mockResolvedValue(mockCohort);

      const result = await getCohortOrFail({ id: cohortId, cxId });

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { id: cohortId, cxId },
      });
      expect(result).toEqual(mockCohort);
    });

    it("throws NotFoundError when cohort not found", async () => {
      mockCohortModelFindOne.mockResolvedValue(undefined);

      await expect(getCohortOrFail({ id: cohortId, cxId })).rejects.toThrow(
        new NotFoundError("Could not find cohort", undefined, { id: cohortId, cxId })
      );
    });
  });

  describe("getCohortWithSizeOrFail", () => {
    it("returns cohort with size when found", async () => {
      const cohortSize = 5;
      mockCohortModelFindOne.mockResolvedValue(mockCohort);
      mockGetCohortSize.mockResolvedValue(cohortSize);

      const result = await getCohortWithSizeOrFail({ id: cohortId, cxId });

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { id: cohortId, cxId },
      });
      expect(mockGetCohortSize).toHaveBeenCalledWith({
        cohortId,
      });
      expect(result).toEqual({
        ...mockCohort.dataValues,
        size: cohortSize,
      });
    });

    it("throws NotFoundError when cohort not found", async () => {
      mockCohortModelFindOne.mockResolvedValue(undefined);
      mockGetCohortSize.mockResolvedValue(0);

      await expect(getCohortWithSizeOrFail({ id: cohortId, cxId })).rejects.toThrow(
        new NotFoundError("Could not find cohort", undefined, { id: cohortId, cxId })
      );
    });
  });

  describe("getCohorts", () => {
    it("returns all cohorts for cxId", async () => {
      const mockCohorts = [mockCohort, { ...mockCohort, id: faker.string.uuid() }];
      mockCohortModelFindAll.mockResolvedValue(mockCohorts);

      const result = await getCohorts({ cxId });

      expect(mockCohortModelFindAll).toHaveBeenCalledWith({
        where: { cxId },
      });
      expect(result).toEqual(mockCohorts.map(c => c.dataValues));
    });

    it("returns empty array when no cohorts found", async () => {
      mockCohortModelFindAll.mockResolvedValue([]);

      const result = await getCohorts({ cxId });

      expect(result).toEqual([]);
    });
  });

  describe("getCohortsForPatient", () => {
    it("returns cohorts for specific patient", async () => {
      const mockCohorts = [mockCohort];
      mockCohortModelFindAll.mockResolvedValue(mockCohorts);

      const result = await getCohortsForPatient({ cxId, patientId });

      expect(mockCohortModelFindAll).toHaveBeenCalledWith({
        where: { cxId },
        include: [
          {
            association: CohortModel.CohortModel.associations.PatientCohort,
            where: { patientId },
            attributes: [],
            required: true,
          },
        ],
      });
      expect(result).toEqual(mockCohorts.map(c => c.dataValues));
    });

    it("returns empty array when no cohorts found for patient", async () => {
      mockCohortModelFindAll.mockResolvedValue([]);

      const result = await getCohortsForPatient({ cxId, patientId });

      expect(result).toEqual([]);
    });
  });

  describe("getCohortByName", () => {
    it("returns cohort when exactly one found", async () => {
      const trimmedName = cohortName.trim();
      mockCohortModelFindOne.mockResolvedValue(mockCohort);

      const result = await getCohortByName({ cxId, name: cohortName });

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { cxId, name: trimmedName },
      });
      expect(result).toEqual(mockCohort.dataValues);
    });


    it("trims whitespace from cohort name", async () => {
      const nameWithWhitespace = `  ${cohortName}  `;
      mockCohortModelFindOne.mockResolvedValue(mockCohort);

      await getCohortByName({ cxId, name: nameWithWhitespace });

      expect(mockCohortModelFindOne).toHaveBeenCalledWith({
        where: { cxId, name: cohortName },
      });
    });

    it("throws NotFoundError when no cohorts found", async () => {
      mockCohortModelFindAll.mockResolvedValue([]);

      await expect(getCohortByName({ cxId, name: cohortName })).rejects.toThrow(
        new NotFoundError("No cohorts found with the specified name", undefined, {
          cxId,
          name: cohortName,
        })
      );
    });

    it("throws BadRequestError when multiple cohorts found", async () => {
      const mockCohorts = [mockCohort, { ...mockCohort, id: faker.string.uuid() }];
      mockCohortModelFindAll.mockResolvedValue(mockCohorts);

      await expect(getCohortByName({ cxId, name: cohortName })).rejects.toThrow(
        new BadRequestError("Multiple cohorts found with the specified name", undefined, {
          cxId,
          name: cohortName,
        })
      );
    });
  });

  describe("getCohortByNameSafe", () => {
    it("returns cohort when exactly one found", async () => {
      mockCohortModelFindAll.mockResolvedValue([mockCohort]);

      const result = await getCohortByNameSafe({ cxId, name: cohortName });

      expect(mockCohortModelFindAll).toHaveBeenCalledWith({
        where: {
          cxId,
          name: cohortName,
        },
      });
      expect(result).toEqual(mockCohort.dataValues);
    });

    it("returns undefined when no cohorts found", async () => {
      mockCohortModelFindAll.mockResolvedValue([]);

      const result = await getCohortByNameSafe({ cxId, name: cohortName });

      expect(result).toBeUndefined();
    });

    it("returns undefined when multiple cohorts found", async () => {
      const mockCohorts = [mockCohort, { ...mockCohort, id: faker.string.uuid() }];
      mockCohortModelFindAll.mockResolvedValue(mockCohorts);

      const result = await getCohortByNameSafe({ cxId, name: cohortName });

      expect(result).toBeUndefined();
    });
  });
});
