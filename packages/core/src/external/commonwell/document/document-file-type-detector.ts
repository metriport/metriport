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
  const header = fileBuffer.slice(0, 5).toString();
  console.log(`Detected file type: ${header}`);
  switch (header) {
    case "%PDF":
      return "pdf";
    case "\u0089PNG":
      return "png";
    case "GIF8":
      return "gif";
    case "<?xm":
      return "xml";
    case "II*(":
      return "tiff";
    default:
      throw new Error(`Unknown file type. Cannot convert document: ${header}`);
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
