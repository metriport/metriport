import { processInboundXcpdRequest } from "../xcpd/process-xcpd-req";
import { createIti55SoapEnvelopeInboundResponse } from "../xcpd/create-xcpd-resp";
import { TEST_CERT, iti55BodyData, xcpdGateway } from "../../saml/__tests__/constants";
import { createITI5SoapEnvelope } from "../../outbound/xcpd/create/iti55-envelope";
import { processXCPDResponse } from "../../outbound/xcpd/process/xcpd-response";

it.skip("should process ITI-55 request", () => {
  try {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const iti55InboundRequest = processInboundXcpdRequest(soapEnvelope);
    const updatedIti55InboundRequest = {
      ...iti55InboundRequest,
      patientResource: {
        ...iti55InboundRequest.patientResource,
        id: iti55BodyData.patientResource.id,
      },
    };

    expect(iti55BodyData.patientResource).toEqual(updatedIti55InboundRequest.patientResource);
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});
it("should process ITI-55 response", () => {
  const response = {
    ...iti55BodyData,
    externalGatewayPatient: {
      id: "123456789",
      system: "987654321",
    },
    responseTimestamp: new Date().toISOString(),
    patientMatch: true,
    gatewayHomeCommunityId: "123456789",
  };
  const xmlResponse = createIti55SoapEnvelopeInboundResponse({
    request: iti55BodyData,
    response,
  });

  const iti55Response = processXCPDResponse({
    xcpdResponse: {
      response: xmlResponse,
      success: true,
      outboundRequest: iti55BodyData,
      gateway: xcpdGateway,
    },
  });
  console.log(JSON.stringify(iti55Response, null, 2));
});
