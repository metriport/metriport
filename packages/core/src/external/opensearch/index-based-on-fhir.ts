import { contentFieldName } from "./index";

export const rawContentFieldName = "rawContent";

export type FhirIndexFields = {
  cxId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  [contentFieldName]: string;
  [rawContentFieldName]: string;
};

export type FhirSearchResult = Omit<FhirIndexFields, "content"> & { id: string };
