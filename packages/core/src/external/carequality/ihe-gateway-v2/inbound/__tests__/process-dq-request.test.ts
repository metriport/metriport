import { metriportOrganization } from "@metriport/shared";
import { InboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { createITI38SoapEnvelope } from "../../outbound/xca/create/iti38-envelope";
import { processDqResponse } from "../../outbound/xca/process/dq-response";
import { processInboundDqRequest } from "../xca/process-dq";
import { createIti38SoapEnvelopeInboundResponse } from "../xca/create-dq-resp";
import { iti38BodyData } from "../../saml/__tests__/constants";
import { TEST_CERT, TEST_KEY, xcaGateway } from "../../saml/__tests__/constants";
import { signTimestamp } from "../../saml/security/sign";
import { createExtrinsicObjectXml } from "../../../dq/create-metadata-xml";
import { extractDocumentUniqueId } from "../../../shared";

describe("Process Inbound Dq Request", () => {
  it("should process successful Iti-38 request", () => {
    try {
      const soapEnvelope = createITI38SoapEnvelope({
        bodyData: iti38BodyData,
        publicCert: TEST_CERT,
      });
      const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
      const iti38Request = processInboundDqRequest(signedEnvelope);
      expect(iti38Request.externalGatewayPatient).toEqual(iti38BodyData.externalGatewayPatient);
    } catch (error) {
      console.log(error);
      expect(true).toBe(false);
    }
  });

  it("should process invalid ITI-38 request correctly", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: TEST_CERT,
    });
    expect(() => {
      processInboundDqRequest(soapEnvelope);
    }).toThrow("Failed to parse ITI-38 request");
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
      ...iti38BodyData,
      responseTimestamp: new Date().toISOString(),
      extrinsicObjectXmls,
    };

    const xmlResponse = createIti38SoapEnvelopeInboundResponse(response);
    const iti38Response = processDqResponse({
      response: {
        gateway: xcaGateway,
        outboundRequest: iti38BodyData,
        success: true,
        response: xmlResponse,
      },
    });
    if (iti38Response.documentReference && iti38Response.documentReference[0]) {
      expect(extractDocumentUniqueId(iti38Response.documentReference[0].docUniqueId)).toEqual(
        docUniqueId
      );
    } else {
      throw new Error(
        "iti38Response.documentReference is undefined or has wrong document unique id"
      );
    }
  });
  it("should process ITI-38 error response", () => {
    const response = {
      ...iti38BodyData,
      responseTimestamp: new Date().toISOString(),
      externalGatewayPatient: {
        id: "123456789",
        system: "987654321",
      },
      gatewayHomeCommunityId: "123456789",
      operationOutcome: {
        resourceType: "OperationOutcome",
        id: iti38BodyData.id,
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

    const xmlResponse = createIti38SoapEnvelopeInboundResponse(response);
    const iti38Response = processDqResponse({
      response: {
        response: xmlResponse,
        success: true,
        outboundRequest: iti38BodyData,
        gateway: xcaGateway,
      },
    });
    expect(iti38Response.operationOutcome).toEqual(response.operationOutcome);
  });
});
