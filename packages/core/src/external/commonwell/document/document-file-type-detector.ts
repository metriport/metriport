/**
 * The function `detectFileType` uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 * In this case, the function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers.
 *
 * @param {Buffer} fileBuffer - The `fileBuffer` parameter is a `Buffer` object that represents the
 * contents of a file. The first 5 bytes of this buffer, which form the magic number, are used to
 * identify the file type.
 * @returns The function `detectFileType` returns a string representing the detected file type.
 */
export function detectFileType(fileBuffer: Buffer): string {
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
  } else {
    throw new Error(`Unknown file type. Cannot convert document: ${fileBuffer.slice(0, 10)}`);
  }
}
