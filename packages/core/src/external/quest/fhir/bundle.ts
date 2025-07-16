import { Bundle } from "@medplum/fhirtypes";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";

export async function convertIncomingDataToFhirBundle(
  cxId: string,
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  console.log(cxId, patientId);
  console.log(details);
  return {
    resourceType: "Bundle",
    entry: [],
  };
}
