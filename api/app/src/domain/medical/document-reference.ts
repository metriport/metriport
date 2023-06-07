export const documentQueryStatus = ["processing", "completed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];

export type DocumentQueryProgress = {
  status: DocumentQueryStatus;
  total?: number;
  downloadSuccess?: number;
  downloadError?: number;
  convertTotal?: number;
  convertSuccess?: number;
  convertError?: number;
};
