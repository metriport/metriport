/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import * as getFacilityMethods from "../../../../command/medical/facility/get-facility";
import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import { makePatient } from "../../../../domain/medical/__tests__/patient";
import { Facility, FacilityType } from "../../../../domain/medical/facility";
import {
  createOutboundDocumentRetrievalReqs,
  maxDocRefsPerDocRetrievalRequest,
} from "../create-outbound-document-retrieval-req";
import { makeDocumentReferenceWithMetriporId } from "./make-document-reference-with-metriport-id";
import { makeOutboundDocumentQueryResp, makeXcaGateway } from "./shared";
import * as getPatientMethods from "../../../../command/medical/patient/get-patient";

let requestId: string;
let facilityId: string;
let facility: Facility;
let patient: Patient;
let organization: Organization;
let homeCommunityId: string;
let getFacilityOrFailMock: jest.SpyInstance;
let getPatientWithDependencies: jest.SpyInstance;

describe("outboundDocumentRetrievalRequest", () => {
  beforeEach(() => {
    requestId = faker.string.uuid();
    facilityId = faker.string.uuid();
    facility = makeFacility({ id: facilityId });
    patient = makePatient({ facilityIds: [facilityId] });
    organization = makeOrganization();
    homeCommunityId = faker.string.uuid();
    getFacilityOrFailMock = jest.spyOn(getFacilityMethods, "getFacilityFromPatientOrFail");
    getPatientWithDependencies = jest.spyOn(getPatientMethods, "getPatientWithDependencies");
  });

  it("returns zero req when no doc refs matching GW homeCommunityId", async () => {
    const documentReferences = [
      makeDocumentReferenceWithMetriporId(),
      makeDocumentReferenceWithMetriporId(),
    ];
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    getPatientWithDependencies.mockResolvedValueOnce({ facilities: [facility], organization });
    const res: OutboundDocumentRetrievalReq[] = await createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      documentReferences,
      outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(0);
  });

  it("returns one req when doc refs within limit", async () => {
    const documentReferences = [
      makeDocumentReferenceWithMetriporId({ homeCommunityId }),
      makeDocumentReferenceWithMetriporId({ homeCommunityId }),
    ];
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    facility = makeFacility({ id: facilityId, type: FacilityType.initiatorOnly });
    getPatientWithDependencies.mockResolvedValueOnce({ facilities: [facility], organization });
    const res: OutboundDocumentRetrievalReq[] = await createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      documentReferences,
      outboundDocumentQueryResps,
    });

    expect(res).toBeTruthy();
    expect(res.length).toEqual(outboundDocumentQueryResps.length);
  });

  it("returns two req when it gets doc refs for two reqs", async () => {
    const documentReferences = [...Array(maxDocRefsPerDocRetrievalRequest + 1).keys()].map(() =>
      makeDocumentReferenceWithMetriporId({ homeCommunityId })
    );
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    getPatientWithDependencies.mockResolvedValueOnce({ facilities: [facility], organization });
    const res: OutboundDocumentRetrievalReq[] = await createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      documentReferences,
      outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);
  });

  it("returns three req when it gets doc refs for three reqs", async () => {
    const documentReferences = [...Array(maxDocRefsPerDocRetrievalRequest * 2 + 1).keys()].map(() =>
      makeDocumentReferenceWithMetriporId({ homeCommunityId })
    );
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    getPatientWithDependencies.mockResolvedValueOnce({ facilities: [facility], organization });
    const res: OutboundDocumentRetrievalReq[] = await createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      documentReferences,
      outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(3);
  });

  it("uses facility details for saml attributes for obo facilities", async () => {
    const documentReferences = [
      makeDocumentReferenceWithMetriporId({ homeCommunityId }),
      makeDocumentReferenceWithMetriporId({ homeCommunityId }),
    ];
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    facility = makeFacility({ id: facilityId, type: FacilityType.initiatorOnly });
    getFacilityOrFailMock.mockResolvedValueOnce(facility);
    getPatientWithDependencies.mockResolvedValueOnce({ facilities: [facility], organization });
    const res: OutboundDocumentRetrievalReq[] = await createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      documentReferences,
      outboundDocumentQueryResps,
    });

    expect(res[0].samlAttributes.organization).toEqual(facility.data.name);
    expect(res[0].samlAttributes.organizationId).toEqual(facility.oid);
    expect(res[0].samlAttributes.homeCommunityId).toEqual(facility.oid);
  });

  it("uses org details for saml attributes for non-obo facilities", async () => {
    const documentReferences = [
      makeDocumentReferenceWithMetriporId({ homeCommunityId }),
      makeDocumentReferenceWithMetriporId({ homeCommunityId }),
    ];
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    facility = makeFacility({ id: facilityId, type: FacilityType.initiatorAndResponder });
    getFacilityOrFailMock.mockResolvedValueOnce(facility);
    getPatientWithDependencies.mockResolvedValueOnce({ facilities: [facility], organization });
    const res: OutboundDocumentRetrievalReq[] = await createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      documentReferences,
      outboundDocumentQueryResps,
    });

    expect(res[0].samlAttributes.organization).toEqual(organization.data.name);
    expect(res[0].samlAttributes.organizationId).toEqual(organization.oid);
    expect(res[0].samlAttributes.homeCommunityId).toEqual(organization.oid);
  });
});
