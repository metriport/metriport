import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { isSuccessfulOutboundDocQueryResponse } from "../carequality-analytics";

describe("isSuccessfulOutboundDocQueryResponse", () => {
  const baseResponse: OutboundDocumentQueryResp = {
    id: "example-id-123",
    gateway: {
      url: "https://example-gateway.com/iti38/3.0",
      homeCommunityId: "1.2.3.4.5.6.7.8.9.10",
    },
    duration: 29131,
    patientId: "example-patient-id-456",
    timestamp: "2024-08-09T16:18:05.695Z",
    iheGatewayV2: true,
    requestTimestamp: "2024-08-09T16:18:05.695Z",
    responseTimestamp: "2024-08-09T16:18:34.826Z",
    externalGatewayPatient: {
      id: "example-external-id-789",
      system: "1.2.3.4.5.6.7.8.9.10",
    },
  };

  it("returns true when response has a documentReference", () => {
    const response: OutboundDocumentQueryResp = {
      ...baseResponse,
      documentReference: [
        {
          title: "Summary of Episode Note",
          language: "en-us",
          contentType: "text/xml",
          docUniqueId: "1.2.3.4.5.6.7.8.9.11",
          homeCommunityId: "1.2.3.4.5.6.7.8.9.10",
          authorInstitution: "Example Health CareConnect",
          repositoryUniqueId: "1.2.3.4.5.6.7.8.9.12",
        },
      ],
    };
    expect(isSuccessfulOutboundDocQueryResponse(response)).toBe(true);
  });

  it("returns true when response has a 'no-documents-found' issue", () => {
    const response: OutboundDocumentQueryResp = {
      ...baseResponse,
      operationOutcome: {
        id: "123456",
        issue: [
          {
            code: "no-documents-found",
            details: {
              text: "No documents found",
            },
            severity: "information",
          },
        ],
        resourceType: "OperationOutcome",
      },
    };
    expect(isSuccessfulOutboundDocQueryResponse(response)).toBe(true);
  });

  it("returns false when response has a different operation outcome", () => {
    const response: OutboundDocumentQueryResp = {
      ...baseResponse,
      operationOutcome: {
        id: "019131e3-16a1-770a-ac8b-c737dfc0c514",
        issue: [
          {
            code: "http-error",
            details: {
              text: "Request failed with status code 500",
            },
            severity: "error",
          },
        ],
        resourceType: "OperationOutcome",
      },
    };
    expect(isSuccessfulOutboundDocQueryResponse(response)).toBe(false);
  });
});
