/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { OrgType } from "@metriport/core/domain/organization";
import { CommonWell } from "@metriport/commonwell-sdk/client/commonwell";
import { Organization } from "@metriport/commonwell-sdk/models/organization";
import { CertificateResp } from "@metriport/commonwell-sdk/models/certificates";
import { Facility, FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import { createOrUpdateFacilityInCw } from "../command/create-or-update-cw-facility";
import { buildCwOrgNameForFacility } from "../shared";
import * as createOrUpdateCwOrg from "../command/create-or-update-cw-organization";

let mockedFacility: Facility;
let mockedOboFacility: Facility;
let createOrUpdateCqOrganizationMock: jest.SpyInstance;

beforeEach(() => {
  mockedFacility = makeFacility({
    cqType: FacilityType.initiatorAndResponder,
    cqActive: false,
    cqOboOid: undefined,
    cwType: FacilityType.initiatorAndResponder,
    cwActive: true,
    cwOboOid: undefined,
  });

  mockedOboFacility = makeFacility({
    cqType: FacilityType.initiatorOnly,
    cqActive: false,
    cqOboOid: faker.string.uuid(),
    cwType: FacilityType.initiatorOnly,
    cwActive: true,
    cwOboOid: faker.string.uuid(),
  });

  jest
    .spyOn(CommonWell.prototype, "getOneOrg")
    .mockImplementation(() => Promise.resolve(undefined));
  jest
    .spyOn(CommonWell.prototype, "createOrg")
    .mockImplementation(() => Promise.resolve({} as Organization));
  jest
    .spyOn(CommonWell.prototype, "addCertificateToOrg")
    .mockImplementation(() => Promise.resolve({} as CertificateResp));
  createOrUpdateCqOrganizationMock = jest.spyOn(
    createOrUpdateCwOrg,
    "createOrUpdateCWOrganization"
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("registerFacility", () => {
  it("calls hie creates with expected params when createOrUpdateFacilityInCw is called - non-obo", async () => {
    const cxId = uuidv7_file.uuidv4();

    const cxOrgName = "Test";
    const cxOrgType = OrgType.acuteCare;

    const orgName = buildCwOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: mockedFacility.data.name,
      oboOid: mockedFacility.cwOboOid ?? undefined,
    });

    await createOrUpdateFacilityInCw({
      cxId,
      facility: mockedFacility,
      cxOrgName,
      cxOrgType,
      cwOboOid: mockedFacility.cwOboOid ?? undefined,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        org: {
          oid: mockedFacility.oid,
          data: {
            name: orgName,
            type: cxOrgType,
            location: mockedFacility.data.address,
          },
          active: mockedFacility.cwActive,
        },
        isObo: false,
      })
    );
  });

  it("calls hie creates with expected params when createOrUpdateFacilityInCw is called - obo", async () => {
    const cxId = uuidv7_file.uuidv4();

    const cxOrgName = "Test";
    const cxOrgType = OrgType.acuteCare;

    await createOrUpdateFacilityInCw({
      cxId,
      facility: mockedOboFacility,
      cxOrgName,
      cxOrgType,
      cwOboOid: mockedOboFacility.cwOboOid ?? undefined,
    });

    const orgName = buildCwOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: mockedOboFacility.data.name,
      oboOid: mockedOboFacility.cwOboOid ?? undefined,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        org: {
          oid: mockedOboFacility.oid,
          data: {
            name: orgName,
            type: cxOrgType,
            location: mockedOboFacility.data.address,
          },
          active: mockedOboFacility.cwActive,
        },
        isObo: true,
      })
    );
  });
});