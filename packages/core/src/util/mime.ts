import { contentType, extension } from "mime-types";

/**
 * Returns boolean indicating whether a given MIME type is XML.
 * This takes into consideration of our usage of XMLs, which based on "pure"
 * XMLs. This is because there are specific application formats that add
 * "+xml" to the end of their MIME type, which were not considering here.
 * Examples: "application/xhtml+xml", "application/atom+xml".
 * See: https://en.wikipedia.org/wiki/XML_and_MIME
 */
export function isMimeTypeXML(mimeType?: string | undefined | null): boolean {
  return mimeType === XML_APP_MIME_TYPE || mimeType === XML_TXT_MIME_TYPE;
}

// define exportable constants for all the different file types
export const FHIR_APP_MIME_TYPE = "application/fhir+json";
export const JSON_APP_MIME_TYPE = "application/json";
export const JSON_TXT_MIME_TYPE = "text/json";
export const JSON_FILE_EXTENSION = "json";
export const PDF_MIME_TYPE = "application/pdf";
export const PDF_FILE_EXTENSION = "pdf";
export const XML_APP_MIME_TYPE = "application/xml";
export const XML_TXT_MIME_TYPE = "text/xml";
export const XML_FILE_EXTENSION = "xml";
export const CSV_MIME_TYPE = "text/csv";
export const CSV_FILE_EXTENSION = "csv";
export const TIFF_MIME_TYPE = "image/tiff";
export const TIFF_FILE_EXTENSION = "tiff";
export const TIF_MIME_TYPE = "image/tif";
export const TIF_FILE_EXTENSION = "tif";
export const PNG_MIME_TYPE = "image/png";
export const PNG_FILE_EXTENSION = "png";
export const JPEG_MIME_TYPE = "image/jpeg";
export const JPEG_FILE_EXTENSION = "jpeg";
export const JPG_MIME_TYPE = "image/jpg";
export const JPG_FILE_EXTENSION = "jpg";
export const BMP_MIME_TYPE = "image/bmp";
export const BMP_FILE_EXTENSION = "bmp";
export const TXT_MIME_TYPE = "text/plain";
export const TXT_FILE_EXTENSION = "txt";
export const NDJSON_MIME_TYPE = "application/x-ndjson";
export const NDJSON_FILE_EXTENSION = "ndjson";
export const OCTET_MIME_TYPE = "application/octet-stream";
export const OCTET_FILE_EXTENSION = "bin";
export const HTML_MIME_TYPE = "text/html";
export const HTML_FILE_EXTENSION = "html";
export const TXT_RTF_MIME_TYPE = "text/rtf";
export const HL7_FILE_EXTENSION = "hl7";

export const BINARY_MIME_TYPES = [
  PDF_MIME_TYPE,
  TIFF_MIME_TYPE,
  TIF_MIME_TYPE,
  PNG_MIME_TYPE,
  JPEG_MIME_TYPE,
  JPG_MIME_TYPE,
  BMP_MIME_TYPE,
  OCTET_MIME_TYPE,
  TXT_RTF_MIME_TYPE,
];

/**
 * Returns a file extension based on a given MIME type.
 */
export function getFileExtension(value: string | undefined): string {
  if (!value || !contentType(value)) return "";
  const fileExtension = extension(value);
  return fileExtension ? `.${fileExtension}` : "";
}

export function isXml(mimeType: string): boolean {
  return mimeType === XML_APP_MIME_TYPE || mimeType === XML_TXT_MIME_TYPE;
}
