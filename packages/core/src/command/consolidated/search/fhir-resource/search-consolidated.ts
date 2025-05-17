import { Patient } from "../../../../domain/patient";

export type SearchConsolidatedParams = {
  patient: Patient;
  query: string | undefined;
};

export type SearchConsolidatedResult = {
  url?: string;
  resourceCount: number;
};

export interface SearchConsolidated {
  search({ patient, query }: SearchConsolidatedParams): Promise<SearchConsolidatedResult>;
}
