import { InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { metriportOrganization } from "@metriport/shared";
import { createExtrinsicObjectXml } from "../../../../../shareback/metadata/create-metadata-xml";
import { S3Utils } from "../../../../aws/s3";
import { extractDocumentUniqueId } from "../../../shared";
import {
  TEST_CERT,
  TEST_KEY,
  outboundDqRequest,
  xcaGateway,
} from "../../outbound/__tests__/constants";
import { createITI38SoapEnvelope } from "../../outbound/xca/create/iti38-envelope";
import { processDqResponse } from "../../outbound/xca/process/dq-response";
import { signTimestamp } from "../../saml/security/sign";
import { createInboundDqResponse } from "../xca/create/dq-response";
import { processInboundDqRequest } from "../xca/process/dq-request";

describe("Process Inbound Dq Request", () => {
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

  it("should process successful Iti-38 request", async () => {
    try {
      const soapEnvelope = createITI38SoapEnvelope({
        bodyData: outboundDqRequest,
        publicCert: TEST_CERT,
      });
      const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
      const iti38Request = await processInboundDqRequest(signedEnvelope);
      expect(iti38Request.externalGatewayPatient).toEqual(outboundDqRequest.externalGatewayPatient);
    } catch (error) {
      throw new Error("iti38Request externalPatient is wrong or undefined");
    }
  });

  it("should process invalid ITI-38 request correctly", async () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: outboundDqRequest,
      publicCert: TEST_CERT,
    });

    await expect(processInboundDqRequest(soapEnvelope)).rejects.toThrow(
      "Failed to parse ITI-38 request"
    );
  });
});

describe("Process Inbound Dq Response", () => {
  it("should process successful Iti-38 response", () => {
    const docUniqueId = "1234567890";
    const extrinsicObjectXmls = [
      createExtrinsicObjectXml({
        createdTime: new Date().toISOString(),
        organization: metriportOrganization,
        size: "1000",
        patientId: "1234567890",
        documentUniqueId: "1234567890",
        mimeType: "application/xml",
      }),
    ];
    const response: InboundDocumentQueryResp = {
      ...outboundDqRequest,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls,
    };

    const xmlResponse = createInboundDqResponse(response);
    const iti38Response = processDqResponse({
      response: {
        gateway: xcaGateway,
        outboundRequest: outboundDqRequest,
        success: true,
        response: xmlResponse,
      },
    });
    expect(
      extractDocumentUniqueId(iti38Response?.documentReference?.[0]?.docUniqueId ?? "")
    ).toEqual(docUniqueId);
  });
  it("should process ITI-38 error response", () => {
    const response = {
      ...outboundDqRequest,
      responseTimestamp: new Date().toISOString(),
      externalGatewayPatient: {
        id: "123456789",
        system: "987654321",
      },
      gatewayHomeCommunityId: "123456789",
      operationOutcome: {
        resourceType: "OperationOutcome",
        id: outboundDqRequest.id,
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

    const xmlResponse = createInboundDqResponse(response);
    const iti38Response = processDqResponse({
      response: {
        response: xmlResponse,
        success: true,
        outboundRequest: outboundDqRequest,
        gateway: xcaGateway,
      },
    });
    expect(iti38Response.operationOutcome).toEqual(response.operationOutcome);
  });
});
