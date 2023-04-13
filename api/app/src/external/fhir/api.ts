import { Config } from "../../shared/config";
import { MedplumClient } from "@medplum/core";

const fhirUrl = Config.getFHIRServerUrl();

export const api = new MedplumClient({
  baseUrl: fhirUrl,
  fhirUrlPath: "/fhir",
});
