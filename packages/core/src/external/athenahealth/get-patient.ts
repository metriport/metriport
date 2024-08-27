import {
  patientFhirResponseSchema,
  PatientFhirResponse,
} from "@metriport/shared/interface/external/athenahealth";
import { makeAthenaHealthApi } from "./api-factory";

export async function getPatient({
  accessToken,
  baseUrl,
  patientId,
}: {
  accessToken: string;
  baseUrl: string;
  patientId: string;
}): Promise<PatientFhirResponse> {
  const api = makeAthenaHealthApi(baseUrl, accessToken);
  const patientUrl = `/fhir/r4/Patient/${patientId}`;
  const resp = await api.get(patientUrl);
  if (!resp.data) throw new Error(`No body returned from ${patientUrl}`);
  console.log(`${patientUrl} resp: ${JSON.stringify(resp.data)}`);
  return patientFhirResponseSchema.parse(resp.data);
}
