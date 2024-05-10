import { detectFileType, isXMLContentType } from "../../../../../../util/file-type";
import { XML_APP_MIME_TYPE, XML_TXT_MIME_TYPE } from "../../../../../../util/mime";
import { XMLParser } from "fast-xml-parser";
import { out } from "../../../../../../util/log";

const { log } = out("[parseFileFromString] ");

type ParsedFile = {
  fileExtension: string;
  mimeType: string;
  decodedBytes: Buffer;
};

export function parseFileFromString(fileAsString: string): ParsedFile {
  let decodedBytes: Buffer;

  // with MTOM we now have non b64 encoded files in the body of the response.
  const firstSixBytesBuffer = Buffer.from(fileAsString.slice(0, 6));
  if (isXMLContentType(firstSixBytesBuffer)) {
    decodedBytes = Buffer.from(fileAsString.trim());
  } else {
    try {
      decodedBytes = Buffer.from(fileAsString, "base64");
    } catch (ex) {
      // this doesnt really work. Didnt catch the case of plain xml
      log("Got a non-base64 document! Using original fileAsString content for decodedBytes");
      decodedBytes = Buffer.from(fileAsString.trim());
    }
  }

  if (!decodedBytes) {
    const msg = "Error decoding file content - missing decodedBytes";
    log(msg);
    throw new Error(msg);
  }

  const { mimeType, fileExtension } = detectFileType(decodedBytes);
  if (mimeType === XML_TXT_MIME_TYPE || mimeType === XML_APP_MIME_TYPE) {
    return extractNonXmlBody(mimeType, fileExtension, decodedBytes, fileAsString);
  }

  return {
    mimeType,
    fileExtension,
    decodedBytes,
  };
}

function extractNonXmlBody(
  mimeType: string,
  fileExtension: string,
  decodedBytes: Buffer,
  fileAsString: string
): ParsedFile {
  let decodedString: string;
  try {
    decodedString = decodedBytes.toString();
  } catch (ex) {
    const msg = "Got a non-base64 document! Using original fileAsString content for decodedString";
    log(msg);
    decodedString = fileAsString.trim();
  }
  if (!decodedString) {
    const msg = "Error decoding file content - missing decodedString";
    log(msg);
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
      fileExtension,
      decodedBytes,
    };
  }
}
