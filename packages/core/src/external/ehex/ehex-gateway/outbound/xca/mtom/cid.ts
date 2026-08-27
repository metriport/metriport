import { MetriportError } from "@metriport/shared";

const cidPrefixRegex = /^cid:/;
function stripCidPrefix(cid: string): string {
  return cid.replace(cidPrefixRegex, "");
}

function addTags(content: string): string {
  return `<${content}>`;
}

export function getCidReference(cid: string): string {
  try {
    return addTags(decodeURIComponent(stripCidPrefix(cid)));
  } catch (error) {
    throw new MetriportError("Failed to decode CID reference", error, { cid });
  }
}
