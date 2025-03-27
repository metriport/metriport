export type Source = "commonwell" | "carequality" | "unknown";
export type ProgressType = "convert" | "download";
export type GroupedValidationResult = {
  cxId: string;
  requestId: string;
  commonwell?: {
    convert?: boolean;
    download?: boolean;
  };
  carequality?: {
    convert?: boolean;
    download?: boolean;
  };
  unknown?: {
    convert?: boolean;
    download?: boolean;
  };
};
export type PatientsWithValidationResult = Record<string, GroupedValidationResult>;
