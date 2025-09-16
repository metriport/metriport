import { createITI5SoapEnvelope } from "../../outbound/xcpd/create/iti55-envelope";
import { createITI38SoapEnvelope } from "../../outbound/xca/create/iti38-envelope";
import { createITI39SoapEnvelope } from "../../outbound/xca/create/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signTimestamp, signEnvelope } from "../security/sign";
import {
  TEST_CERT,
  TEST_KEY,
  outboundXcpdRequest,
  outboundDqRequest,
  outboundDrRequest,
} from "../../outbound/__tests__/constants";

describe("Full Saml Envelope Signing", () => {
  it("should sign and verify the XCPD SOAP envelope successfully", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequest,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI38 envelope successfully", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: outboundDqRequest,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI39 envelope successfully", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: outboundDrRequest,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });
});
