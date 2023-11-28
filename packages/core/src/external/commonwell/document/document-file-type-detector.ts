import { Transform } from "stream";
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
function detectFileType(fileBuffer: Buffer): string {
  console.log(`fileBuffer bytes: ${fileBuffer.toString("hex")}`);
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
    return "image/tiff";
  } else if (
    fileBuffer[0] === 0x25 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x44 &&
    fileBuffer[3] === 0x46 &&
    fileBuffer[4] === 0x2d
  ) {
    return "application/pdf";
  } else if (
    fileBuffer[0] === 0x3c &&
    fileBuffer[1] === 0x3f &&
    fileBuffer[2] === 0x78 &&
    fileBuffer[3] === 0x6d &&
    fileBuffer[4] === 0x6c &&
    fileBuffer[5] === 0x20
  ) {
    return "application/xml";
  } else if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47
  ) {
    return "image/png";
  } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    return "image/jpeg";
  } else {
    throw new Error(`Unknown file type. Cannot convert document: ${fileBuffer.slice(0, 10)}`);
  }
}

export class FileTypeDetectingStream extends Transform {
  private header = "";
  private detectedFileType = "";

  override _transform(
    chunk: Buffer,
    encoding: string,
    callback: (error?: Error | null, data?: Buffer) => void
  ) {
    if (!this.detectedFileType) {
      this.header += chunk.toString();
      if (this.header.length >= 5) {
        try {
          this.detectedFileType = detectFileType(Buffer.from(this.header.slice(0, 5)));
        } catch (error: unknown) {
          if (error instanceof Error) {
            return callback(error);
          }
          return callback(new Error("An unexpected error occurred"));
        }
      }
    }
    callback(null, chunk);
  }

  getDetectedFileType() {
    return this.detectedFileType;
  }
}
