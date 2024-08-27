import {
  patientResourceSchema,
  PatientResource,
} from "@metriport/shared/interface/external/athenahealth/patient";
import { makeAthenaHealthApi } from "./api-factory";

export async function getPatient({
  accessToken,
  baseUrl,
  patientId,
}: {
  accessToken: string;
  baseUrl: string;
  patientId: string;
}): Promise<PatientResource | undefined> {
  const api = makeAthenaHealthApi(baseUrl, accessToken);
  const patientUrl = `/fhir/r4/Patient/${patientId}`;
  try {
    const resp = await api.get(patientUrl);
    if (!resp.data) throw new Error(`No body returned from ${patientUrl}`);
    console.log(`${patientUrl} resp: ${JSON.stringify(resp.data)}`);
    return patientResourceSchema.parse(resp.data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.response.status === 404) return undefined;
    throw error;
  }
}
