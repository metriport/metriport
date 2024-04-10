import { SignedXml } from "xml-crypto";
import * as xpath from "xpath";
import * as isDomNode from "@xmldom/is-dom-node";
import * as crypto from "crypto";
import { DOMParser } from "xmldom";

export function verifySaml({
  xmlString,
  publicCert,
}: {
  xmlString: string;
  publicCert: crypto.KeyLike;
}): boolean {
  const doc = new DOMParser().parseFromString(xmlString, "application/xml");
  const signatures = xpath.select("//*[local-name(.)='Signature']", doc);
  if (!Array.isArray(signatures)) return false;

  return signatures.every(signature => {
    if (isDomNode.isNodeLike(signature)) {
      try {
        const sig = new SignedXml({ publicCert: publicCert });
        sig.loadSignature(signature);
        const verified = sig.checkSignature(xmlString);
        return verified;
      } catch (ex) {
        return false;
      }
    }
    return false;
  });
}
