import {
  InboundPatientDiscoveryReq,
  InboundPatientDiscoveryResp,
} from "@metriport/ihe-gateway-sdk";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import { Address } from "../../../domain/address";
import { Patient, PatientData } from "../../../domain/patient";
import { MPI } from "../../../mpi/mpi";
import { patientMPIToPartialPatient } from "../../../mpi/shared";
import { toIheGatewayPatientResource } from "../ihe-gateway-v2/patient";
import {
  IHEGatewayError,
  XDSRegistryError,
  constructPDErrorResponse,
  constructPDNoMatchResponse,
} from "../error";
import { validateFHIRAndExtractPatient } from "./validating-pd";

import { getStateEnum } from "../../../domain/geographic-locations";
import { normalizeGender, normalizePatient } from "../../../mpi/normalize-patient";
import { METRIPORT_HOME_COMMUNITY_ID } from "../shared";

function constructMatchResponse(
  payload: InboundPatientDiscoveryReq,
  patient: Pick<Patient, "id" | "data">
): InboundPatientDiscoveryResp {
  return {
    id: payload.id,
    patientId: payload.patientId,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: true,
    externalGatewayPatient: {
      id: patient.id,
      system: METRIPORT_HOME_COMMUNITY_ID.replace("urn:oid:", ""),
    },
    patientResource: toIheGatewayPatientResource(patient),
    gatewayHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export async function processInboundPatientDiscovery(
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
  const genderAtBirth = normalizeGender(patientResource.gender);
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
    const line = address.line ? address.line.join(", ") : undefined;
    const city = address.city || undefined;
    const zip = address.postalCode || undefined;
    if (!state || !line || !city || !zip) continue;

    addresses.push({
      addressLine1: line,
      city,
      state,
      zip,
      country: address.country ?? "USA",
    });
  }
  return addresses;
}
