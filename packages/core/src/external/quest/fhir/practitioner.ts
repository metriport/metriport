import { HumanName, Identifier, Practitioner } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function getPractitioner(detail: ResponseDetail): Practitioner {
  const name = getPractitionerName(detail);
  const identifier = getPractitionerIdentifier(detail);

  return {
    resourceType: "Practitioner",
    ...(name ? { name } : {}),
    ...(identifier ? { identifier } : {}),
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
