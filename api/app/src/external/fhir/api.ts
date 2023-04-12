import { Config } from "../../shared/config";
import { MedplumClient } from "../medplum";

const fhirUrl = Config.getFHIRServerUrl();

export const api = new MedplumClient({
  baseUrl: fhirUrl,
});
