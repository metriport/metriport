import { faker } from "@faker-js/faker";
import { BadRequestError, NotFoundError } from "@metriport/shared";
import * as CohortModel from "../../../../models/medical/cohort";
import { deleteCohort } from "../delete-cohort";
import { getPatientIdsInCohort } from "../utils";

jest.mock("../utils");
jest.mock("../../../../models/medical/cohort", () => ({
  CohortModel: {
    destroy: jest.fn(),
  },
}));

const mockGetPatientIdsInCohort = getPatientIdsInCohort as jest.MockedFunction<
  typeof getPatientIdsInCohort
>;
const mockCohortModelDestroy = jest.spyOn(CohortModel.CohortModel, "destroy");

describe("deleteCohort", () => {
  const cxId = faker.string.uuid();
  const cohortId = faker.string.uuid();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCohortModelDestroy.mockResolvedValue(1);
  });

  describe("Happy path", () => {
    it("deletes cohort successfully", async () => {
      mockGetPatientIdsInCohort.mockResolvedValue([]);

      await deleteCohort({ id: cohortId, cxId });

      expect(mockGetPatientIdsInCohort).toHaveBeenCalledWith({
        cohortId,
        cxId,
      });
      expect(mockCohortModelDestroy).toHaveBeenCalledWith({
        where: { id: cohortId, cxId },
      });
    });
  });

  describe("Error scenarios", () => {
    it("throws error when cohort doesn't exist", async () => {
      mockCohortModelDestroy.mockResolvedValue(0);

      await expect(deleteCohort({ id: cohortId, cxId })).rejects.toThrow(
        new NotFoundError("Could not find cohort", undefined, {
          cohortId,
        })
      );
    });

    it("throws error when cohort has patients", async () => {
      const patientIds = [faker.string.uuid(), faker.string.uuid()];
      mockGetPatientIdsInCohort.mockResolvedValue(patientIds);

      await expect(deleteCohort({ id: cohortId, cxId })).rejects.toThrow(
        new BadRequestError("Cannot delete cohort with patients", undefined, {
          cohortId,
          patientIds: JSON.stringify(patientIds),
        })
      );
      expect(mockCohortModelDestroy).not.toHaveBeenCalled();
    });
  });
});
