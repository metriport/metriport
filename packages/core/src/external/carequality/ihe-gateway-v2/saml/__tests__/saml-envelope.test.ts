import { createITI5SoapEnvelope } from "../../outbound/xcpd/create/iti55-envelope";
import { createITI38SoapEnvelope } from "../../outbound/xca/create/iti38-envelope";
import { createITI39SoapEnvelope } from "../../outbound/xca/create/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signEnvelope } from "../security/sign";
import {
  TEST_CERT,
  TEST_KEY,
  outboundXcpdRequest,
  outboundDqRequest,
  outboundDrRequest,
} from "../../outbound/__tests__/constants";

describe("SAML XCPD Envelope Signature Verification", () => {
  it("should sign and verify the iti55 envelope successfully with envelope", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });
  it("should fail verification if the iti55 SAML assertion is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedAssertion = signedEnvelope.replace(
      /<saml2:Issuer Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">.*<\/saml2:Issuer>/,
      '<saml2:Issuer Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">invalid-issuer</saml2:Issuer>'
    );
    expect(verifySaml({ xmlString: modifiedAssertion, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should fail verification if the iti55 SAML assertion signature is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedSignature = signedEnvelope.replace(
      /<ds:SignatureValue>.*<\/ds:SignatureValue>/,
      "<ds:SignatureValue>invalid-signature</ds:SignatureValue>"
    );
    expect(verifySaml({ xmlString: modifiedSignature, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should fail verification if the iti55 SAML assertion digest is modified", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: outboundXcpdRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedDigest = signedEnvelope.replace(
      /<ds:DigestValue>.*<\/ds:DigestValue>/,
      "<ds:DigestValue>invalid-digest</ds:DigestValue>"
    );
    expect(verifySaml({ xmlString: modifiedDigest, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should sign and verify the ITI38 envelope successfully with envelope", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: outboundDqRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });
  it("should fail verification if the ITI38 SAML assertion is modified", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: outboundDqRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedAssertion = signedEnvelope.replace(
      /<saml2:Issuer Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">.*<\/saml2:Issuer>/,
      '<saml2:Issuer Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">invalid-issuer</saml2:Issuer>'
    );
    expect(verifySaml({ xmlString: modifiedAssertion, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should fail verification if the ITI38 SAML assertion signature is modified", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: outboundDqRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedSignature = signedEnvelope.replace(
      /<ds:SignatureValue>.*<\/ds:SignatureValue>/,
      "<ds:SignatureValue>invalid-signature</ds:SignatureValue>"
    );
    expect(verifySaml({ xmlString: modifiedSignature, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should fail verification if the ITI38 SAML assertion digest is modified", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: outboundDqRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedDigest = signedEnvelope.replace(
      /<ds:DigestValue>.*<\/ds:DigestValue>/,
      "<ds:DigestValue>invalid-digest</ds:DigestValue>"
    );
    expect(verifySaml({ xmlString: modifiedDigest, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should sign and verify the ITI39 envelope successfully with envelope", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: outboundDrRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: TEST_CERT })).toBeTruthy();
  });
  it("should fail verification if the ITI39 SAML assertion is modified", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: outboundDrRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedAssertion = signedEnvelope.replace(
      /<saml2:Issuer Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">.*<\/saml2:Issuer>/,
      '<saml2:Issuer Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">invalid-issuer</saml2:Issuer>'
    );
    expect(verifySaml({ xmlString: modifiedAssertion, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should fail verification if the ITI39 SAML assertion signature is modified", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: outboundDrRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedSignature = signedEnvelope.replace(
      /<ds:SignatureValue>.*<\/ds:SignatureValue>/,
      "<ds:SignatureValue>invalid-signature</ds:SignatureValue>"
    );
    expect(verifySaml({ xmlString: modifiedSignature, publicCert: TEST_CERT })).toBeFalsy();
  });
  it("should fail verification if the ITI39 SAML assertion digest is modified", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: outboundDrRequest,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signEnvelope({ xml: soapEnvelope, privateKey: TEST_KEY });
    const modifiedDigest = signedEnvelope.replace(
      /<ds:DigestValue>.*<\/ds:DigestValue>/,
      "<ds:DigestValue>invalid-digest</ds:DigestValue>"
    );
    expect(verifySaml({ xmlString: modifiedDigest, publicCert: TEST_CERT })).toBeFalsy();
  });
});
