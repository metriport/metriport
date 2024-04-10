import { createITI5SoapEnvelope } from "../xcpd/iti55-envelope";
import { createITI38SoapEnvelope } from "../xca/iti38-envelope";
import { createITI39SoapEnvelope } from "../xca/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signTimestamp, signEnvelope } from "../security/sign";
import { iti55BodyData, iti38BodyData, iti39BodyData, TEST_CERT, TEST_KEY } from "./constants";

describe("Full Saml Envelope Signing", () => {
  it("should sign and verify the XCPD SOAP envelope successfully", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI38 envelope successfully", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI39 envelope successfully", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });
});
