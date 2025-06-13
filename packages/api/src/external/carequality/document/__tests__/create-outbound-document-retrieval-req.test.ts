/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import {
  defaultDocRefsPerRequest,
  epicOidPrefix,
  redoxOidPrefix,
  surescriptsOid,
} from "@metriport/core/external/carequality/ihe-gateway-v2/gateways";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { Facility, FacilityType } from "../../../../domain/medical/facility";
import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import { HieInitiator } from "../../../hie/get-hie-initiator";
import { createOutboundDocumentRetrievalReqs } from "../create-outbound-document-retrieval-req";
import { makeDocumentReferenceWithMetriportId } from "./make-document-reference-with-metriport-id";
import { makeOutboundDocumentQueryResp, makeXcaGateway } from "./shared";

let requestId: string;
let facilityId: string;
let facility: Facility;
let patient: Patient;
let organization: Organization;
let homeCommunityId: string;
let initiator: HieInitiator;

describe("outboundDocumentRetrievalRequest", () => {
  beforeEach(() => {
    requestId = faker.string.uuid();
    facilityId = faker.string.uuid();
    facility = makeFacility({ id: facilityId });
    patient = makePatient({ facilityIds: [facilityId] });
    organization = makeOrganization();
    initiator = {
      oid: organization.oid,
      name: organization.data.name,
      npi: facility.data.npi,
      facilityId: facility.id,
      orgName: organization.data.name,
    };
    homeCommunityId = faker.string.uuid();
  });

  it("returns 1 req with 2 doc refs when no doc refs match GW homeCommunityId", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId }),
        documentReference: [
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
        ],
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(1);
    expect(res[0].documentReference.length).toEqual(2);
  });

  it("returns 1 req with 6 doc refs when we have an epic gw", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: epicOidPrefix }),
        documentReference: [
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
        ],
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(1);
    expect(res[0].documentReference.length).toEqual(6);
  });

  it("returns 2 req with 11 doc refs when we have an epic gw", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: epicOidPrefix }),
        documentReference: [
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
        ],
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);
    expect(res[0].documentReference.length).toEqual(9);
    expect(res[1].documentReference.length).toEqual(2);
  });

  it("returns 2 req with 1 doc refs when we have an surescripts gw", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: surescriptsOid }),
        documentReference: [
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
        ],
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);
    expect(res[0].documentReference.length).toEqual(1);
    expect(res[1].documentReference.length).toEqual(1);
  });

  it("returns 2 req with 1 doc refs when we have an redox prefix gw", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: redoxOidPrefix }),
        documentReference: [
          makeDocumentReferenceWithMetriportId(),
          makeDocumentReferenceWithMetriportId(),
        ],
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);
    expect(res[0].documentReference.length).toEqual(1);
    expect(res[1].documentReference.length).toEqual(1);
  });

  it("returns one req when doc refs within limit", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId }),
        ],
      }),
    ];
    facility = makeFacility({
      id: facilityId,
      cwType: FacilityType.initiatorOnly,
      cqType: FacilityType.initiatorOnly,
    });
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });

    expect(res).toBeTruthy();
    expect(res.length).toEqual(outboundDocumentQueryResps.length);
  });

  it("returns two req when it gets doc refs for two reqs", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId }),
        documentReference: [...Array(defaultDocRefsPerRequest + 1).keys()].map(() =>
          makeDocumentReferenceWithMetriportId({ homeCommunityId })
        ),
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);
  });

  it("returns three req when it gets doc refs for three reqs", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId }),
        documentReference: [...Array(defaultDocRefsPerRequest * 2 + 1).keys()].map(() =>
          makeDocumentReferenceWithMetriportId({ homeCommunityId })
        ),
      }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(3);
  });

  it("uses facility details for saml attributes for obo facilities", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId }),
        ],
      }),
    ];
    facility = makeFacility({
      ...facility,
      cwType: FacilityType.initiatorOnly,
      cqType: FacilityType.initiatorOnly,
    });
    initiator = { ...initiator, name: facility.data.name, oid: facility.oid };
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });

    expect(res[0].samlAttributes.organization).toEqual(facility.data.name);
    expect(res[0].samlAttributes.organizationId).toEqual(facility.oid);
    expect(res[0].samlAttributes.homeCommunityId).toEqual(facility.oid);
  });

  it("uses org details for saml attributes for non-obo facilities", async () => {
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId }),
        ],
      }),
    ];
    facility = makeFacility({
      ...facility,
      cwType: FacilityType.initiatorOnly,
      cqType: FacilityType.initiatorOnly,
    });
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });

    expect(res[0].samlAttributes.organization).toEqual(organization.data.name);
    expect(res[0].samlAttributes.organizationId).toEqual(organization.oid);
    expect(res[0].samlAttributes.homeCommunityId).toEqual(organization.oid);
  });
});

describe("correct responses with multiple outboundDocumentQueryResps, where the doc refs have the same homeCommunityId as their respective gateways", () => {
  it("returns correct data for each query response", async () => {
    const homeCommunityId1 = faker.string.uuid();
    const homeCommunityId2 = faker.string.uuid();
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: homeCommunityId1 }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId1 }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId1 }),
        ],
      }),
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: homeCommunityId2 }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId2 }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId2 }),
        ],
      }),
    ];

    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });

    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);

    expect(res[0]?.documentReference?.length).toEqual(2);
    expect(res[0]?.documentReference).toEqual(outboundDocumentQueryResps[0]?.documentReference);

    expect(res[1]?.documentReference?.length).toEqual(2);
    expect(res[1]?.documentReference).toEqual(outboundDocumentQueryResps[1]?.documentReference);
  });
  it("correct responses with multiple outboundDocumentQueryResps, where the doc refs for one gateway have different home community ids", async () => {
    const homeCommunityId1 = faker.string.uuid();
    const homeCommunityId2 = faker.string.uuid();
    const homeCommunityId3 = faker.string.uuid();
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: homeCommunityId1 }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId3 }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId3 }),
        ],
      }),
      makeOutboundDocumentQueryResp({
        gateway: makeXcaGateway({ homeCommunityId: homeCommunityId2 }),
        documentReference: [
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId2 }),
          makeDocumentReferenceWithMetriportId({ homeCommunityId: homeCommunityId2 }),
        ],
      }),
    ];

    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      patient,
      requestId,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResps,
    });

    expect(res).toBeTruthy();
    expect(res.length).toEqual(2);

    expect(res[0]?.documentReference?.length).toEqual(2);
    expect(res[0]?.documentReference).toEqual(outboundDocumentQueryResps[0]?.documentReference);

    expect(res[1]?.documentReference?.length).toEqual(2);
    expect(res[1]?.documentReference).toEqual(outboundDocumentQueryResps[1]?.documentReference);
  });
});
