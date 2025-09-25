import {
  CodeableConcept,
  Patient,
  Procedure,
  ServiceRequest,
  Location,
  Condition,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { CPT_URL } from "@metriport/shared/medical";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getProcedureCategory } from "../../fhir/resources/procedure";
import { getServiceRequestReference } from "./service-request";
import { getLocationReference } from "./location";
import { getQuestDataSourceExtension } from "./shared";
import { getConditionReference } from "./condition";

export function getProcedure(
  detail: ResponseDetail,
  {
    patient,
    serviceRequest,
    location,
    conditions,
  }: {
    patient: Patient;
    serviceRequest?: ServiceRequest;
    location?: Location;
    conditions?: Condition[];
  }
): Procedure {
  const code = getProcedureCode(detail);
  const subject = getPatientReference(patient);
  const category = getProcedureCategory("Diagnostic procedure");
  const basedOn = serviceRequest ? [getServiceRequestReference(serviceRequest)] : undefined;
  const extension = [getQuestDataSourceExtension()];
  const locationReference = location ? getLocationReference(location) : undefined;

  return {
    resourceType: "Procedure",
    id: uuidv7(),
    status: "completed",
    subject,
    category,
    ...(conditions && conditions.length > 0
      ? {
          reasonReference: conditions.map(condition => getConditionReference(condition)),
        }
      : undefined),
    ...(basedOn ? { basedOn } : undefined),
    ...(code ? { code } : undefined),
    ...(locationReference ? { location: locationReference } : undefined),
    extension,
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
