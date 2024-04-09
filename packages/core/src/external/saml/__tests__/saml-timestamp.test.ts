import { createITI5SoapEnvelope } from "../xcpd/iti55-envelope";
import { createITI38SoapEnvelope } from "../xca/iti38-envelope";
import { createITI39SoapEnvelope } from "../xca/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signTimestamp } from "../security/sign";
import {
  iti55BodyData,
  iti38BodyData,
  iti39BodyData,
  IHE_STAGING_CERT,
  IHE_STAGING_KEY,
} from "./constants";

describe("SAML Timestamp Signature Verification", () => {
  it("should fail verification if the iti55 timestamp text is modified after signing", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    const modifiedTimestamp = signedWithTimestamp.replace(
      /<wsu:Created>.*<\/wsu:Created>/,
      "<wsu:Created>2024-01-01T00:00:00.000Z</wsu:Created>"
    );

    expect(verifySaml({ xmlString: modifiedTimestamp, publicCert: IHE_STAGING_CERT })).toBeFalsy();
  });

  it("should fail verification if the iti55 timestamp signature is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    const modifiedSignature = signedWithTimestamp.replace(
      /<ds:SignatureValue>.*<\/ds:SignatureValue>/,
      "<ds:SignatureValue>invalid-signature</ds:SignatureValue>"
    );

    expect(verifySaml({ xmlString: modifiedSignature, publicCert: IHE_STAGING_CERT })).toBeFalsy();
  });

  it("should fail verification if the iti55 timestamp digest is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    const modifiedDigest = signedWithTimestamp.replace(
      /<ds:DigestValue>.*<\/ds:DigestValue>/,
      "<ds:DigestValue>invalid-digest</ds:DigestValue>"
    );

    expect(verifySaml({ xmlString: modifiedDigest, publicCert: IHE_STAGING_CERT })).toBeFalsy();
  });

  it("should sign and verify the iti55 envelope successfully with timestamp", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    expect(
      verifySaml({ xmlString: signedWithTimestamp, publicCert: IHE_STAGING_CERT })
    ).toBeTruthy();
  });

  it("should sign and verify the ITI38 envelope successfully with timestamp", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    expect(
      verifySaml({ xmlString: signedWithTimestamp, publicCert: IHE_STAGING_CERT })
    ).toBeTruthy();
  });

  it("should fail verification if the ITI38 timestamp text is modified after signing", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    const modifiedTimestamp = signedWithTimestamp.replace(
      /<wsu:Created>.*<\/wsu:Created>/,
      "<wsu:Created>2024-01-01T00:00:00.000Z</wsu:Created>"
    );

    expect(verifySaml({ xmlString: modifiedTimestamp, publicCert: IHE_STAGING_CERT })).toBeFalsy();
  });

  it("should sign and verify the ITI39 envelope successfully with timestamp", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    expect(
      verifySaml({ xmlString: signedWithTimestamp, publicCert: IHE_STAGING_CERT })
    ).toBeTruthy();
  });

  it("should fail verification if the ITI39 timestamp text is modified after signing", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    const modifiedTimestamp = signedWithTimestamp.replace(
      /<wsu:Created>.*<\/wsu:Created>/,
      "<wsu:Created>2024-01-01T00:00:00.000Z</wsu:Created>"
    );

    expect(verifySaml({ xmlString: modifiedTimestamp, publicCert: IHE_STAGING_CERT })).toBeFalsy();
  });
});
