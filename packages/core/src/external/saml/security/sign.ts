import { SignedXml } from "xml-crypto";
import * as crypto from "crypto";
import { insertKeyInfo } from "./insert-key-info";

function createSignature({
  xml,
  privateKey,
  xpath,
  locationReference,
  action,
}: {
  xml: string;
  privateKey: crypto.KeyLike;
  xpath: string;
  locationReference: string;
  action: "append" | "prepend" | "before" | "after";
}): SignedXml {
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
    location: { reference: locationReference, action: action },
  });
  return sig;
}

export function signTimestamp({
  xml,
  privateKey,
}: {
  xml: string;
  privateKey: crypto.KeyLike;
}): string {
  return createSignature({
    xml,
    privateKey,
    xpath: "//*[local-name(.)='Timestamp']",
    locationReference: "//*[local-name(.)='Timestamp']",
    action: "after",
  }).getSignedXml();
}

export function signEnvelope({
  xml,
  privateKey,
}: {
  xml: string;
  privateKey: crypto.KeyLike;
}): string {
  return createSignature({
    xml,
    privateKey,
    xpath: "//*[local-name(.)='Assertion']",
    locationReference: "//*[local-name(.)='Issuer']",
    action: "after",
  }).getSignedXml();
}

export function signFullSaml({
  xmlString,
  publicCert,
  privateKey,
}: {
  xmlString: string;
  publicCert: string;
  privateKey: string;
}): string {
  const signedTimestamp = signTimestamp({ xml: xmlString, privateKey });
  const signedTimestampAndEnvelope = signEnvelope({ xml: signedTimestamp, privateKey });
  const insertedKeyInfo = insertKeyInfo({ xmlContent: signedTimestampAndEnvelope, publicCert });
  return insertedKeyInfo;
}
