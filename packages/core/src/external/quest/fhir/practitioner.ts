import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { PRACTITIONER_NPI_URL, PRACTITIONER_UPIN_URL } from "@metriport/shared/medical";
import {
  HumanName,
  Identifier,
  Practitioner,
  PractitionerRole,
  Reference,
  Organization,
} from "@medplum/fhirtypes";
import { getPractitionerRoleCode } from "../../fhir/resources/practitioner-role";
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
  const code = [getPractitionerRoleCode("doctor")];

  return {
    resourceType: "PractitionerRole",
    id: uuidv7(),
    practitioner: getPractitionerReference(practitioner),
    organization: getOrganizationReference(organization),
    code,
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
  const identifiers: Identifier[] = [];
  if (detail.physicianNpi) {
    identifiers.push({
      system: PRACTITIONER_NPI_URL,
      value: detail.physicianNpi,
    });
  }
  if (detail.physicianUpin) {
    identifiers.push({
      system: PRACTITIONER_UPIN_URL,
      value: detail.physicianUpin,
    });
  }
  if (identifiers.length > 0) {
    return identifiers;
  }
  return undefined;
}
