import { contentFieldName } from "./index";

export type IndexFields = {
  cxId: string;
  patientId: string;
  resourceType: string;
  resourceId: string;
  [contentFieldName]: string;
};

export const indexDefinition: Record<keyof IndexFields, { type: string }> = {
  cxId: { type: "keyword" },
  patientId: { type: "keyword" },
  resourceType: { type: "keyword" },
  resourceId: { type: "keyword" },
  content: { type: "text" },
};

export type SearchResult = Omit<IndexFields, "content"> & { id: string };
