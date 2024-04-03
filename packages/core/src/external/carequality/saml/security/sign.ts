import { SignedXml } from "xml-crypto";
import * as crypto from "crypto";

function createSignature(
  xml: string,
  privateKey: crypto.KeyLike,
  xpath: string,
  locationReference: string
): SignedXml {
  const sig = new SignedXml({ privateKey });
  sig.addReference({
    xpath: xpath,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  });
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  sig.computeSignature(xml, {
    prefix: "ds",
    location: { reference: locationReference, action: "after" },
  });
  return sig;
}

export function signTimestamp(xml: string, privateKey: crypto.KeyLike): SignedXml {
  return createSignature(
    xml,
    privateKey,
    "//*[local-name(.)='Timestamp']",
    "//*[local-name(.)='Timestamp']"
  );
}

export function signEnvelope(xml: string, privateKey: crypto.KeyLike): SignedXml {
  return createSignature(
    xml,
    privateKey,
    "//*[local-name(.)='Assertion']",
    "//*[local-name(.)='Issuer']"
  );
}
