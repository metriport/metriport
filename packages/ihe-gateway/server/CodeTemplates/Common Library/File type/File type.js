const JSON_APP_MIME_TYPE = "application/json";
const JSON_TXT_MIME_TYPE = "text/json";
const PDF_MIME_TYPE = "application/pdf";
const PDF_FILE_EXTENSION = ".pdf";
const XML_APP_MIME_TYPE = "application/xml";
const XML_TXT_MIME_TYPE = "text/xml";
const XML_FILE_EXTENSION = ".xml";
const TIFF_MIME_TYPE = "image/tiff";
const TIFF_FILE_EXTENSION = ".tiff";
const TIF_MIME_TYPE = "image/tif";
const PNG_MIME_TYPE = "image/png";
const PNG_FILE_EXTENSION = ".png";
const JPEG_MIME_TYPE = "image/jpeg";
const JPEG_FILE_EXTENSION = ".jpeg";
const JPG_MIME_TYPE = "image/jpg";
const BMP_MIME_TYPE = "image/bmp";
const BMP_FILE_EXTENSION = ".bmp";
const TXT_MIME_TYPE = "text/plain";
const TXT_FILE_EXTENSION = ".txt";
const OCTET_MIME_TYPE = "application/octet-stream";
const OCTET_FILE_EXTENSION = ".bin";
const HTML_MIME_TYPE = "text/html";
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
const XML_CLINICAL_MAGIC_NUMBER_1 = 0x3c;
const XML_CLINICAL_MAGIC_NUMBER_2 = 0x43;
const XML_CLINICAL_MAGIC_NUMBER_3 = 0x6c;
const XML_CLINICAL_MAGIC_NUMBER_4 = 0x69;
const XML_CLINICAL_MAGIC_NUMBER_5 = 0x6e;
const XML_CLINICAL_MAGIC_NUMBER_6 = 0x69;
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

function isASCIIChar(char) {
  return (
    char !== undefined &&
    ((char >= ASCII_SPACE && char <= ASCII_TILDE) ||
      char === ASCII_TAB ||
      char === ASCII_LINE_FEED ||
      char === ASCII_CARRIAGE_RETURN)
  );
}

function isLikelyTextFile(fileBuffer) {
  var readableChars = 0;
  var nonReadableChars = 0;
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

function isLikelyXML(contents) {
  if (contents) {
    if (contents.startsWith("<?xml") || contents.startsWith("<ClinicalDocument")) {
      return true;
    }
  }
  return false;
}

/**
 * Uses magic numbers to determine the file type of a given file.
 * Magic numbers are unique sequences of bytes that identify the file format or protocol.
 * In this case, the function reads the first 5 bytes (the magic number) of the file buffer and
 * matches it against known file type headers.
 *
 * @param fileBuffer - The contents as bytes.
 * @param decodedString - The contents as string.
 * @returns returns a string representing the detected file type.
 */
function detectFileType(decodedBytes, decodedString) {
  let fileBuffer = new Array(6).fill(0).map((_, i) => decodedBytes[i] & 0xFF);
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
    return [TIFF_MIME_TYPE, TIFF_FILE_EXTENSION];
  } else if (
    fileBuffer[0] === PDF_MAGIC_NUMBER_1 &&
    fileBuffer[1] === PDF_MAGIC_NUMBER_2 &&
    fileBuffer[2] === PDF_MAGIC_NUMBER_3 &&
    fileBuffer[3] === PDF_MAGIC_NUMBER_4 &&
    fileBuffer[4] === PDF_MAGIC_NUMBER_5
  ) {
    return [PDF_MIME_TYPE, PDF_FILE_EXTENSION];
  } else if (
    fileBuffer[0] === XML_CLINICAL_MAGIC_NUMBER_1 &&
    fileBuffer[1] === XML_CLINICAL_MAGIC_NUMBER_2 &&
    fileBuffer[2] === XML_CLINICAL_MAGIC_NUMBER_3 &&
    fileBuffer[3] === XML_CLINICAL_MAGIC_NUMBER_4 &&
    fileBuffer[4] === XML_CLINICAL_MAGIC_NUMBER_5 &&
    fileBuffer[5] === XML_CLINICAL_MAGIC_NUMBER_6
  ) {
    return [XML_APP_MIME_TYPE, XML_FILE_EXTENSION];
  } else if (
    fileBuffer[0] === XML_MAGIC_NUMBER_1 &&
    fileBuffer[1] === XML_MAGIC_NUMBER_2 &&
    fileBuffer[2] === XML_MAGIC_NUMBER_3 &&
    fileBuffer[3] === XML_MAGIC_NUMBER_4 &&
    fileBuffer[4] === XML_MAGIC_NUMBER_5 &&
    fileBuffer[5] === XML_MAGIC_NUMBER_6
  ) {
    return [XML_APP_MIME_TYPE, XML_FILE_EXTENSION];
  } else if (
    fileBuffer[0] === PNG_MAGIC_NUMBER_1 &&
    fileBuffer[1] === PNG_MAGIC_NUMBER_2 &&
    fileBuffer[2] === PNG_MAGIC_NUMBER_3 &&
    fileBuffer[3] === PNG_MAGIC_NUMBER_4
  ) {
    return [PNG_MIME_TYPE, PNG_FILE_EXTENSION];
  } else if (
    fileBuffer[0] === JPEG_MAGIC_NUMBER_1 &&
    fileBuffer[1] === JPEG_MAGIC_NUMBER_2 &&
    fileBuffer[2] === JPEG_MAGIC_NUMBER_1
  ) {
    return [JPEG_MIME_TYPE, JPEG_FILE_EXTENSION];
  } else if (fileBuffer[0] === BMP_MAGIC_NUMBER_1 && fileBuffer[1] === BMP_MAGIC_NUMBER_2) {
    return [BMP_MIME_TYPE, BMP_FILE_EXTENSION];
  } else if (isLikelyXML(decodedString)) {
    return [XML_TXT_MIME_TYPE, XML_FILE_EXTENSION];
  } else if (isLikelyTextFile(decodedString)) {
    return [TXT_MIME_TYPE, TXT_FILE_EXTENSION];
  } else {
    return [OCTET_MIME_TYPE, OCTET_FILE_EXTENSION];
  }
}

function isText(contentType) {
  return (
    contentType === TXT_MIME_TYPE ||
    contentType === HTML_MIME_TYPE ||
    contentType === XML_TXT_MIME_TYPE ||
    contentType === JSON_APP_MIME_TYPE ||
    contentType === JSON_TXT_MIME_TYPE
  );
}
