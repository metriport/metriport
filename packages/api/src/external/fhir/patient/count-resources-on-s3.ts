import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidatedCounterResponse } from "@metriport/core/command/consolidated/consolidated-counter";
import { buildConsolidatedCountConnector } from "@metriport/core/command/consolidated/consolidated-counter-factory";
import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";

export type CountResourcesParams = {
  patient: Pick<Patient, "cxId" | "id">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
};

export async function countResourcesOnS3({
  patient: partialPatient,
  resources = [],
  dateFrom,
  dateTo,
}: CountResourcesParams): Promise<ConsolidatedCounterResponse> {
  const patient = await getPatientOrFail({ id: partialPatient.id, cxId: partialPatient.cxId });

  const consolidatedCounter = buildConsolidatedCountConnector();
  const res = await consolidatedCounter.execute({
    patient,
    resources,
    dateFrom,
    dateTo,
  });
  return res;
}
