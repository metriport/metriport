const cidPrefixRegex = /^cid:/;
const endTagRegex = /^<|>$/g;
export function stripCidPrefix(cid: string): string {
  return cid.replace(cidPrefixRegex, "");
}

export function stripTags(content: string): string {
  return content.replace(endTagRegex, "");
}
