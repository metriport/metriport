import { isSuccessfulInboundPatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { processInboundXcpdRequest } from "../xcpd/process/xcpd-request";
import { createInboundXcpdResponse } from "../xcpd/create/xcpd-response";
import { createITI5SoapEnvelope } from "../../outbound/xcpd/create/iti55-envelope";
import { processXCPDResponse } from "../../outbound/xcpd/process/xcpd-response";
import {
  TEST_CERT,
  TEST_KEY,
  xcpdGateway,
  outboundXcpdRequest,
} from "../../outbound/__tests__/constants";
import { signTimestamp } from "../../saml/security/sign";
import { S3Utils } from "../../../../aws/s3";

describe("Process Inbound Xcpd Request", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() => {
      return Promise.resolve({
        location: "http://example.com/mockurl",
        eTag: '"mockedetag"',
        bucket: "mockedbucket",
        key: "mockedkey",
        versionId: "mockVersionId",
      });
    });
  });
  it("should process successful ITI-55 request", async () => {
    try {
      const soapEnvelope = createITI5SoapEnvelope({
        bodyData: outboundXcpdRequest,
        publicCert: TEST_CERT,
      });
      const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });

      const iti55InboundRequest = await processInboundXcpdRequest(signedEnvelope);
      const updatedIti55InboundRequest = {
        ...iti55InboundRequest,
        patientResource: {
          ...iti55InboundRequest.patientResource,
          id: outboundXcpdRequest.patientResource.id,
        },
      };
      expect(outboundXcpdRequest.patientResource).toEqual(
        updatedIti55InboundRequest.patientResource
      );
    } catch (error) {
      expect(true).toBe(false);
    }
  });

  it("should process invalid ITI-55 request correctly", async () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequest,
      publicCert: TEST_CERT,
    });

    await expect(processInboundXcpdRequest(soapEnvelope)).rejects.toThrow(
      "Failed to parse ITI-55 request"
    );
  });
});

describe("Process Inbound Xcpd Response", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() => {
      return Promise.resolve({
        location: "http://example.com/mockurl",
        eTag: '"mockedetag"',
        bucket: "mockedbucket",
        key: "mockedkey",
        versionId: "mockVersionId",
      });
    });
  });
  it("should process ITI-55 success response", () => {
    const response = {
      ...outboundXcpdRequest,
      externalGatewayPatient: {
        id: "123456789",
        system: "987654321",
      },
      responseTimestamp: new Date().toISOString(),
      patientMatch: true,
      gatewayHomeCommunityId: "123456789",
    };
    const xmlResponse = createInboundXcpdResponse({
      request: outboundXcpdRequest,
      response,
    });

    const iti55Response = processXCPDResponse({
      xcpdResponse: {
        response: xmlResponse,
        success: true,
        outboundRequest: outboundXcpdRequest,
        gateway: xcpdGateway,
      },
    });
    const patientResource = isSuccessfulInboundPatientDiscoveryResponse(response)
      ? response.patientResource
      : undefined;
    expect(patientResource).toEqual(response.patientResource);
    expect(iti55Response.patientMatch).toEqual(response.patientMatch);
  });
  it("should process ITI-55 no match response", () => {
    const response = {
      ...outboundXcpdRequest,
      responseTimestamp: new Date().toISOString(),
      externalGatewayPatient: {
        id: "123456789",
        system: "987654321",
      },
      patientMatch: false,
      gatewayHomeCommunityId: "123456789",
    };

    const xmlResponse = createInboundXcpdResponse({
      request: outboundXcpdRequest,
      response,
    });
    const iti55Response = processXCPDResponse({
      xcpdResponse: {
        response: xmlResponse,
        success: true,
        outboundRequest: outboundXcpdRequest,
        gateway: xcpdGateway,
      },
    });
    expect(iti55Response.patientMatch).toEqual(response.patientMatch);
  });

  it("should process ITI-55 error response", () => {
    const response = {
      ...outboundXcpdRequest,
      responseTimestamp: new Date().toISOString(),
      externalGatewayPatient: {
        id: "123456789",
        system: "987654321",
      },
      patientMatch: null,
      gatewayHomeCommunityId: "123456789",
      operationOutcome: {
        resourceType: "OperationOutcome",
        id: outboundXcpdRequest.id,
        issue: [
          {
            severity: "error",
            code: "XDSRegistryError",
            details: {
              coding: [{ system: "1.3.6.1.4.1.19376.1.2.27.1", code: "XDSRegistryError" }],
              text: "Internal Server Error",
            },
          },
        ],
      },
    };

    const xmlResponse = createInboundXcpdResponse({
      request: outboundXcpdRequest,
      response,
    });
    const iti55Response = processXCPDResponse({
      xcpdResponse: {
        response: xmlResponse,
        success: true,
        outboundRequest: outboundXcpdRequest,
        gateway: xcpdGateway,
      },
    });
    expect(iti55Response.operationOutcome).toEqual(response.operationOutcome);
  });
});
