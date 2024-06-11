import { XMLParser } from "fast-xml-parser";
import { Iti39Request, iti39RequestSchema } from "./schema";

export function processDrRequest(request: string): Iti39Request {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const iti39Request = iti39RequestSchema.parse(jsonObj);
    return iti39Request;
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to parse ITI-39 request: ${error}`);
  }
}
