import { createITI39SoapEnvelope } from "../../outbound/xca/create/iti39-envelope";
import { iti39BodyData } from "../../saml/__tests__/constants";
import { TEST_CERT, TEST_KEY } from "../../saml/__tests__/constants";
import { signTimestamp } from "../../saml/security/sign";
import { processInboundDrRequest } from "../xca/process-dr";

it("should process ITI-39 request", () => {
  try {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const iti39Request = processInboundDrRequest(signedEnvelope);

    const expectedDocumentReference = iti39BodyData.documentReference.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ metriportId, ...rest }) => rest
    );
    const actualDocumentReference = iti39Request.documentReference.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ metriportId, ...rest }) => rest
    );

    expect(actualDocumentReference).toEqual(expectedDocumentReference);
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});
