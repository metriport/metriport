/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { eHexUrlPrefix } from "@metriport/core/external/carequality/ihe-gateway-v2/gateways";
import { Facility } from "../../../../domain/medical/facility";
import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import { HieInitiator } from "../../../hie/get-hie-initiator";
import { CQLink } from "../../cq-patient-data";
import { makeCqDataLink } from "../../__tests__/cq-patient-data";
import { createOutboundDocumentQueryRequests } from "../create-outbound-document-query-req";

let requestId: string;
let facilityId: string;
let facility: Facility;
let patient: Patient;
let organization: Organization;
let cxId: string;
let initiator: HieInitiator;
let cqLink: CQLink;

describe("createOutboundDocumentQueryReq", () => {
  beforeEach(() => {
    cxId = faker.string.uuid();
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
    cqLink = makeCqDataLink();
  });

  it("returns 1 req when non ehex gateway", () => {
    const result = createOutboundDocumentQueryRequests({
      initiator,
      patient,
      cxId,
      requestId,
      cqLinks: [cqLink],
    });
    expect(result).toHaveLength(1);
  });
  it("returns 10 req when ehex gateway", () => {
    cqLink.url = eHexUrlPrefix;
    const result = createOutboundDocumentQueryRequests({
      initiator,
      patient,
      cxId,
      requestId,
      cqLinks: [cqLink],
    });
    expect(result).toHaveLength(10);
  });
});
