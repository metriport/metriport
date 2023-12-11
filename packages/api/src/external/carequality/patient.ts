import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { PatientExternalData } from "../../domain/medical/patient";
import { setCarequalityId } from "./patient-external-data";
import { PatientDataCarequality } from "./patient-shared";
import { MedicalDataSource } from "..";

export function getCQData(
  data: PatientExternalData | undefined
): PatientDataCarequality | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.CAREQUALITY] as PatientDataCarequality;
}

export async function handlePatientDiscoverResponse(
  patientDiscoveryResponse: PatientDiscoveryResponse
): Promise<void> {
  const { cxId, patientId, xcpdPatientId, patientMatch, gateway } = patientDiscoveryResponse;

  if (patientMatch) {
    await setCarequalityId({
      patientId,
      cxId,
      carequalityPatientId: xcpdPatientId?.id ?? "",
      carequalityPatientSystemId: xcpdPatientId?.system ?? "",
    });
  } else {
    console.log(
      `No patient match in IHE Gatway for patientId ${patientId}, cxId ${cxId}, gatewayUrl ${gateway.url}, gatewayId ${gateway.oid}`
    );
  }
}
