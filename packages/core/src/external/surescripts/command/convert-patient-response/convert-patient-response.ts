import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";

export interface SurescriptsConvertPatientResponseHandler {
  convertPatientResponse(job: SurescriptsJob): Promise<SurescriptsConversionBundle | undefined>;
}
