import {
  inboundPatientDiscoveryReqSchema,
  outboundPatientDiscoveryReqSchema,
} from "../models/patient-discovery/patient-discovery-requests";
import {
  inboundDocumentQueryReqSchema,
  outboundDocumentQueryReqSchema,
} from "../models/document-query/document-query-requests";
import {
  inboundDocumentRetrievalReqSchema,
  outboundDocumentRetrievalReqSchema,
} from "../models/document-retrieval/document-retrieval-requests";
import { testInboundXCPD, testInboundDQ, testInboundDR } from "./constants";

describe("Inbound Patient Discovery Request Validation", () => {
  it("should successfully validate the testInboundXCPD object with the inboundPatientDiscoveryReqSchema", () => {
    const result = inboundPatientDiscoveryReqSchema.safeParse(testInboundXCPD);
    expect(result.success).toBe(true);
  });
  it("should fail to validate the testInboundXCPD object with the outboundPatientDiscoveryReqSchema", () => {
    const result = outboundPatientDiscoveryReqSchema.safeParse(testInboundXCPD);
    expect(result.success).toBe(false);
  });
  it("should successfully validate the modified testInboundXCPD object with the both inbound and outbound schemas", () => {
    const modifiedTestInboundXCPD = {
      ...testInboundXCPD,
      cxId: "1234",
      patientId: "1234",
      gateways: [
        {
          oid: "1234",
          id: "1234",
          url: "https://example.com",
        },
      ],
      principalCareProviderIds: ["1234", "4567"],
    };
    const result = outboundPatientDiscoveryReqSchema.safeParse(modifiedTestInboundXCPD);
    const result2 = inboundPatientDiscoveryReqSchema.safeParse(modifiedTestInboundXCPD);
    console.log(JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});

describe("Inbound Document Query Request Validation", () => {
  it("should successfully validate the testInboundDQ object with the inboundDocumentQueryReqSchema", () => {
    const result = inboundDocumentQueryReqSchema.safeParse(testInboundDQ);
    expect(result.success).toBe(true);
  });
  it("should fail to validate the testInboundDQ object with the outboundDocumentQueryReqSchema", () => {
    const result = outboundDocumentQueryReqSchema.safeParse(testInboundDQ);
    expect(result.success).toBe(false);
  });

  it("should successfully validate the modified testInboundDQ object with the both inbound and outbound schemas", () => {
    const modifiedTestInboundDQ = {
      ...testInboundDQ,
      cxId: "1234",
      patientId: "1234",
      gateway: {
        homeCommunityId: "1234",
        url: "https://example.com",
      },
    };
    const result = outboundDocumentQueryReqSchema.safeParse(modifiedTestInboundDQ);
    const result2 = inboundDocumentQueryReqSchema.safeParse(modifiedTestInboundDQ);
    expect(result.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});

describe("Inbound Document Retrieval Request Validation", () => {
  it("should successfully validate the testInboundDR object with the inboundDocumentRetrievalReqSchema", () => {
    const result = inboundDocumentRetrievalReqSchema.safeParse(testInboundDR);
    expect(result.success).toBe(true);
  });
  it("should fail to validate the testInboundDR object with the outboundDocumentRetrievalReqSchema", () => {
    const result = outboundDocumentRetrievalReqSchema.safeParse(testInboundDR);
    expect(result.success).toBe(false);
  });

  it("should successfully validate the modified testInboundDR object with the both inbound and outbound schemas", () => {
    const modifiedTestInboundDR = {
      ...testInboundDR,
      cxId: "1234",
      patientId: "1234",
      gateway: {
        homeCommunityId: "1234",
        url: "https://example.com",
      },
    };
    const result = outboundDocumentRetrievalReqSchema.safeParse(modifiedTestInboundDR);
    const result2 = inboundDocumentRetrievalReqSchema.safeParse(modifiedTestInboundDR);
    console.log(JSON.stringify(result));

    expect(result.success).toBe(true);
    expect(result2.success).toBe(true);
  });
});
