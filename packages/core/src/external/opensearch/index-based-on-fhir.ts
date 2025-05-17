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

export const indexDefinition: Record<keyof FhirIndexFields, { type: string }> = {
  cxId: { type: "keyword" },
  patientId: { type: "keyword" },
  resourceType: { type: "keyword" },
  resourceId: { type: "keyword" },
  content: { type: "text" },
  rawContent: { type: "text" },
};

export type FhirSearchResult = Omit<FhirIndexFields, "content">;
