function isLikelyTextFile(fileBuffer: Buffer): boolean {
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
  console.log(
    `readableChars: ${readableChars}, nonReadableChars: ${nonReadableChars}, totalChars: ${totalChars}`
  );
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
    (fileBuffer[0] === 0x49 &&
      fileBuffer[1] === 0x49 &&
      fileBuffer[2] === 0x2a &&
      fileBuffer[3] === 0x00) ||
    (fileBuffer[0] === 0x4d &&
      fileBuffer[1] === 0x4d &&
      fileBuffer[2] === 0x00 &&
      fileBuffer[3] === 0x2a)
  ) {
    return ["image/tiff", ".tiff"];
  } else if (
    fileBuffer[0] === 0x25 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x44 &&
    fileBuffer[3] === 0x46 &&
    fileBuffer[4] === 0x2d
  ) {
    return ["application/pdf", ".pdf"];
  } else if (
    fileBuffer[0] === 0x3c &&
    fileBuffer[1] === 0x3f &&
    fileBuffer[2] === 0x78 &&
    fileBuffer[3] === 0x6d &&
    fileBuffer[4] === 0x6c &&
    fileBuffer[5] === 0x20
  ) {
    return ["application/xml", ".xml"];
  } else if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47
  ) {
    return ["image/png", ".png"];
  } else if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    return ["image/jpeg", ".jpeg"];
  } else if (fileBuffer[0] === 0x42 && fileBuffer[1] === 0x4d) {
    return ["image/bmp", ".bmp"];
  } else if (isLikelyTextFile(fileBuffer)) {
    return ["text/plain", ".txt"];
  } else {
    throw new Error(`Could not determine file type}`);
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
