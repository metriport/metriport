import { faker } from "@faker-js/faker";
import { BadRequestError, NotFoundError } from "@metriport/shared";
import * as CohortModel from "../../../../models/medical/cohort";
import { deleteCohort } from "../delete-cohort";
import * as getCohortSizeModule from "../patient-cohort/get-cohort-size";

jest.mock("../../../../models/medical/cohort", () => ({
  CohortModel: {
    destroy: jest.fn(),
  },
}));

const mockGetCohortSize = jest.spyOn(getCohortSizeModule, "getCohortSize") as jest.MockedFunction<
  typeof getCohortSizeModule.getCohortSize
>;
const mockCohortModelDestroy = jest.spyOn(CohortModel.CohortModel, "destroy");

describe("deleteCohort", () => {
  const cxId = faker.string.uuid();
  const cohortId = faker.string.uuid();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCohortModelDestroy.mockResolvedValue(1);
    mockGetCohortSize.mockResolvedValue(0);
  });

  describe("Happy path", () => {
    it("deletes cohort successfully", async () => {
      mockGetCohortSize.mockResolvedValue(0);

      await deleteCohort({ cohortId, cxId });

      expect(mockGetCohortSize).toHaveBeenCalledWith({
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
      mockGetCohortSize.mockRejectedValue(
        new NotFoundError("Could not find cohort", undefined, { id: cohortId })
      );

      await expect(deleteCohort({ cohortId, cxId })).rejects.toThrow(
        new NotFoundError("Could not find cohort", undefined, { id: cohortId })
      );
      expect(mockCohortModelDestroy).not.toHaveBeenCalled();
    });

    it("throws error when cohort has patients", async () => {
      const size = 2;
      mockGetCohortSize.mockResolvedValue(size);

      await expect(deleteCohort({ cohortId, cxId })).rejects.toThrow(
        new BadRequestError("Cannot delete cohort with patients", undefined, {
          cohortId,
          size,
        })
      );
      expect(mockCohortModelDestroy).not.toHaveBeenCalled();
    });
  });
});
