import { Progress } from "@metriport/core/domain/document-query";

export type MainProgressProps = keyof Pick<Progress, "total" | "status">;

export type SingleValidationResult = MainProgressProps | "both" | undefined;
export type GroupedValidationResult = {
  cxId: string; // needed downstream
  convert?: SingleValidationResult;
  download?: SingleValidationResult;
  carequalityPatientDiscoveryStatus?: boolean;
};
export type PatientsWithValidationResult = Record<string, GroupedValidationResult>;
