import { SourceInfo } from "./source-info";

export interface Sample {
  time: string;
  value: number;
  data_origin?: SourceInfo;
}
