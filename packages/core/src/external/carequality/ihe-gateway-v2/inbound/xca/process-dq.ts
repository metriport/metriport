import { XMLParser } from "fast-xml-parser";
import { Iti38Request, iti38RequestSchema } from "./schema";

export function processDqRequest(request: string): Iti38Request {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });
  const jsonObj = parser.parse(request);
  try {
    const iti38Request = iti38RequestSchema.parse(jsonObj);
    return iti38Request;
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to parse ITI-38 request: ${error}`);
  }
}
