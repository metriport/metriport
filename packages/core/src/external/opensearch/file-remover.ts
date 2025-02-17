export type OpenSearchFileRemoverConfig = {
  region: string;
  indexName: string;
};

export interface OpenSearchFileRemover {
  remove(entryId: string): Promise<void>;
}
