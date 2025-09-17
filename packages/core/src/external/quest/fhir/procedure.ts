import { CodeableConcept, Patient, Procedure, ServiceRequest } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { CPT_URL } from "@metriport/shared/medical";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getProcedureCategory } from "../../fhir/resources/procedure";
import { getServiceRequestReference } from "./service-request";

export function getProcedure(
  detail: ResponseDetail,
  { patient, serviceRequest }: { patient: Patient; serviceRequest?: ServiceRequest }
): Procedure {
  const code = getProcedureCode(detail);
  const subject = getPatientReference(patient);
  const category = getProcedureCategory("Diagnostic procedure");
  const basedOn = serviceRequest ? [getServiceRequestReference(serviceRequest)] : undefined;

  return {
    resourceType: "Procedure",
    id: uuidv7(),
    status: "completed",
    subject,
    category,
    ...(basedOn ? { basedOn } : undefined),
    ...(code ? { code } : undefined),
  };
}

function getProcedureCode(detail: ResponseDetail): CodeableConcept | undefined {
  if (!detail.cptCode) return undefined;
  return {
    coding: [
      {
        system: CPT_URL,
        code: detail.cptCode,
      },
    ],
  };
}
