import { createITI5SoapEnvelope } from "../../outbound/xcpd/create/iti55-envelope";
import { createITI38SoapEnvelope } from "../../outbound/xca/create/iti38-envelope";
import { createITI39SoapEnvelope } from "../../outbound/xca/create/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signTimestamp } from "../security/sign";
import { iti55BodyData, iti38BodyData, iti39BodyData, TEST_CERT, TEST_KEY } from "./constants";

describe("SAML Timestamp Signature Verification", () => {
  it("should fail verification if the iti55 timestamp text is modified after signing", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedTimestamp = signedWithTimestamp.replace(
      /<wsu:Created>.*<\/wsu:Created>/,
      "<wsu:Created>2024-01-01T00:00:00.000Z</wsu:Created>"
    );

    expect(verifySaml({ xmlString: modifiedTimestamp, publicCert: TEST_CERT })).toBeFalsy();
  });

  it("should fail verification if the iti55 timestamp signature is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedSignature = signedWithTimestamp.replace(
      /<ds:SignatureValue>.*<\/ds:SignatureValue>/,
      "<ds:SignatureValue>invalid-signature</ds:SignatureValue>"
    );

    expect(verifySaml({ xmlString: modifiedSignature, publicCert: TEST_CERT })).toBeFalsy();
  });

  it("should fail verification if the iti55 timestamp digest is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedDigest = signedWithTimestamp.replace(
      /<ds:DigestValue>.*<\/ds:DigestValue>/,
      "<ds:DigestValue>invalid-digest</ds:DigestValue>"
    );

    expect(verifySaml({ xmlString: modifiedDigest, publicCert: TEST_CERT })).toBeFalsy();
  });

  it("should sign and verify the iti55 envelope successfully with timestamp", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI38 envelope successfully with timestamp", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should fail verification if the ITI38 timestamp text is modified after signing", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedTimestamp = signedWithTimestamp.replace(
      /<wsu:Created>.*<\/wsu:Created>/,
      "<wsu:Created>2024-01-01T00:00:00.000Z</wsu:Created>"
    );

    expect(verifySaml({ xmlString: modifiedTimestamp, publicCert: TEST_CERT })).toBeFalsy();
  });

  it("should sign and verify the ITI39 envelope successfully with timestamp", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedWithTimestamp, publicCert: TEST_CERT })).toBeTruthy();
  });

  it("should fail verification if the ITI39 timestamp text is modified after signing", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: TEST_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedTimestamp = signedWithTimestamp.replace(
      /<wsu:Created>.*<\/wsu:Created>/,
      "<wsu:Created>2024-01-01T00:00:00.000Z</wsu:Created>"
    );

    expect(verifySaml({ xmlString: modifiedTimestamp, publicCert: TEST_CERT })).toBeFalsy();
  });
});
