import { Document } from "./document-downloader";

/**
 * The function `detectFileType` uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 * In this case, the function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers.
 *
 * @param {Buffer} fileBuffer - The `fileBuffer` parameter is a `Buffer` object that represents the
 * contents of a file. The first 5 bytes of this buffer, which generally contain the magic number, are used to
 * identify the file type.
 * @returns The function `detectFileType` returns a string representing the detected file type.
 */
export function detectFileType(fileBuffer: Buffer, document: Document): string {
  console.log(`Detecting file type for file: ${fileBuffer.slice(0, 10).toString("hex")}`);
  if (
    (fileBuffer[0] === 0x49 &&
      fileBuffer[1] === 0x49 &&
      fileBuffer[2] === 0x2a &&
      fileBuffer[3] === 0x00) ||
    (fileBuffer[0] === 0x4d &&
      fileBuffer[1] === 0x4d &&
      fileBuffer[2] === 0x00 &&
      fileBuffer[3] === 0x2a)
  ) {
    console.log(`Detected file type: image/tiff`);
    return "image/tiff";
  } else if (
    fileBuffer[0] === 0x25 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x44 &&
    fileBuffer[3] === 0x46 &&
    fileBuffer[4] === 0x2d
  ) {
    console.log(`Detected file type: application/pdf`);
    return "application/pdf";
  } else if (
    fileBuffer[0] === 0x3c &&
    fileBuffer[1] === 0x3f &&
    fileBuffer[2] === 0x78 &&
    fileBuffer[3] === 0x6d &&
    fileBuffer[4] === 0x6c &&
    fileBuffer[5] === 0x20
  ) {
    console.log(`Detected file type: text/xml`);
    return "application/xml";
  } else if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47
  ) {
    console.log(`Detected file type: image/png`);
    return "image/png";
  } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    console.log(`Detected file type: image/jpeg`);
    return "image/jpeg";
  } else if (fileBuffer[0] === 0x42 && fileBuffer[1] === 0x4d) {
    console.log(`Detected file type: image/bmp`);
    return "image/bmp";
  } else {
    throw new Error(`Could not determine file type for document: ${document.id}`);
  }
}
/**
 * The function checks if the MIME type of a document is accepted based on a predefined list of
 * accepted content types. Returns true if accepted
 * @param {Document} document - A document object that contains the MIME type of the document.
 * @returns The function isContentTypeAccepted is returning a boolean value.
 */

export function isContentTypeAccepted(document: Document): boolean {
  const acceptedContentTypes = [
    "image/tiff",
    "image/tif",
    "text/xml",
    "application/xml",
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "application/json",
    "text/html",
  ];

  return !!document.mimeType && acceptedContentTypes.includes(document.mimeType);
}
