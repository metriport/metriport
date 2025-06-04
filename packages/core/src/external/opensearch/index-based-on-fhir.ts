import { contentFieldName } from "./index";

export const rawContentFieldName = "rawContent";

export type FhirIndexFields = {
  cxId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  ingestionDate?: string; // TODO ENG-403 make this required after we ship this and migrate past pts
  [contentFieldName]: string;
  [rawContentFieldName]: string;
};

export type FhirSearchResult = Omit<FhirIndexFields, "content"> & { entryId: string };
