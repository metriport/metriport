import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { Patient } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { makeFhirApi } from "../api/api-factory";
import { fullDateQueryForResource, getPatientFilter } from "./resource-filter";

export type ResourceCount = {
  total: number;
  resources: {
    [key in ResourceTypeForConsolidation]?: number;
  };
};

export async function countResourcesPerPatient({
  patient,
  resources = [],
  dateFrom,
  dateTo,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<ResourceCount> {
  const { log } = Util.out(
    `countResourcesPerPatient - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const fhir = makeFhirApi(patient.cxId);

  const {
    resourcesByPatient,
    resourcesBySubject,
    dateFilter: fullDateQuery,
  } = getPatientFilter({
    resources,
    dateFrom,
    dateTo,
  });

  const summaryCount = "&_summary=count";

  const result = await Promise.allSettled([
    ...resourcesByPatient.map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      const filter = `patient=${patient.id}${dateFilter}${summaryCount}`;
      const res = await fhir.search(resource, filter);
      return { resourceType: resource, count: res.total ?? 0 };
    }),
    ...resourcesBySubject.map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      const filter = `subject=${patient.id}${dateFilter}${summaryCount}`;
      const res = await fhir.search(resource, filter);
      return { resourceType: resource, count: res.total ?? 0 };
    }),
  ]);
  const succeeded = result.flatMap(r => (r.status === "fulfilled" ? r.value : []));
  const failed = result.flatMap(r => (r.status === "rejected" ? r.reason : []));

  let total = 0;
  const countPerResource = succeeded.reduce((acc, curr) => {
    const resourceType = curr.resourceType;
    const count = curr.count ?? 0;
    total += count;
    if (count === 0) return acc;
    return { ...acc, [resourceType]: count };
  }, {});

  if (failed.length) {
    log(
      `Amount of resources that failed to count: ${failed.length} (${succeeded.length} succeeded)`
    );
    capture.message(`Failed to count FHIR resources`, {
      extra: {
        context: `countResourcesPerPatient`,
        patientId: patient.id,
        succeeded: succeeded.length,
        failed: failed.length,
        failedResources: failed,
      },
    });
  }

  log(`${total} resources for types: ${resources.length ? resources.join(", ") : "all"}`);
  return {
    total,
    resources: countPerResource,
  };
}
