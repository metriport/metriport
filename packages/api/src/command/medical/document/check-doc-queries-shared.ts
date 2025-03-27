import { Progress } from "@metriport/core/domain/document-query";

export type MainProgressProps = keyof Pick<Progress, "total">;

export type SingleValidationResult = MainProgressProps | undefined;
export type GroupedValidationResult = {
  cxId: string; // needed downstream
  requestId: string; // needed downstream
  commonwell?: {
    convert?: SingleValidationResult;
    download?: SingleValidationResult;
  };
  carequality?: {
    convert?: SingleValidationResult;
    download?: SingleValidationResult;
  };
  unknown?: {
    convert?: SingleValidationResult;
    download?: SingleValidationResult;
  };
};
export type PatientsWithValidationResult = Record<string, GroupedValidationResult>;
