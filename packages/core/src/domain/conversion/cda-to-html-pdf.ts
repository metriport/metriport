export const validConversionTypes = ["html", "pdf"] as const;
export type ConversionType = (typeof validConversionTypes)[number];

export type Input = {
  cxId: string;
  fileName: string;
  conversionType: ConversionType;
  bucketName: string;
  resultFileNameSuffix?: string;
};

export type Output = { url: string };
