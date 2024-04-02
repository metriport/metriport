import { SignedXml } from "xml-crypto";
import * as crypto from "crypto";

export function signTimestamp(xml: string, privateKey: crypto.KeyLike): SignedXml {
  const sig = new SignedXml({ privateKey });
  sig.addReference({
    xpath: "//*[local-name(.)='Timestamp']",
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
    location: { reference: "//*[local-name(.)='Timestamp']", action: "after" },
  });
  return sig;
}

export function signEnvelope(xml: string, privateKey: crypto.KeyLike): SignedXml {
  const sig = new SignedXml({ privateKey });
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
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
    location: { reference: "//*[local-name(.)='Issuer']", action: "after" },
  });
  return sig;
}
