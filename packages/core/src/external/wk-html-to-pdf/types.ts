export type Orientation = "Landscape" | "Portrait";

// From https://doc.qt.io/archives/qt-4.8/qprinter.html#PaperSize-enum
export type PageSize =
  | "A0"
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "A6"
  | "A7"
  | "A8"
  | "A9"
  | "B0"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "B6"
  | "B7"
  | "B8"
  | "B9"
  | "B10"
  | "C5E"
  | "Comm10E"
  | "DLE"
  | "Executive"
  | "Folio"
  | "Ledger"
  | "Legal"
  | "Letter"
  | "Tabloid"
  | "Custom";

export type Request = {
  /**
   *  URI starting with http(s):// or s3://
   */
  uri: string;
  fileName: string;
} & WkOptions;

/**
 * Options for the wkhtmltopdf library.
 * From https://wkhtmltopdf.org/usage/wkhtmltopdf.txt
 */
export interface WkOptions {
  /** Defaults to Portrait */
  orientation?: Orientation;
  /** Defaults to A4 */
  pageSize?: PageSize;
  marginTop?: number;
  marginBottom?: number;
  /** Defaults to 10mm */
  marginRight?: number;
  /** Defaults to 10mm */
  marginLeft?: number;
  /** Defaults to true */
  grayscale?: boolean;
  /** Defaults to fase */
  removeBackground?: boolean;
}
