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

export const convertResult = ["success", "failed"] as const;
export type ConvertResult = (typeof convertResult)[number];
