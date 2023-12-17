import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { Patient } from "../../../domain/medical/patient";
import { capture } from "@metriport/core/util/notifications";
import { Util } from "../../../shared/util";
import { makeFhirApi } from "../api/api-factory";
import { fullDateQueryForResource, getPatientFilter } from "./resource-filter";

export type ResourceCount = {
  total: number;
  resources: {
    [key in ResourceTypeForConsolidation]?: number;
  };
};

export type CountResourcesParams = {
  patient: Pick<Patient, "cxId"> & Partial<Pick<Patient, "id" | "cxId">>;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
};

const summaryCount = "&_summary=count";

export async function countResources({
  patient,
  resources = [],
  dateFrom,
  dateTo,
}: CountResourcesParams): Promise<ResourceCount> {
  const { log } = Util.out(`countResources - cxId ${patient.cxId}, patientId ${patient.id}`);

  const result = patient.id
    ? await getResourceCountByPatient({ patient, resources, dateFrom, dateTo })
    : await getResourceCountByCustomer({ cxId: patient.cxId, resources, dateFrom, dateTo });
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
        context: `countResources`,
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

async function getResourceCountByPatient({
  patient,
  resources = [],
  dateFrom,
  dateTo,
}: CountResourcesParams) {
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

  return result;
}

async function getResourceCountByCustomer({
  cxId,
  resources = [],
  dateFrom,
  dateTo,
}: Omit<CountResourcesParams, "patient"> & { cxId: string }) {
  const fhir = makeFhirApi(cxId);

  const {
    resourcesByPatient,
    resourcesBySubject,
    dateFilter: fullDateQuery,
  } = getPatientFilter({
    resources,
    dateFrom,
    dateTo,
  });

  const result = await Promise.allSettled([
    ...[...resourcesByPatient, ...resourcesBySubject].map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      const filter = `${dateFilter}${summaryCount}`;
      const res = await fhir.search(resource, filter);
      return { resourceType: resource, count: res.total ?? 0 };
    }),
  ]);

  return result;
}
