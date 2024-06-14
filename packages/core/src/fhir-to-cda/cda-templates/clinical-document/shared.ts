import { XMLBuilder } from "fast-xml-parser";

export const xmlBuilder = new XMLBuilder({
  format: false,
  attributeNamePrefix: "_",
  ignoreAttributes: false,
  suppressBooleanAttributes: false,
});
