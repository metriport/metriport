import { SignedXml } from "xml-crypto";
import * as crypto from "crypto";
import { insertKeyInfo } from "./insert-key-info";
import { SamlCertsAndKeys } from "./types";
import { verifySaml } from "./verify";
import { out } from "../../../util/log";

const { log } = out("Saml Signing");

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
  const transforms = [
    "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
    "http://www.w3.org/2001/10/xml-exc-c14n#",
  ];
  sig.addReference({
    xpath: xpath,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: transforms,
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
    action: "before",
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
  samlCertsAndKeys,
}: {
  xmlString: string;
  samlCertsAndKeys: SamlCertsAndKeys;
}): string {
  const decryptedPrivateKey = crypto.createPrivateKey({
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    format: "pem",
  });

  const signedTimestamp = signTimestamp({ xml: xmlString, privateKey: decryptedPrivateKey });
  const signedTimestampAndEnvelope = signEnvelope({
    xml: signedTimestamp,
    privateKey: decryptedPrivateKey,
  });
  const insertedKeyInfo = insertKeyInfo({
    xmlContent: signedTimestampAndEnvelope,
    publicCert: samlCertsAndKeys.publicCert,
  });
  const verified = verifySaml({
    xmlString: insertedKeyInfo,
    publicCert: samlCertsAndKeys.publicCert,
  });
  if (!verified) {
    log("Signature verification failed.");
    throw new Error("Signature verification failed.");
  }
  return insertedKeyInfo;
}
