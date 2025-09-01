import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  HumanName,
  Identifier,
  Practitioner,
  PractitionerRole,
  Reference,
  Organization,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getQuestDataSourceExtension } from "./shared";
import { getOrganizationReference } from "./organization";

export function getPractitioner(detail: ResponseDetail): Practitioner {
  const name = getPractitionerName(detail);
  const identifier = getPractitionerIdentifier(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "Practitioner",
    id: uuidv7(),
    ...(name ? { name } : {}),
    ...(identifier ? { identifier } : {}),
    extension,
  };
}

export function getPractitionerRole({
  practitioner,
  organization,
}: {
  practitioner: Practitioner;
  organization: Organization;
}): PractitionerRole {
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "PractitionerRole",
    id: uuidv7(),
    practitioner: getPractitionerReference(practitioner),
    organization: getOrganizationReference(organization),
    extension,
  };
}

export function getPractitionerReference(practitioner: Practitioner): Reference<Practitioner> {
  return {
    reference: `Practitioner/${practitioner.id}`,
  };
}

function getPractitionerName(detail: ResponseDetail): HumanName[] | undefined {
  if (!detail.physicianName) return undefined;
  return [
    {
      text: detail.physicianName,
    },
  ];
}

function getPractitionerIdentifier(detail: ResponseDetail): Identifier[] | undefined {
  if (!detail.physicianUpin) return undefined;
  return [
    {
      system: "http://hl7.org/fhir/sid/us-upin",
      value: detail.physicianUpin,
    },
  ];
}
