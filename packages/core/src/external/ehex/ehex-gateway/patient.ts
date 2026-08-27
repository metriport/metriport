import { PatientResource } from "@metriport/ihe-gateway-sdk";
import { mapPatientDataToResource, PatientIdAndData } from "../../fhir/patient/conversion";
import { normalizePhoneNumberToEhexFormat } from "./inbound/xcpd/create/xcpd-response";

export function toEhexGatewayPatientResource(patient: PatientIdAndData): PatientResource {
  const genericPatientResource = mapPatientDataToResource(patient);
  const ehexFormattedTelecom = genericPatientResource.telecom?.flatMap(telecom => {
    if (telecom.system !== "phone") return telecom;
    if (!telecom.value) return [];

    const normalized = normalizePhoneNumberToEhexFormat(telecom.value);
    if (!normalized) return telecom;

    return {
      ...telecom,
      value: normalized,
    };
  });

  return {
    ...genericPatientResource,
    telecom: ehexFormattedTelecom,
  };
}
