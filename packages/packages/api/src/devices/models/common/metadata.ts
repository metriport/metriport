import { ProviderSource } from "./provider-source";
import { SourceInfo } from "./source-info";

export interface Metadata {
  date: string;
  source: ProviderSource;
  data_origin?: SourceInfo;
  error?: string;
}
