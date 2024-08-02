export const consolidationConversionType = ["html", "pdf", "json"] as const;

export type ConsolidationConversionType = (typeof consolidationConversionType)[number];
