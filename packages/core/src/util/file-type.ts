import {
  JSON_APP_MIME_TYPE,
  JSON_TXT_MIME_TYPE,
  XML_APP_MIME_TYPE,
  XML_TXT_MIME_TYPE,
  PDF_MIME_TYPE,
  TIFF_MIME_TYPE,
  TIF_MIME_TYPE,
  PNG_MIME_TYPE,
  JPEG_MIME_TYPE,
  JPG_MIME_TYPE,
  BMP_MIME_TYPE,
  TXT_MIME_TYPE,
  OCTET_MIME_TYPE,
  HTML_MIME_TYPE,
  XML_FILE_EXTENSION,
  PDF_FILE_EXTENSION,
  TIFF_FILE_EXTENSION,
  PNG_FILE_EXTENSION,
  JPEG_FILE_EXTENSION,
  BMP_FILE_EXTENSION,
  TXT_FILE_EXTENSION,
  OCTET_FILE_EXTENSION,
} from "./mime";

const TIFF_MAGIC_NUMBER_1 = 0x49;
const TIFF_MAGIC_NUMBER_2 = 0x49;
const TIFF_MAGIC_NUMBER_3 = 0x2a;
const TIFF_MAGIC_NUMBER_4 = 0x00;
const TIFF_MAGIC_NUMBER_5 = 0x4d;
const TIFF_MAGIC_NUMBER_6 = 0x4d;
const TIFF_MAGIC_NUMBER_7 = 0x00;
const TIFF_MAGIC_NUMBER_8 = 0x2a;
const PDF_MAGIC_NUMBER_1 = 0x25;
const PDF_MAGIC_NUMBER_2 = 0x50;
const PDF_MAGIC_NUMBER_3 = 0x44;
const PDF_MAGIC_NUMBER_4 = 0x46;
const PDF_MAGIC_NUMBER_5 = 0x2d;
const XML_MAGIC_NUMBER_1 = 0x3c;
const XML_MAGIC_NUMBER_2 = 0x3f;
const XML_MAGIC_NUMBER_3 = 0x78;
const XML_MAGIC_NUMBER_4 = 0x6d;
const XML_MAGIC_NUMBER_5 = 0x6c;
const XML_MAGIC_NUMBER_6 = 0x20;
const XML_MAGIC_NUMBER_7 = 0x3c;
const XML_MAGIC_NUMBER_8 = 0x43;
const XML_MAGIC_NUMBER_9 = 0x6c;
const XML_MAGIC_NUMBER_10 = 0x69;
const XML_MAGIC_NUMBER_11 = 0x6e;
const XML_MAGIC_NUMBER_12 = 0x69;
const PNG_MAGIC_NUMBER_1 = 0x89;
const PNG_MAGIC_NUMBER_2 = 0x50;
const PNG_MAGIC_NUMBER_3 = 0x4e;
const PNG_MAGIC_NUMBER_4 = 0x47;
const JPEG_MAGIC_NUMBER_1 = 0xff;
const JPEG_MAGIC_NUMBER_2 = 0xd8;
const BMP_MAGIC_NUMBER_1 = 0x42;
const BMP_MAGIC_NUMBER_2 = 0x4d;

const ASCII_TAB = 9;
const ASCII_LINE_FEED = 10;
const ASCII_CARRIAGE_RETURN = 13;
const ASCII_SPACE = 32;
const ASCII_TILDE = 126;

export function isASCIIChar(char: number): boolean {
  return (
    char !== undefined &&
    ((char >= ASCII_SPACE && char <= ASCII_TILDE) ||
      char === ASCII_TAB ||
      char === ASCII_LINE_FEED ||
      char === ASCII_CARRIAGE_RETURN)
  );
}

export function isLikelyTextFile(fileBuffer: Buffer): boolean {
  let readableChars = 0;
  let nonReadableChars = 0;

  for (let i = 0; i < fileBuffer.length; i++) {
    const char = fileBuffer[i];
    if (char !== undefined && isASCIIChar(char)) {
      readableChars++;
    } else {
      nonReadableChars++;
    }
  }

  const totalChars = readableChars + nonReadableChars;
  const threshold = 0.85; // 85% of the characters should be readable
  return readableChars / totalChars > threshold;
}

export type DetectedFileType = {
  mimeType: string;
  fileExtension: string;
};

/**
 * It uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 *
 * The function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers. If it can't identify the file with magic numbers,
 * it tries to determine if the file is a text file by checking if the majority of the first chars
 * are ASCII characters.
 *
 * Otherwise, it returns the default file type `application/octet-stream`.
 *
 * @param fileBuffer - The `fileBuffer` parameter is a `Buffer` object that represents the
 * contents of a file.
 * @returns an object containing the detected file type and extension.
 */
export function detectFileType(param: Buffer | string): DetectedFileType {
  let documentBuffer: Buffer;
  if (Buffer.isBuffer(param)) {
    documentBuffer = param;
  } else {
    documentBuffer = Buffer.from(param);
  }
  const maxBytesNeeded = 6;
  const bytesBuffer = documentBuffer.slice(0, maxBytesNeeded);
  if (
    (bytesBuffer[0] === TIFF_MAGIC_NUMBER_1 &&
      bytesBuffer[1] === TIFF_MAGIC_NUMBER_2 &&
      bytesBuffer[2] === TIFF_MAGIC_NUMBER_3 &&
      bytesBuffer[3] === TIFF_MAGIC_NUMBER_4) ||
    (bytesBuffer[0] === TIFF_MAGIC_NUMBER_5 &&
      bytesBuffer[1] === TIFF_MAGIC_NUMBER_6 &&
      bytesBuffer[2] === TIFF_MAGIC_NUMBER_7 &&
      bytesBuffer[3] === TIFF_MAGIC_NUMBER_8)
  ) {
    return { mimeType: TIFF_MIME_TYPE, fileExtension: TIFF_FILE_EXTENSION };
  } else if (
    bytesBuffer[0] === PDF_MAGIC_NUMBER_1 &&
    bytesBuffer[1] === PDF_MAGIC_NUMBER_2 &&
    bytesBuffer[2] === PDF_MAGIC_NUMBER_3 &&
    bytesBuffer[3] === PDF_MAGIC_NUMBER_4 &&
    bytesBuffer[4] === PDF_MAGIC_NUMBER_5
  ) {
    return { mimeType: PDF_MIME_TYPE, fileExtension: PDF_FILE_EXTENSION };
  } else if (
    (bytesBuffer[0] === XML_MAGIC_NUMBER_1 &&
      bytesBuffer[1] === XML_MAGIC_NUMBER_2 &&
      bytesBuffer[2] === XML_MAGIC_NUMBER_3 &&
      bytesBuffer[3] === XML_MAGIC_NUMBER_4 &&
      bytesBuffer[4] === XML_MAGIC_NUMBER_5 &&
      bytesBuffer[5] === XML_MAGIC_NUMBER_6) ||
    (bytesBuffer[0] === XML_MAGIC_NUMBER_7 &&
      bytesBuffer[1] === XML_MAGIC_NUMBER_8 &&
      bytesBuffer[2] === XML_MAGIC_NUMBER_9 &&
      bytesBuffer[3] === XML_MAGIC_NUMBER_10 &&
      bytesBuffer[4] === XML_MAGIC_NUMBER_11 &&
      bytesBuffer[5] === XML_MAGIC_NUMBER_12)
  ) {
    return { mimeType: XML_APP_MIME_TYPE, fileExtension: XML_FILE_EXTENSION };
  } else if (
    bytesBuffer[0] === PNG_MAGIC_NUMBER_1 &&
    bytesBuffer[1] === PNG_MAGIC_NUMBER_2 &&
    bytesBuffer[2] === PNG_MAGIC_NUMBER_3 &&
    bytesBuffer[3] === PNG_MAGIC_NUMBER_4
  ) {
    return { mimeType: PNG_MIME_TYPE, fileExtension: PNG_FILE_EXTENSION };
  } else if (
    bytesBuffer[0] === JPEG_MAGIC_NUMBER_1 &&
    bytesBuffer[1] === JPEG_MAGIC_NUMBER_2 &&
    bytesBuffer[2] === JPEG_MAGIC_NUMBER_1
  ) {
    return { mimeType: JPEG_MIME_TYPE, fileExtension: JPEG_FILE_EXTENSION };
  } else if (bytesBuffer[0] === BMP_MAGIC_NUMBER_1 && bytesBuffer[1] === BMP_MAGIC_NUMBER_2) {
    return { mimeType: BMP_MIME_TYPE, fileExtension: BMP_FILE_EXTENSION };
  } else if (isLikelyTextFile(bytesBuffer)) {
    return { mimeType: TXT_MIME_TYPE, fileExtension: TXT_FILE_EXTENSION };
  } else {
    return { mimeType: OCTET_MIME_TYPE, fileExtension: OCTET_FILE_EXTENSION };
  }
}
/**
 * The function checks if the MIME type of a document is accepted based on a predefined list of
 * accepted content types. Returns true if accepted
 * @param document - A document object that contains the MIME type of the document.
 * @returns The function isContentTypeAccepted is returning a boolean value.
 */

export function isContentTypeAccepted(mimeType: string | undefined): boolean {
  const acceptedContentTypes = [
    JSON_APP_MIME_TYPE,
    JSON_TXT_MIME_TYPE,
    XML_APP_MIME_TYPE,
    XML_TXT_MIME_TYPE,
    PDF_MIME_TYPE,
    TIFF_MIME_TYPE,
    TIF_MIME_TYPE,
    PNG_MIME_TYPE,
    JPEG_MIME_TYPE,
    JPG_MIME_TYPE,
    BMP_MIME_TYPE,
    TXT_MIME_TYPE,
    HTML_MIME_TYPE,
  ];

  return !!mimeType && acceptedContentTypes.includes(mimeType);
}
