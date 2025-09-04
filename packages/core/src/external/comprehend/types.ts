import { ICD10CMEntity, RxNormEntity, SNOMEDCTEntity } from "@aws-sdk/client-comprehendmedical";

export type ComprehendType = "rxnorm" | "icd10cm" | "snomedct";
export type ComprehendEntity<T extends ComprehendType> = T extends "rxnorm"
  ? RxNormEntity
  : T extends "icd10cm"
  ? ICD10CMEntity
  : T extends "snomedct"
  ? SNOMEDCTEntity
  : never;

export interface ComprehendConfig {
  confidenceThreshold: number;
}
