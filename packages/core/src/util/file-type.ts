import {
  BMP_FILE_EXTENSION,
  BMP_MIME_TYPE,
  HTML_MIME_TYPE,
  JPEG_FILE_EXTENSION,
  JPEG_MIME_TYPE,
  JPG_MIME_TYPE,
  JSON_APP_MIME_TYPE,
  JSON_TXT_MIME_TYPE,
  OCTET_FILE_EXTENSION,
  OCTET_MIME_TYPE,
  PDF_FILE_EXTENSION,
  PDF_MIME_TYPE,
  PNG_FILE_EXTENSION,
  PNG_MIME_TYPE,
  TIFF_FILE_EXTENSION,
  TIFF_MIME_TYPE,
  TIF_MIME_TYPE,
  TXT_FILE_EXTENSION,
  TXT_MIME_TYPE,
  XML_APP_MIME_TYPE,
  XML_FILE_EXTENSION,
  XML_TXT_MIME_TYPE,
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
 * The function `detectFileType` uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 *
 * In this case, the function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers.
 *
 * @param document - A string that represents the contents of a file. It will be converted to a
 * Buffer in order to be processed. Prefer `detectFileTypeBuf` if you already have a Buffer object.
 * @returns a string representing the detected file type.
 */
export function detectFileType(document: string): DetectedFileType {
  const maxBytesNeeded = 6; //NOTE: if you update detectFileType, you might need to update this number
  const fileBuffer = Buffer.from(document.slice(0, maxBytesNeeded));
  return detectFileTypeBuf(fileBuffer);
}

/**
 * The function `detectFileTypeBuf` uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 *
 * In this case, the function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers.
 *
 * @param fileBuffer - The `fileBuffer` parameter is a `Buffer` object that represents the
 * contents of a file. The first 5 bytes of this buffer, which generally contain the magic number, are used to
 * identify the file type.
 * @returns a string representing the detected file type.
 */
export function detectFileTypeBuf(fileBuffer: Buffer): DetectedFileType {
  if (
    (fileBuffer[0] === TIFF_MAGIC_NUMBER_1 &&
      fileBuffer[1] === TIFF_MAGIC_NUMBER_2 &&
      fileBuffer[2] === TIFF_MAGIC_NUMBER_3 &&
      fileBuffer[3] === TIFF_MAGIC_NUMBER_4) ||
    (fileBuffer[0] === TIFF_MAGIC_NUMBER_5 &&
      fileBuffer[1] === TIFF_MAGIC_NUMBER_6 &&
      fileBuffer[2] === TIFF_MAGIC_NUMBER_7 &&
      fileBuffer[3] === TIFF_MAGIC_NUMBER_8)
  ) {
    return { mimeType: TIFF_MIME_TYPE, fileExtension: TIFF_FILE_EXTENSION };
  } else if (
    fileBuffer[0] === PDF_MAGIC_NUMBER_1 &&
    fileBuffer[1] === PDF_MAGIC_NUMBER_2 &&
    fileBuffer[2] === PDF_MAGIC_NUMBER_3 &&
    fileBuffer[3] === PDF_MAGIC_NUMBER_4 &&
    fileBuffer[4] === PDF_MAGIC_NUMBER_5
  ) {
    return { mimeType: PDF_MIME_TYPE, fileExtension: PDF_FILE_EXTENSION };
  } else if (
    fileBuffer[0] === XML_MAGIC_NUMBER_1 &&
    fileBuffer[1] === XML_MAGIC_NUMBER_2 &&
    fileBuffer[2] === XML_MAGIC_NUMBER_3 &&
    fileBuffer[3] === XML_MAGIC_NUMBER_4 &&
    fileBuffer[4] === XML_MAGIC_NUMBER_5 &&
    fileBuffer[5] === XML_MAGIC_NUMBER_6
  ) {
    return { mimeType: XML_APP_MIME_TYPE, fileExtension: XML_FILE_EXTENSION };
  } else if (
    fileBuffer[0] === PNG_MAGIC_NUMBER_1 &&
    fileBuffer[1] === PNG_MAGIC_NUMBER_2 &&
    fileBuffer[2] === PNG_MAGIC_NUMBER_3 &&
    fileBuffer[3] === PNG_MAGIC_NUMBER_4
  ) {
    return { mimeType: PNG_MIME_TYPE, fileExtension: PNG_FILE_EXTENSION };
  } else if (
    fileBuffer[0] === JPEG_MAGIC_NUMBER_1 &&
    fileBuffer[1] === JPEG_MAGIC_NUMBER_2 &&
    fileBuffer[2] === JPEG_MAGIC_NUMBER_1
  ) {
    return { mimeType: JPEG_MIME_TYPE, fileExtension: JPEG_FILE_EXTENSION };
  } else if (fileBuffer[0] === BMP_MAGIC_NUMBER_1 && fileBuffer[1] === BMP_MAGIC_NUMBER_2) {
    return { mimeType: BMP_MIME_TYPE, fileExtension: BMP_FILE_EXTENSION };
  } else if (isLikelyTextFile(fileBuffer)) {
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
