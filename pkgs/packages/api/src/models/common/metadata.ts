import { ProviderSource } from "./provider-source";

export interface Metadata {
  date: string;
  source: ProviderSource;
  error?: string;
}
