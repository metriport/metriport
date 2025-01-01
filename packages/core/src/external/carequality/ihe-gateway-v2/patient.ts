import { PatientIdAndData, mapPatientDataToResource } from "../../fhir/patient/conversion";
import { PatientResource } from "@metriport/ihe-gateway-sdk";

export function toIheGatewayPatientResource(patient: PatientIdAndData): PatientResource {
  return mapPatientDataToResource(patient);
}
