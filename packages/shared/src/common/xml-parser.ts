import { X2jOptions, XMLParser } from "fast-xml-parser";

export function createXMLParser(options: X2jOptions = {}): XMLParser {
  const defaultOptions: X2jOptions = {
    numberParseOptions: {
      hex: false,
      leadingZeros: false,
    },
  };

  // Merge the default options with the provided options
  const mergedOptions = { ...defaultOptions, ...options };

  return new XMLParser(mergedOptions);
}
