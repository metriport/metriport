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

export function isLikelyTextFile(fileBuffer: Buffer): boolean {
  let readableChars = 0;
  let nonReadableChars = 0;

  for (let i = 0; i < fileBuffer.length; i++) {
    const char = fileBuffer[i];
    if (
      char !== undefined &&
      ((char >= 32 && char <= 126) || char === 9 || char === 10 || char === 13)
    ) {
      // Common ASCII characters and whitespace/control characters (tab, line feed, carriage return)
      readableChars++;
    } else {
      nonReadableChars++;
    }
  }

  const totalChars = readableChars + nonReadableChars;
  const threshold = 0.85; // 85% of the characters should be readable
  return readableChars / totalChars > threshold;
}

/**
 * The function `detectFileType` uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 * In this case, the function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers.
 *
 * @param fileBuffer - The `fileBuffer` parameter is a `Buffer` object that represents the
 * contents of a file. The first 5 bytes of this buffer, which generally contain the magic number, are used to
 * identify the file type.
 * @returns The function `detectFileType` returns a string representing the detected file type.
 */
export function detectFileType(fileBuffer: Buffer): [string, string] {
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
    return ["image/tiff", ".tiff"];
  } else if (
    fileBuffer[0] === PDF_MAGIC_NUMBER_1 &&
    fileBuffer[1] === PDF_MAGIC_NUMBER_2 &&
    fileBuffer[2] === PDF_MAGIC_NUMBER_3 &&
    fileBuffer[3] === PDF_MAGIC_NUMBER_4 &&
    fileBuffer[4] === PDF_MAGIC_NUMBER_5
  ) {
    return ["application/pdf", ".pdf"];
  } else if (
    fileBuffer[0] === XML_MAGIC_NUMBER_1 &&
    fileBuffer[1] === XML_MAGIC_NUMBER_2 &&
    fileBuffer[2] === XML_MAGIC_NUMBER_3 &&
    fileBuffer[3] === XML_MAGIC_NUMBER_4 &&
    fileBuffer[4] === XML_MAGIC_NUMBER_5 &&
    fileBuffer[5] === XML_MAGIC_NUMBER_6
  ) {
    return ["application/xml", ".xml"];
  } else if (
    fileBuffer[0] === PNG_MAGIC_NUMBER_1 &&
    fileBuffer[1] === PNG_MAGIC_NUMBER_2 &&
    fileBuffer[2] === PNG_MAGIC_NUMBER_3 &&
    fileBuffer[3] === PNG_MAGIC_NUMBER_4
  ) {
    return ["image/png", ".png"];
  } else if (
    fileBuffer[0] === JPEG_MAGIC_NUMBER_1 &&
    fileBuffer[1] === JPEG_MAGIC_NUMBER_2 &&
    fileBuffer[2] === JPEG_MAGIC_NUMBER_1
  ) {
    return ["image/jpeg", ".jpeg"];
  } else if (fileBuffer[0] === BMP_MAGIC_NUMBER_1 && fileBuffer[1] === BMP_MAGIC_NUMBER_2) {
    return ["image/bmp", ".bmp"];
  } else {
    return ["application/octet-stream", ".bin"];
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
    "application/json",
    "application/pdf",
    "application/xml",
    "image/bmp",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/tif",
    "image/tiff",
    "text/html",
    "text/xml",
  ];

  return !!mimeType && acceptedContentTypes.includes(mimeType);
}
