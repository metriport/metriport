const cidPrefixRegex = /^cid:/;
function stripCidPrefix(cid: string): string {
  return cid.replace(cidPrefixRegex, "");
}

function addTags(content: string): string {
  return `<${content}>`;
}

export function getCidReference(cid: string): string {
  return addTags(decodeURIComponent(stripCidPrefix(cid)));
}
