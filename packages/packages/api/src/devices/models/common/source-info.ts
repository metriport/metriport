import { SourceType } from "./source-type";

export interface SourceInfo {
  source_type?: SourceType;
  id?: string;
  name?: string;
  type?: string;
}
