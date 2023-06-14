import { z } from "zod";

export const documentQueryStatus = ["processing", "completed", "failed"] as const;
export type DocumentQueryStatus = (typeof documentQueryStatus)[number];

export type Progress = {
  status: DocumentQueryStatus;
  total?: number;
  successful?: number;
  errors?: number;
};

export type DocumentQueryProgress = {
  /**
   * @deprecated
   */
  queryStatus?: DocumentQueryStatus;
  /**
   * @deprecated
   */
  queryProgress?: {
    total?: number;
    completed?: number;
  };
  download?: Progress;
  convert?: Progress;
};

export const convertResultSchema = z.enum(["success", "failed"]);

export type ConvertResult = z.infer<typeof convertResultSchema>;
