import { XMLParser } from "fast-xml-parser";
import { Iti55Request, iti55RequestSchema } from "./schema";

export function processXcpdRequest(request: string): Iti55Request {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const iti55Request = iti55RequestSchema.parse(jsonObj);
    return iti55Request;
  } catch (error) {
    throw new Error(`Failed to parse ITI-55 request: ${error}`);
  }
}
