import { FacilityType } from "../../../../domain/medical/facility";
import { FacilityModel } from "../../../../models/medical/facility";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { createFacility, validateCreate } from "../create-facility";
import { makeFacilityCreate, makeFacilityCreateCmd } from "./create-facility";

describe("createFacility", () => {
  describe("createFacility", () => {
    let facilityModel_create: jest.SpyInstance;
    beforeEach(() => {
      jest.restoreAllMocks();
      mockStartTransaction();
      facilityModel_create = jest.spyOn(FacilityModel, "create").mockImplementation(async f => f);
    });

    it("creates facility when no OBO data is provided", async () => {
      const facilityCreate = makeFacilityCreateCmd({
        cwType: null,
        cqType: null,
        cqOboActive: null,
        cwOboActive: null,
        cqOboOid: null,
        cwOboOid: null,
      });
      await createFacility(facilityCreate);
      expect(facilityModel_create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...facilityCreate,
          cwType: FacilityType.initiatorAndResponder,
          cqType: FacilityType.initiatorAndResponder,
          cqOboActive: false,
          cwOboActive: false,
          cqOboOid: null,
          cwOboOid: null,
        })
      );
    });

    it("creates facility with provided data", async () => {
      const facilityCreate = makeFacilityCreateCmd();
      await createFacility(facilityCreate);
      expect(facilityModel_create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...facilityCreate,
          cqOboOid: facilityCreate.cqOboOid ?? null,
          cwOboOid: facilityCreate.cwOboOid ?? null,
        })
      );
    });

    it("makeFacilityCreateCmd and OBO", async () => {
      const facilityCreate = makeFacilityCreateCmd({
        cwType: FacilityType.initiatorOnly,
        cqType: FacilityType.initiatorOnly,
      });
      expect(facilityCreate).toEqual(
        expect.objectContaining({
          cqOboActive: true,
          cwOboActive: true,
        })
      );
      expect(facilityCreate.cqOboOid).toBeDefined();
      expect(facilityCreate.cwOboOid).toBeDefined();
    });
  });

  describe("validateCreate", () => {
    it("throws when non-OBO and CW OBO is active", async () => {
      const facility = makeFacilityCreate({
        cwType: FacilityType.initiatorAndResponder,
        cqOboActive: false,
        cwOboActive: true,
      });
      expect(() => validateCreate(facility)).toThrow("CW Non-OBO facility cannot have OBO active");
    });

    it("throws when non-OBO and CQ OBO is active", async () => {
      const facility = makeFacilityCreate({
        cqType: FacilityType.initiatorAndResponder,
        cqOboActive: true,
        cwOboActive: false,
      });
      expect(() => validateCreate(facility)).toThrow("CQ Non-OBO facility cannot have OBO active");
    });

    it("throws when CQ OBO is active but no CQ OID", async () => {
      const facility = makeFacilityCreate({
        cqType: FacilityType.initiatorOnly,
        cqOboActive: true,
        cqOboOid: null,
      });
      expect(() => validateCreate(facility)).toThrow(
        "Facility must have CQ OBO OID when CQ OBO active"
      );
    });

    it("throws when CW OBO is active but no CW OID", async () => {
      const facility = makeFacilityCreate({
        cwType: FacilityType.initiatorOnly,
        cwOboActive: true,
        cwOboOid: null,
      });
      expect(() => validateCreate(facility)).toThrow(
        "Facility must have CW OBO OID when CW OBO active"
      );
    });
  });
});
