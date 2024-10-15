import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { countResourcesOnFhir } from "./count-resources-on-fhir";
import { countResourcesOnS3 } from "./count-resources-on-s3";
import { ResourceCount } from "./count-resources-shared";

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
  source = "s3",
}: CountResourcesParams): Promise<ResourceCount> {
  if (source === "server") return countResourcesOnFhir({ patient, resources, dateFrom, dateTo });
  return countResourcesOnS3({ patient, resources, dateFrom, dateTo });
}
