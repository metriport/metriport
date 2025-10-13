import { Bundle } from "@medplum/fhirtypes";

export interface DataExtractionFile {
  originalText: string;
  bundle: Bundle;
}
