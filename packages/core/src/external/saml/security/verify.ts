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
  try {
    const doc = new DOMParser().parseFromString(xmlString, "application/xml");
    const signatures = xpath.select("//*[local-name(.)='Signature']", doc);
    if (!Array.isArray(signatures)) return false;

    return (
      signatures.length > 0 &&
      signatures.every(signature => {
        if (isDomNode.isNodeLike(signature)) {
          const sig = new SignedXml({ publicCert: publicCert });
          sig.loadSignature(signature);
          return sig.checkSignature(xmlString);
        }
        return false;
      })
    );
  } catch (ex) {
    return false;
  }
}
