import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { DiagnosticReport, Identifier, Specimen } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function buildDiagnosticReport(
  detail: ResponseDetail,
  { specimen }: { specimen?: Specimen }
): DiagnosticReport {
  const effectiveDateTime = getEffectiveDateTime(detail);
  const identifier = getIdentifier(detail);

  return {
    resourceType: "DiagnosticReport",
    id: uuidv7(),
    status: "final",
    effectiveDateTime,
    identifier,
    specimen: [
      {
        reference: `Specimen/${specimen?.id}`,
      },
    ],
    category: [
      {
        coding: [
          {
            system: "http://questdiagnostics.com/lpc",
            code: detail.localProfileCode ?? "",
            display: detail.profileName ?? "",
          },
          {
            system: "http://questdiagnostics.com/spc",
            code: detail.standardProfileCode ?? "",
            display: detail.profileName ?? "",
          },
        ],
      },
    ],
  };
}

function getEffectiveDateTime(detail: ResponseDetail): string {
  return detail.dateOfService.toISOString();
}

function getIdentifier(detail: ResponseDetail): Identifier[] {
  const identifier: Identifier[] = [
    {
      system: "quest-accession",
      value: detail.accessionNumber,
    },
  ];
  if (detail.requisitionNumber) {
    identifier.push({
      system: "quest-requisition",
      value: detail.requisitionNumber,
    });
  }
  return identifier;
}
