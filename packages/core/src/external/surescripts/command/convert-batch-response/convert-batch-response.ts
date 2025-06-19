import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";

export interface SurescriptsConvertBatchResponseHandler {
  convertBatchResponse(job: SurescriptsJob): Promise<SurescriptsConversionBundle[]>;
}
