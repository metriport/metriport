/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/core/domain/organization";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import {
  createOutboundDocumentRetrievalReqs,
  maxDocRefsPerDocRetrievalRequest,
} from "../create-outbound-document-retrieval-req";
import { makeDocumentReferenceWithMetriporId } from "./make-document-reference-with-metriport-id";
import { makeOutboundDocumentQueryResp, makeXcaGateway } from "./shared";

let requestId: string;
let cxId: string;
let organization: Organization;
let homeCommunityId: string;

describe("allowMapiAccess", () => {
  beforeEach(() => {
    requestId = faker.string.uuid();
    cxId = faker.string.uuid();
    organization = makeOrganization();
    homeCommunityId = faker.string.uuid();
  });

  it("returns zero req when no doc refs matching GW homeCommunityId", async () => {
    const documentReferences = [
      makeDocumentReferenceWithMetriporId(),
      makeDocumentReferenceWithMetriporId(),
    ];
    const outboundDocumentQueryResps: OutboundDocumentQueryResp[] = [
      makeOutboundDocumentQueryResp({ gateway: makeXcaGateway({ homeCommunityId }) }),
    ];
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      cxId,
      requestId,
      organization,
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
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      cxId,
      requestId,
      organization,
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
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      cxId,
      requestId,
      organization,
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
    const res: OutboundDocumentRetrievalReq[] = createOutboundDocumentRetrievalReqs({
      cxId,
      requestId,
      organization,
      documentReferences,
      outboundDocumentQueryResps,
    });
    expect(res).toBeTruthy();
    expect(res.length).toEqual(3);
  });
});
