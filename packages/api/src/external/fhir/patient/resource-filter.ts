import { HumanName, ResourceType } from "@medplum/fhirtypes";
import {
  resourcesSearchableByPatient,
  resourcesSearchableBySubject,
  generalResources,
  ResourceTypeForConsolidation,
} from "@metriport/api-sdk";
import { intersection } from "lodash";
import {
  isoDateRangeToFHIRDateQuery,
  resourceSupportsDateQuery,
} from "@metriport/core/external/fhir/shared/index";

export function getPatientFilter({
  resources = [],
  dateFrom,
  dateTo,
}: {
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}) {
  const resourcesByPatient =
    resources && resources.length
      ? intersection(resources, resourcesSearchableByPatient)
      : resourcesSearchableByPatient;
  const resourcesBySubject =
    resources && resources.length
      ? intersection(resources, resourcesSearchableBySubject)
      : resourcesSearchableBySubject;
  const generalResourcesNoFilter =
    resources && resources.length ? intersection(resources, generalResources) : generalResources;

  const fhirDateFilter = isoDateRangeToFHIRDateQuery(dateFrom, dateTo);
  const dateFilter = fhirDateFilter ? `&${fhirDateFilter}` : "";

  return {
    resourcesByPatient,
    resourcesBySubject,
    generalResourcesNoFilter,
    dateFilter,
  };
}

export function fullDateQueryForResource(fullDateQuery: string, resource: ResourceType): string {
  return resourceSupportsDateQuery(resource) ? fullDateQuery : "";
}

export function nameContains(value: string, { caseSensitive = false } = {}) {
  return (name: HumanName | undefined) => {
    if (!name) return false;
    const valueToSearch = caseSensitive ? value : value.toLowerCase();
    return (
      name.family?.toLocaleLowerCase().includes(valueToSearch) ||
      name.given?.find(given => given.toLocaleLowerCase().includes(valueToSearch)) ||
      name.text?.toLocaleLowerCase().includes(valueToSearch)
    );
  };
}
