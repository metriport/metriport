/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { CommonWell } from "@metriport/commonwell-sdk-v1/client/commonwell";
import { CertificateResp } from "@metriport/commonwell-sdk-v1/models/certificates";
import { Organization } from "@metriport/commonwell-sdk-v1/models/organization";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { TreatmentType } from "@metriport/shared";
import { FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import { Config } from "../../../shared/config";
import * as api from "../api";
import { createOrUpdateFacilityInCw } from "../command/create-or-update-cw-facility";
import * as createOrUpdateCwOrg from "../command/create-or-update-cw-organization";
import { buildCwOrgNameForFacility } from "../shared";

let createOrUpdateCqOrganizationMock: jest.SpyInstance;

const mockedFacility = makeFacility({
  cqType: FacilityType.initiatorAndResponder,
  cqActive: true,
  cqOboOid: undefined,
  cwType: FacilityType.initiatorAndResponder,
  cwActive: true,
  cwOboOid: undefined,
});

const mockedOboFacility = makeFacility({
  cqType: FacilityType.initiatorOnly,
  cqActive: true,
  cqOboOid: faker.string.uuid(),
  cwType: FacilityType.initiatorOnly,
  cwActive: true,
  cwOboOid: faker.string.uuid(),
});

jest.spyOn(CommonWell.prototype, "getOneOrg").mockImplementation(() => Promise.resolve(undefined));
jest
  .spyOn(CommonWell.prototype, "createOrg")
  .mockImplementation(() => Promise.resolve({} as Organization));
jest
  .spyOn(CommonWell.prototype, "addCertificateToOrg")
  .mockImplementation(() => Promise.resolve({} as CertificateResp));
jest.spyOn(api, "getCertificate").mockImplementation(() => {
  return { Certificates: [] };
});
jest.spyOn(Config, "getGatewayEndpoint").mockImplementation(() => "");
jest.spyOn(Config, "getGatewayAuthorizationServerEndpoint").mockImplementation(() => "");
jest.spyOn(Config, "getGatewayAuthorizationClientId").mockImplementation(() => "");
jest.spyOn(Config, "getGatewayAuthorizationClientSecret").mockImplementation(() => "");
jest.spyOn(Config, "getCWOrgPrivateKey").mockImplementation(() => "");
jest.spyOn(Config, "getCWOrgCertificate").mockImplementation(() => "");
jest.spyOn(Config, "getCWMemberPrivateKey").mockImplementation(() => "");
jest.spyOn(Config, "getCWMemberCertificate").mockImplementation(() => "");
jest.spyOn(Config, "getCWMemberOrgName").mockImplementation(() => "");
jest.spyOn(Config, "getCWMemberOID").mockImplementation(() => "");

beforeEach(() => {
  createOrUpdateCqOrganizationMock = jest.spyOn(
    createOrUpdateCwOrg,
    "createOrUpdateCWOrganization"
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("registerFacility", () => {
  it("calls hie creates with expected params when createOrUpdateFacilityInCw is called - non-obo", async () => {
    const cxId = uuidv7_file.uuidv4();

    const cxOrgName = "Test";
    const cxOrgType = TreatmentType.acuteCare;

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
    const cxOrgType = TreatmentType.acuteCare;

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
