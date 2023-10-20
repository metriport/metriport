export const validConversionTypes = ["html", "pdf"] as const;
export type ConversionType = (typeof validConversionTypes)[number];

export type Input = { fileName: string; conversionType: ConversionType };

export type Output = { url: string };
