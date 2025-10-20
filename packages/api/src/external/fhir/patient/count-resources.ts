import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { ConsolidatedCounterResponse } from "@metriport/core/command/consolidated/consolidated-counter";
import { Patient } from "@metriport/core/domain/patient";
import { countResourcesOnS3 } from "./count-resources-on-s3";

export type CountResourcesParams = {
  patient: Pick<Patient, "cxId" | "id">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  source?: "s3" | "server";
};

export async function countResources({
  patient,
  resources = [],
  dateFrom,
  dateTo,
}: CountResourcesParams): Promise<ConsolidatedCounterResponse> {
  return countResourcesOnS3({ patient, resources, dateFrom, dateTo });
}
