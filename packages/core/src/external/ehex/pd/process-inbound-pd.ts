import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
  PatientResource,
} from "@metriport/ihe-gateway-sdk";
import { METRIPORT_HOME_COMMUNITY_ID } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import httpStatus from "http-status";
import { Address } from "../../../domain/address";
import { getStateEnum } from "../../../domain/geographic-locations";
import { Patient, PatientData } from "../../../domain/patient";
import { MPI } from "../../../mpi/mpi";
import { normalizePatient } from "../../../mpi/normalize-patient";
import { patientMPIToPartialPatient } from "../../../mpi/shared";
import { mapFhirToMetriportGender } from "../../fhir/patient/conversion";
import { toEhexGatewayPatientResource } from "../ehex-gateway/patient";
import {
  constructPDErrorResponse,
  constructPDNoMatchResponse,
  IHEGatewayError,
  XDSRegistryError,
} from "../error";
import { validateFHIRAndExtractPatient } from "./validating-pd";

function constructMatchResponse(
  payload: InboundPatientDiscoveryReq,
  patient: Pick<Patient, "id" | "data">
): InboundPatientDiscoveryResp {
  return {
    id: payload.id,
    patientId: payload.patientId,
    timestamp: payload.timestamp,
    responseTimestamp: buildDayjs().toISOString(),
    responseHttpStatusCode: httpStatus.OK,
    patientMatch: true,
    externalGatewayPatient: {
      id: patient.id,
      system: METRIPORT_HOME_COMMUNITY_ID.replace("urn:oid:", ""),
    },
    patientResource: toEhexGatewayPatientResource(patient),
    gatewayHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
    signatureConfirmation: payload.signatureConfirmation,
  };
}

export async function processInboundXcpd(
  payload: InboundPatientDiscoveryReq,
  mpi: MPI
): Promise<InboundPatientDiscoveryResp> {
  try {
    const patient = validateFHIRAndExtractPatient(payload);
    const matchingPatient = await mpi.findMatchingPatient(patient);
    if (!matchingPatient) {
      return constructPDNoMatchResponse(payload);
    }
    return constructMatchResponse(payload, patientMPIToPartialPatient(matchingPatient));
  } catch (error) {
    if (error instanceof IHEGatewayError) {
      return constructPDErrorResponse(payload, error);
    } else {
      return constructPDErrorResponse(
        payload,
        new XDSRegistryError("Internal Server Error", error)
      );
    }
  }
}

export function mapPatientResourceToPatientData(
  patientResource: PatientResource | undefined
): PatientData | undefined {
  if (!patientResource) return;
  const humanName = patientResource.name;
  if (!humanName) return;
  const firstName = humanName[0]?.given?.join(" ");
  const lastName = humanName[0]?.family;
  const dob = patientResource.birthDate;
  const genderAtBirth = mapFhirToMetriportGender(patientResource.gender);
  const addresses = getPatientAddresses(patientResource);

  if (!firstName || !lastName || !dob || !genderAtBirth || !addresses.length) return;

  return normalizePatient({
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: addresses,
  });
}

function getPatientAddresses(patientResource: PatientResource | undefined): Address[] {
  if (!patientResource?.address) return [];
  const addresses: Address[] = [];
  for (const address of patientResource.address) {
    const state = address.state ? getStateEnum(address.state) : undefined;
    const line1 = address.line ? address.line[0] : undefined;
    const line2 = address.line ? address.line.slice(1).join(", ") : undefined;
    const city = address.city || undefined;
    const zip = address.postalCode || undefined;
    if (!state || !line1 || !city || !zip) continue;

    addresses.push({
      addressLine1: line1,
      ...(line2 ? { addressLine2: line2 } : {}),
      city,
      state,
      zip,
      country: address.country ?? "USA",
    });
  }
  return addresses;
}
