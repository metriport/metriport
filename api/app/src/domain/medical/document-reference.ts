export const documentQueryStatus = ["processing", "completed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];
