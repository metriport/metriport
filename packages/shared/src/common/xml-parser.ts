import { XMLParser, X2jOptionsOptional } from "fast-xml-parser";

export function createXMLParser(options: X2jOptionsOptional = {}): XMLParser {
  const defaultOptions: X2jOptionsOptional = {
    numberParseOptions: {
      hex: false,
      leadingZeros: false,
    },
  };

  // Merge the default options with the provided options
  const mergedOptions = { ...defaultOptions, ...options };

  return new XMLParser(mergedOptions);
}
