import { createITI5SoapEnvelope } from "../xcpd/iti55-envelope";
import { createITI38SoapEnvelope } from "../xca/iti38-envelope";
import { createITI39SoapEnvelope } from "../xca/iti39-envelope";
import { verifySaml } from "../security/verify";
import { signTimestamp, signEnvelope } from "../security/sign";
import {
  iti55BodyData,
  iti38BodyData,
  iti39BodyData,
  IHE_STAGING_CERT,
  IHE_STAGING_KEY,
} from "./constants";

describe("Full Saml Envelope Signing", () => {
  it("should sign and verify the XCPD SOAP envelope successfully", () => {
    const soapEnvelope = createITI5SoapEnvelope({
      bodyData: iti55BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    expect(
      verifySaml({ xmlString: signedWithTimestamp, publicCert: IHE_STAGING_CERT })
    ).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: IHE_STAGING_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: IHE_STAGING_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI38 envelope successfully", () => {
    const soapEnvelope = createITI38SoapEnvelope({
      bodyData: iti38BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    expect(
      verifySaml({ xmlString: signedWithTimestamp, publicCert: IHE_STAGING_CERT })
    ).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: IHE_STAGING_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: IHE_STAGING_CERT })).toBeTruthy();
  });

  it("should sign and verify the ITI39 envelope successfully", () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: IHE_STAGING_CERT,
    });

    const signedWithTimestamp = signTimestamp({ xml: soapEnvelope, privateKey: IHE_STAGING_KEY });
    expect(
      verifySaml({ xmlString: signedWithTimestamp, publicCert: IHE_STAGING_CERT })
    ).toBeTruthy();

    const signedEnvelope = signEnvelope({ xml: signedWithTimestamp, privateKey: IHE_STAGING_KEY });
    expect(verifySaml({ xmlString: signedEnvelope, publicCert: IHE_STAGING_CERT })).toBeTruthy();
  });
});
