export const documentQueryStatus = ["processing", "completed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];

export type DocumentQueryProgress = {
  total: number;
  completed: number;
};
