import { contentFieldName } from "./index";

export type IndexFields = {
  cxId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  [contentFieldName]: string;
};

export type SearchResult = Omit<IndexFields, "content">;
