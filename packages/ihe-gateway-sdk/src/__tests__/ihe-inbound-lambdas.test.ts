import { inboundPatientDiscoveryReqSchema } from "../models/patient-discovery/patient-discovery-requests";
import { inboundDocumentQueryReqSchema } from "../models/document-query/document-query-requests";
import { inboundDocumentRetrievalReqSchema } from "../models/document-retrieval/document-retrieval-requests";
import { testInboundXCPD, testInboundDQ, testInboundDR } from "./constants";

describe("Inbound Patient Discovery Request Validation", () => {
  it("should successfully validate the testInboundXCPD object with the inboundPatientDiscoveryReqSchema", () => {
    const result = inboundPatientDiscoveryReqSchema.safeParse(testInboundXCPD);
    expect(result.success).toBe(true);
  });

  it("should successfully validate the testInboundDQ object with the inboundDocumentQueryReqSchema", () => {
    const result = inboundDocumentQueryReqSchema.safeParse(testInboundDQ);
    console.log(JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
  });

  it("should successfully validate the testInboundDR object with the inboundDocumentRetrievalReqSchema", () => {
    const result = inboundDocumentRetrievalReqSchema.safeParse(testInboundDR);
    console.log(JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
  });
});
