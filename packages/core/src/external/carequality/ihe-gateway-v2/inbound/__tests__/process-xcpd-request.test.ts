import { processXcpdRequest } from "../xcpd/process-xcpd";
import { TEST_CERT, iti55BodyData } from "../../saml/__tests__/constants";
import { createITI5SoapEnvelope } from "../../outbound/xcpd/create/iti55-envelope";

it("should process ITI-55 request", () => {
  try {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const iti55InboundRequest = processXcpdRequest(soapEnvelope);
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
