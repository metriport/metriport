import { detectFileType } from "../../../../util/file-type";
import { XML_APP_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../../../util/mime";
import { XMLParser } from "fast-xml-parser";
import { out } from "../../../../util/log";

const { log } = out("[parseFileFromString] ");

type ParsedFile = {
  extension: string;
  mimeType: string;
  decodedBytes: Buffer;
};

export function parseFileFromString(fileAsString: string): ParsedFile {
  let decodedBytes: Buffer;

  try {
    decodedBytes = Buffer.from(fileAsString, "base64");
  } catch (ex) {
    log("Got a non-base64 document! Using original fileAsString content for decodedBytes");
    decodedBytes = Buffer.from(fileAsString.trim());
  }

  if (!decodedBytes) {
    const msg = "Error decoding file content - missing decodedBytes";
    log(msg);
    throw new Error(msg);
  }

  const { mimeType, extension } = detectFileType(decodedBytes);
  if (mimeType === XML_TXT_MIME_TYPE || mimeType === XML_APP_MIME_TYPE) {
    return extractNonXmlBody(mimeType, extension, decodedBytes, fileAsString);
  }

  return {
    mimeType,
    extension,
    decodedBytes,
  };
}

function extractNonXmlBody(
  mimeType: string,
  extension: string,
  decodedBytes: Buffer,
  fileAsString: string
): ParsedFile {
  let decodedString: string;
  try {
    decodedString = decodedBytes.toString();
  } catch (ex) {
    log("Got a non-base64 document! Using original fileAsString content for decodedString");
    decodedString = fileAsString.trim();
  }
  if (!decodedString) {
    const msg = "Error decoding file content - missing decodedString";
    console.error(msg);
    throw new Error(msg);
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    textNodeName: "_text",
    parseAttributeValue: false,
    removeNSPrefix: true,
  });

  const cda = parser.parse(decodedString);
  const nonXMLBody = cda?.ClinicalDocument?.component?.nonXMLBody;
  if (nonXMLBody?.text?._text) {
    return parseFileFromString(nonXMLBody.text._text);
  } else {
    return {
      mimeType,
      extension,
      decodedBytes,
    };
  }
}
