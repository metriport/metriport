import { ProviderSource } from "./provider-source";
import { SourceInfo } from "./source-info";

export interface Metadata {
  date: string;
  hour?: string;
  source: ProviderSource;
  data_source?: SourceInfo;
  error?: string;
}
