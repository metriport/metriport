import { parseStringPromise } from "xml2js";

// TODO: ENG-484 - Parse NCPDP script format from Surescripts
export function parseXmlResponse(responseFileContent: Buffer): Promise<unknown> {
  const xml = responseFileContent.toString();
  const result = parseStringPromise(xml);
  return result;
}
