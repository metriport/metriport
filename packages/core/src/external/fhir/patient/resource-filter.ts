import { HumanName, ResourceType } from "@medplum/fhirtypes";
import { medical } from "@metriport/shared";
import { intersection } from "lodash";
import { isoDateRangeToFHIRDateQuery, resourceSupportsDateQuery } from "../shared/index";

export function getPatientFilter({
  resources,
  dateFrom,
  dateTo,
}: {
  resources: medical.ResourceTypeForConsolidation[];
  dateFrom: string | undefined;
  dateTo: string | undefined;
}) {
  const resourcesByPatient =
    resources && resources.length
      ? intersection(resources, medical.resourcesSearchableByPatient)
      : medical.resourcesSearchableByPatient;
  const resourcesBySubject =
    resources && resources.length
      ? intersection(resources, medical.resourcesSearchableBySubject)
      : medical.resourcesSearchableBySubject;
  const generalResourcesNoFilter =
    resources && resources.length
      ? intersection(resources, medical.generalResources)
      : medical.generalResources;

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
