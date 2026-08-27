import { MetriportError } from "@metriport/shared";
import * as isDomNode from "@xmldom/is-dom-node";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import * as xpath from "xpath";
import { ItiRequestWithSamlHeader } from "../../schema";

export function validateDigestValues(xmlString: string): void {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");

  const sig = new SignedXml();

  const signatures = xpath.select("//*[local-name(.)='Signature']", doc);
  if (!Array.isArray(signatures) || signatures.length === 0) {
    throw new MetriportError("Signature elements missing from the XML document");
  }
  const signatureElement = isDomNode.isNodeLike(signatures[0]) ? signatures[0] : null;
  if (!signatureElement) {
    throw new MetriportError("No Signature element found in XML document");
  }
  sig.loadSignature(signatureElement);

  // Loop over all references inside <SignedInfo>
  for (const ref of sig.getReferences()) {
    const expectedDigest = ref.digestValue; // what is in <DigestValue>

    if (!expectedDigest) {
      continue;
    }

    // Find the referenced element using the URI
    const uri = ref.uri?.[0] === "#" ? ref.uri.substring(1) : ref.uri ?? "";
    let elem: Node | null = null;

    if (uri === "") {
      const rootElem = xpath.select1("//*", doc);
      elem = isDomNode.isNodeLike(rootElem) ? rootElem : null;
    } else {
      // Find element by ID attributes
      for (const idAttr of sig.idAttributes) {
        const elemXpath = `//*[@*[local-name(.)='${idAttr}']='${uri}']`;
        const selected = xpath.select(elemXpath, doc);
        if (Array.isArray(selected) && selected.length > 0 && isDomNode.isNodeLike(selected[0])) {
          elem = selected[0];
          break;
        }
      }
    }

    if (!elem) {
      throw new MetriportError(`Could not find referenced element with URI: ${ref.uri}`);
    }

    // Get canonicalized XML using the transforms
    const canonOptions: {
      inclusiveNamespacesPrefixList: string[];
      ancestorNamespaces?: typeof ref.ancestorNamespaces;
    } = {
      inclusiveNamespacesPrefixList: ref.inclusiveNamespacesPrefixList,
    };
    if (ref.ancestorNamespaces) {
      canonOptions.ancestorNamespaces = ref.ancestorNamespaces;
    }
    const canonXml = sig.getCanonXml(ref.transforms, elem, canonOptions);

    // Compute digest using the hash algorithm
    const HashAlgorithmClass = sig.HashAlgorithms[ref.digestAlgorithm];
    if (!HashAlgorithmClass) {
      throw new MetriportError(`Hash algorithm '${ref.digestAlgorithm}' is not supported`);
    }
    const hashAlgo = new HashAlgorithmClass();
    const computedDigest = hashAlgo.getHash(canonXml);

    if (computedDigest !== expectedDigest) {
      throw new MetriportError(
        `Digest mismatch: expected ${expectedDigest} but computed ${computedDigest}`
      );
    }
  }
}

export function validateKeyIdentifier<T extends ItiRequestWithSamlHeader>(itiRequest: T): void {
  const keyInfo = itiRequest.Envelope.Header.Security.Signature.KeyInfo;
  if (!keyInfo?.SecurityTokenReference?.KeyIdentifier) {
    return;
  }

  const keyIdentifierValue = keyInfo.SecurityTokenReference.KeyIdentifier._text;
  const assertionId = itiRequest.Envelope.Header.Security.Assertion._ID;

  if (keyIdentifierValue !== assertionId) {
    throw new MetriportError(
      `Invalid KeyIdentifier value: expected '${assertionId}', but got '${keyIdentifierValue}'`
    );
  }
}
