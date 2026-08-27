import { parseStringPromise } from "xml2js";

export function open(v: string) {
  return `<${v}>`;
}
export function close(v: string) {
  return `</${v}>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cleanupAndParseXmlString(xmlContents: string): Promise<any> {
  return parseStringPromise(cleanupXmlString(xmlContents));
}

/**
 * This function removes non-escaped ampersand characters from a string. Should be used before parsing XML.
 * @returns The cleaned up XML string.
 */
export function cleanupXmlString(xmlContents: string): string {
  return xmlContents.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
}
