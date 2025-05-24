import { Patient } from "../../../../domain/patient";

export type SearchConsolidatedParams = {
  patient: Patient;
  query: string | undefined;
  // TODO eng-268 temporary while we don't choose one approach
  useFhir?: boolean | undefined;
};

export type SearchConsolidatedResult = {
  url?: string;
  resourceCount: number;
};

export interface SearchConsolidated {
  search({ patient, query }: SearchConsolidatedParams): Promise<SearchConsolidatedResult>;
}
