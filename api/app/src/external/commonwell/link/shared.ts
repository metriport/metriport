import { Person } from "@metriport/commonwell-sdk";
import { apiUrl } from "../api";

import { OID_PREFIX } from "../../../shared/oid";

export const createReferenceLink = (patientId: string, orgId: string) => {
  return `${apiUrl}/v1/org/${OID_PREFIX}${orgId}/patient/${patientId}`;
};

export const createPatientLink = (personId: string, patientId: string): string => {
  return `${apiUrl}/v1/person/${personId}/patientLink/${patientId}/`;
};

export const commonwellPersonLinks = (persons: Person[]): Person[] => {
  const links: Person[] = [];

  persons.forEach(person => {
    if (person) links.push(person);
  });

  return links;
};
