import { CodeableConcept, Procedure } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";

export function getProcedure(detail: ResponseDetail): Procedure {
  const code = getProcedureCode(detail);

  return {
    resourceType: "Procedure",
    id: uuidv7(),
    status: "completed",
    ...(code ? { code } : {}),
  };
}

function getProcedureCode(detail: ResponseDetail): CodeableConcept | undefined {
  if (!detail.cptCode) return undefined;
  return {
    coding: [
      {
        system: "http://www.ama-assn.org/go/cpt",
        code: detail.cptCode,
      },
    ],
  };
}
