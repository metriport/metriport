import { ProviderSource } from "./provider-source";

export interface Metadata {
  date: string;
  userId: string;
  source: ProviderSource;
  error?: string;
}
