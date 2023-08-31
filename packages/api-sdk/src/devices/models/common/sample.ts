import { SourceInfo } from "./source-info";

export interface Sample {
  time: string;
  value: number;
  std_dev?: number;
  data_source?: SourceInfo;
}
