import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { HumanName, Identifier, Practitioner, Reference } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getQuestDataSourceExtension } from "./shared";

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
