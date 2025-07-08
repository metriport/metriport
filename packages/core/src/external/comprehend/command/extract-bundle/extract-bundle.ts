import { ExtractionJob } from "../../types";

export interface ExtractBundleCommand {
  extractFhir(job: ExtractionJob): Promise<void>;
}
