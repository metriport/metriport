import { SignedXml } from "xml-crypto";
import * as crypto from "crypto";
import { insertKeyInfo } from "./insert-key-info";
import { SamlCertsAndKeys } from "./types";
import { verifySaml } from "./verify";
import { out } from "../../../../../util/log";

const { log } = out("Saml Signing");

function createSignature({
  xml,
  privateKey,
  xpath,
  locationReference,
  action,
  transforms,
  useSha1 = false,
}: {
  xml: string;
  privateKey: crypto.KeyLike;
  xpath: string;
  locationReference: string;
  action: "append" | "prepend" | "before" | "after";
  transforms: string[];
  useSha1: boolean;
}): SignedXml {
  const sig = new SignedXml({ privateKey });
  sig.addReference({
    xpath: xpath,
    digestAlgorithm: useSha1
      ? "http://www.w3.org/2000/09/xmldsig#sha1"
      : "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: transforms,
  });
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.signatureAlgorithm = useSha1
    ? "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
    : "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.computeSignature(xml, {
    prefix: "ds",
    location: { reference: locationReference, action: action },
  });
  return sig;
}

export function signTimestamp({
  xml,
  privateKey,
  useSha1 = false,
}: {
  xml: string;
  privateKey: crypto.KeyLike;
  useSha1?: boolean;
}): string {
  const transforms = ["http://www.w3.org/2001/10/xml-exc-c14n#"];
  return createSignature({
    xml,
    privateKey,
    xpath: "//*[local-name(.)='Timestamp']",
    locationReference: "//*[local-name(.)='Assertion']",
    action: "after",
    transforms,
    useSha1,
  }).getSignedXml();
}

export function signEnvelope({
  xml,
  privateKey,
  useSha1 = false,
}: {
  xml: string;
  privateKey: crypto.KeyLike;
  useSha1?: boolean;
}): string {
  const transforms = [
    "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
    "http://www.w3.org/2001/10/xml-exc-c14n#",
  ];
  return createSignature({
    xml,
    privateKey,
    xpath: "//*[local-name(.)='Assertion']",
    locationReference: "//*[local-name(.)='Issuer']",
    action: "after",
    transforms,
    useSha1,
  }).getSignedXml();
}

export function signFullSaml({
  xmlString,
  samlCertsAndKeys,
  useSha1 = false,
}: {
  xmlString: string;
  samlCertsAndKeys: SamlCertsAndKeys;
  useSha1?: boolean;
}): string {
  const decryptedPrivateKey = crypto.createPrivateKey({
    key: samlCertsAndKeys.privateKey,
    passphrase: samlCertsAndKeys.privateKeyPassword,
    format: "pem",
  });

  const signedTimestamp = signTimestamp({
    xml: xmlString,
    privateKey: decryptedPrivateKey,
    useSha1,
  });
  const signedTimestampAndEnvelope = signEnvelope({
    xml: signedTimestamp,
    privateKey: decryptedPrivateKey,
    useSha1,
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
