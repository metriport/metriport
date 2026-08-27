import { FacilityType, validateDelegateFacility } from "@metriport/core/domain/facility";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { FacilityModel } from "../../../../models/medical/facility";
import { createFacility } from "../create-facility";
import { makeFacilityCreate, makeFacilityCreateCmd } from "./create-facility";

describe("createFacility", () => {
  describe("createFacility", () => {
    let facilityModel_create: jest.SpyInstance;
    beforeEach(() => {
      jest.restoreAllMocks();
      mockStartTransaction();
      jest.spyOn(FacilityModel, "findOne").mockImplementation(async () => null);
      facilityModel_create = jest.spyOn(FacilityModel, "create").mockImplementation(async f => f);
    });

    it("creates facility when no delegate data is provided", async () => {
      const facilityCreate = makeFacilityCreateCmd({
        type: null,
        cqActive: null,
        cwActive: null,
        principalOid: null,
      });
      await createFacility(facilityCreate);
      expect(facilityModel_create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...facilityCreate,
          type: FacilityType.initiatorAndResponder,
          cqActive: false,
          cwActive: false,
          principalOid: null,
        })
      );
    });

    it("creates facility with provided data", async () => {
      const facilityCreate = makeFacilityCreateCmd();
      await createFacility(facilityCreate);
      expect(facilityModel_create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...facilityCreate,
          principalOid: facilityCreate.principalOid ?? null,
        })
      );
    });

    it("makeFacilityCreateCmd and delegate", async () => {
      const facilityCreate = makeFacilityCreateCmd({
        type: FacilityType.initiatorOnly,
      });
      expect(facilityCreate).toEqual(
        expect.objectContaining({
          cqActive: true,
          cwActive: true,
        })
      );
      expect(facilityCreate.principalOid).toBeDefined();
    });
  });

  describe("validateDelegate", () => {
    it("throws when delegate, but no delegate OID is provided", async () => {
      const facility = makeFacilityCreate({
        type: FacilityType.initiatorOnly,
        principalOid: null,
      });
      expect(() =>
        validateDelegateFacility({
          type: facility.type,
          principalOid: facility.principalOid,
        })
      ).toThrow("A delegate facility must have a principal OID");
    });
  });
});
