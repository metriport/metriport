import { contentFieldName } from "./index";

export type IndexFields = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  [contentFieldName]: string;
};

export type SearchResult = Omit<IndexFields, "content"> & {
  entryId: string;
};
