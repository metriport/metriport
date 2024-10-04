import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { getConsolidatedFromS3 } from "@metriport/core/command/consolidated/consolidated-filter";
import { Patient } from "@metriport/core/domain/patient";
import { countBy } from "lodash";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { ResourceCount } from "./count-resources-shared";

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
}: CountResourcesParams): Promise<ResourceCount> {
  const patient = await getPatientOrFail({ id: partialPatient.id, cxId: partialPatient.cxId });
  const res = await getConsolidatedFromS3({
    cxId: patient.cxId,
    patient,
    resources,
    dateFrom,
    dateTo,
  });
  const resultingResources = (res.entry ?? []).flatMap(e => (e && e.resource ? e.resource : []));

  const counted = countBy(resultingResources, r => r.resourceType);

  return {
    total: resultingResources.length,
    resources: counted,
  };
}
