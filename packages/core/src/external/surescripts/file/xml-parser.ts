import { parseStringPromise } from "xml2js";

export function parseXmlResponse(responseFileContent: Buffer): Promise<unknown> {
  const xml = responseFileContent.toString();
  const result = parseStringPromise(xml);
  return result;
}
