export type Orientation = "Landscape" | "Portrait";

export type Request = {
  /**
   *  URI starting with http(s):// or s3://
   */
  uri: string;
  fileName: string;
} & WkOptions;

export interface WkOptions {
  /**
   * Defaults to Portrait
   */
  orientation?: Orientation;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}
